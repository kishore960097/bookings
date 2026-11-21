import {
  Salon,
  Service,
  Staff,
  Booking,
  QueueEntry,
  Review,
  User,
  NotificationItem,
  AnalyticsSummary,
  DashboardOverviewData,
  OwnerCustomerSummary,
  OwnerRevenueData,
  GeneratedTurfSlot,
  AdminOverviewResponse,
  AdminOwnerRecord,
  AdminCustomerRecord,
  AdminOwnersResponse,
  AdminCustomersResponse,
  SettlementCalculation,
  SettlementPayoutRecord,
  AdminSettlementsResponse,
  AdminReminderRecord,
} from '../types';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { processImageForUpload } from '../utils/imageUpload';

import { Capacitor } from '@capacitor/core';

// Scoped safe fetch wrapper for API methods to prevent SyntaxError on non-JSON HTTP error responses
// without globally mutating Response.prototype.
const rawFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch.bind(globalThis);
const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const res = await rawFetch(input, init);
  return new Proxy(res, {
    get(target, prop) {
      if (prop === 'json') {
        return async function () {
          try {
            const data = await target.json();
            if (!target.ok && typeof data === 'object' && data !== null && (data as any).success === undefined) {
              (data as any).success = false;
            }
            return data;
          } catch (err: any) {
            if (!target.ok) {
              return {
                success: false,
                error: `Server returned HTTP ${target.status} (${target.statusText || 'Error'}). Please check backend connection.`,
                code: `HTTP_${target.status}`,
                status: target.status,
              };
            }
            return {
              success: false,
              error: err?.message || 'Invalid server response.',
            };
          }
        };
      }
      const val = Reflect.get(target, prop, target);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });
};

// Default 24/7 Production Cloud Backend URL (Render)
export const DEFAULT_CLOUD_API_URL = 'https://qgo-backend.onrender.com';

// In web browsers (PC, mobile browser via DevTunnels or LAN), relative URLs ('') ensure API requests route to the current serving host.
// In the Capacitor Android APK, VITE_API_URL or DEFAULT_CLOUD_API_URL is used to connect to the external backend.
const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const rawApiUrl = envApiUrl || DEFAULT_CLOUD_API_URL;
const isNative = Capacitor.isNativePlatform();

export function getEffectiveApiOrigin(): string {
  if (!isNative) return '';
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qgo_custom_api_url')?.trim();
    if (stored) {
      // Auto-purge stale local development IPs (localhost, 192.168.*, 10.*, 172.16-31.*) in production builds
      // so users and beta testers never get stuck on unreachable local LAN addresses.
      const isLocalHostOrIp = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(stored);
      if (isLocalHostOrIp && !import.meta.env.DEV) {
        try {
          localStorage.removeItem('qgo_custom_api_url');
        } catch {}
      } else {
        return stored.replace(/\/+$/, '');
      }
    }
  }
  return (rawApiUrl || DEFAULT_CLOUD_API_URL).replace(/\/+$/, '');
}

export let API_ORIGIN = getEffectiveApiOrigin();
export let API_BASE = `${API_ORIGIN}/api/v1`;
export let isApiConfigured = true;

export function setCustomApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('qgo_custom_api_url', url.trim());
    } else {
      localStorage.removeItem('qgo_custom_api_url');
    }
  }
  API_ORIGIN = getEffectiveApiOrigin();
  API_BASE = `${API_ORIGIN}/api/v1`;
  isApiConfigured = true;
}

type FirebaseSessionResult = {
  success: boolean;
  user?: User;
  error?: string;
  code?: string;
  status?: number;
  retriable?: boolean;
};

function networkFailure(message: string, code: 'API_NOT_CONFIGURED' | 'NETWORK_UNAVAILABLE'): FirebaseSessionResult {
  return { success: false, error: message, code, status: 0, retriable: true };
}

export function resolveApiUrl(path: string): string {
  const origin = getEffectiveApiOrigin();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/v1/')) {
    return `${origin}${cleanPath}`;
  }
  return `${origin}/api/v1${cleanPath}`;
}

export function resolveAssetUrl(path: string): string {
  if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const origin = getEffectiveApiOrigin();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${cleanPath}`;
}

// Fail-fast guard: Inside Capacitor native app, VITE_API_URL or custom URL must be configured
if (Capacitor.isNativePlatform() && !API_ORIGIN) {
  const msg = '[QGo Configuration Error] VITE_API_URL is required when running inside the Capacitor Android APK, but it is currently empty. API calls will fail. Please set VITE_API_URL before building.';
  console.error(msg);
}

export const AUTH_TOKEN_KEY = 'qgo_token';
const INLINE_IMAGE_MAX_BYTES = 650 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not prepare the image for upload.'));
    reader.onerror = () => reject(new Error('Could not read the image for upload.'));
    reader.readAsDataURL(file);
  });
}

function authHeaders(includeJson = true): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// In-memory SWR (stale-while-revalidate) cache & request deduplication
interface SwrCacheEntry<T> {
  data: T;
  timestamp: number;
}

const swrCache = new Map<string, SwrCacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    swrCache.clear();
    return;
  }
  for (const key of Array.from(swrCache.keys())) {
    if (key.includes(prefix)) {
      swrCache.delete(key);
    }
  }
}

export function getCachedApiData<T>(key: string): T | undefined {
  return swrCache.get(key)?.data;
}

async function fetchWithSwr<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs = 30000,
  force = false
): Promise<T> {
  const now = Date.now();
  if (!force) {
    const cached = swrCache.get(cacheKey);
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.data;
    }
  }

  // Deduplicate concurrent in-flight requests for the exact same key
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const p = (async () => {
    try {
      const data = await fetcher();
      if (data && typeof data === 'object' && (data as any).success !== false) {
        swrCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, p);
  return p;
}

export const api = {
  // Auth
  async loginWithFirebase(
    idToken: string,
    requestedRole?: 'consumer' | 'owner' | 'admin'
  ): Promise<FirebaseSessionResult> {
    if (!isApiConfigured) {
      return networkFailure(
        'Unable to connect to the QGo Cloud backend. Please check your internet connection.',
        'API_NOT_CONFIGURED'
      );
    }
    try {
      const res = await fetch(`${API_BASE}/auth/firebase/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        credentials: 'include',
        body: JSON.stringify({ requestedRole }),
      });
      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok) {
        return {
          success: false,
          error: body?.error || `The QGo server returned HTTP ${res.status}.`,
          code: body?.code || `HTTP_${res.status}`,
          status: res.status,
          retriable: res.status >= 500,
        };
      }
      if (!body || typeof body !== 'object') {
        return { success: false, error: 'The QGo server returned an invalid session response.', code: 'INVALID_API_RESPONSE', status: res.status };
      }
      return { ...(body as FirebaseSessionResult), status: res.status };
    } catch (e: any) {
      console.warn('[QGo API] Firebase session request failed', {
        url: `${API_BASE}/auth/firebase/session`,
        message: e?.message,
      });
      return networkFailure(
        'Unable to reach the QGo server. Check your connection and try again.',
        'NETWORK_UNAVAILABLE'
      );
    }
  },

  async requestOtp(phone: string): Promise<{ success: boolean; error?: string; devOtp?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error requesting verification code' };
    }
  },

  async verifyOtp(
    phone: string,
    otp: string,
    name?: string,
    role?: 'consumer' | 'owner'
  ): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, name, role }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error verifying code' };
    }
  },

  async getMe(token?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const authToken = token || localStorage.getItem(AUTH_TOKEN_KEY);
      if (!authToken) return { success: false, error: 'No token' };
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Best-effort
    }
  },

  async updateProfile(updates: { name?: string; phone?: string; photoUrl?: string }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return await res.json().catch(() => ({ success: false }));
    } catch {
      return { success: false, error: 'Network error updating profile' };
    }
  },

  async onboardBusiness(data: {
    category: string;
    name: string;
    description?: string;
    city: string;
    address: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    openingTime?: string;
    closingTime?: string;
    price: number;
    slotDurationMinutes?: number;
    payoutCycle?: 'weekly' | 'monthly';
    upiId?: string;
    bankAccountHolder?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    payoutAgreementAccepted?: boolean;
    payoutAgreementAcceptedAt?: string;
  }): Promise<{ success: boolean; salon?: Salon; user?: User; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/owner/onboard-business`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async downloadAppBackup(): Promise<{ success: boolean; backup?: any; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/system/export-backup`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        return { success: false, error: errJson?.error || `Export failed with HTTP ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error downloading backup' };
    }
  },

  async resetFreshDatabase(adminPassword?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/reset-fresh`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ confirm: 'RESET_FRESH_DATABASE', adminPassword }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async switchRole(role: 'consumer' | 'owner' | 'admin'): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/switch-role`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ role }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  // Salons
  async getSalons(params?: { search?: string; category?: string; maxWait?: number }): Promise<{ salons: Salon[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.maxWait) query.set('maxWait', String(params.maxWait));
    const cacheKey = `salons:${query.toString()}`;

    return fetchWithSwr(cacheKey, async () => {
      try {
        const res = await fetch(`${API_BASE}/salons?${query.toString()}`);
        return await res.json();
      } catch (e: any) {
        return { salons: [], count: 0 };
      }
    }, 20000);
  },

  async getSalonDetail(id: string): Promise<{
    salon: Salon;
    services: Service[];
    staff: Staff[];
    reviews: Review[];
    queue: { length: number; estimatedWaitMinutes: number; entries: QueueEntry[] };
  }> {
    const cacheKey = `salon:${id}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/salons/${id}`, {
        headers: authHeaders(false),
      });
      return await res.json();
    }, 20000);
  },

  async getOwnerSalons(): Promise<{ salons: Salon[]; count: number }> {
    const cacheKey = 'owner:salons';
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/owner/salons`, {
        headers: authHeaders(false),
      });
      return await res.json();
    }, 15000);
  },

  async getMyStaffAssignment(): Promise<{ success: boolean; staff?: Staff; salon?: Salon; error?: string }> {
    const res = await fetch(`${API_BASE}/staff/me`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async updateSalon(id: string, data: Partial<Salon>): Promise<{ success: boolean; salon: Salon }> {
    invalidateApiCache('salon');
    invalidateApiCache('salons');
    invalidateApiCache('owner:salons');
    const res = await fetch(`${API_BASE}/salons/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async updateSalonSettings(id: string, data: Record<string, unknown>): Promise<{ success: boolean; salon: Salon }> {
    return this.updateSalon(id, data as Partial<Salon>);
  },

  async submitForVerification(id: string): Promise<{ success: boolean; salon: Salon }> {
    return this.updateSalon(id, { status: 'under_review', setupStep: 8 } as Partial<Salon>);
  },

  async approveSalon(id: string): Promise<{ success: boolean; salon: Salon; user?: import('../types').User; message?: string }> {
    invalidateApiCache('salon');
    invalidateApiCache('salons');
    invalidateApiCache('owner:salons');
    const res = await fetch(`${API_BASE}/salons/${id}/simulate-approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async getDashboardOverview(id: string): Promise<{ success: boolean; data: DashboardOverviewData }> {
    const cacheKey = `dashboard:${id}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/salons/${id}/dashboard-overview`, {
        headers: authHeaders(false),
      });
      return await res.json();
    }, 10000);
  },

  async getSalonCustomers(id: string): Promise<{ success: boolean; customers: OwnerCustomerSummary[] }> {
    const cacheKey = `salon:customers:${id}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/salons/${id}/customers`, {
        headers: authHeaders(false),
      });
      return await res.json();
    }, 15000);
  },

  async getSalonRevenueStats(id: string, params?: { period?: string; startDate?: string; endDate?: string }): Promise<{ success: boolean; data: OwnerRevenueData }> {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const cacheKey = `salon:revenue:${id}:${query.toString()}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/salons/${id}/revenue-stats?${query.toString()}`, {
        headers: authHeaders(false),
      });
      return await res.json();
    }, 15000);
  },

  async getTurfAvailability(salonId: string, date: string): Promise<{ success: boolean; slots: GeneratedTurfSlot[] }> {
    const cacheKey = `turf-slots:${salonId}:${date}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/salons/${salonId}/turf-slots?date=${date}`);
      return await res.json();
    }, 5000);
  },

  async blockSlot(salonId: string, data: { date: string; startTime: string; endTime?: string; resourceId?: string; reason?: string }): Promise<{ success: boolean; message: string; affectedBookings?: Booking[] }> {
    invalidateApiCache('turf-slots');
    invalidateApiCache('bookings');
    invalidateApiCache('dashboard');
    const res = await fetch(`${API_BASE}/salons/${salonId}/block-slot`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async unblockSlot(salonId: string, data: { date: string; startTime: string; resourceId?: string }): Promise<{ success: boolean; message: string }> {
    invalidateApiCache('turf-slots');
    invalidateApiCache('bookings');
    invalidateApiCache('dashboard');
    const res = await fetch(`${API_BASE}/salons/${salonId}/unblock-slot`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async blockDate(salonId: string, data: { date?: string; dates?: string[]; reason?: string; forceCancelBookings?: boolean }): Promise<{ success: boolean; message: string; affectedBookings?: Booking[] }> {
    const res = await fetch(`${API_BASE}/salons/${salonId}/block-date`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async unblockDate(salonId: string, data: { dates: string[] }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/salons/${salonId}/unblock-date`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async markBusinessLive(id: string): Promise<{ success: boolean; salon: Salon }> {
    return this.approveSalon(id);
  },

  async createSalon(data: Partial<Salon>): Promise<{ success: boolean; salon: Salon }> {
    const res = await fetch(`${API_BASE}/salons`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  // Geocoding & Live Location
  async searchAddress(query: string): Promise<{
    success: boolean;
    results: Array<{
      placeId: number;
      displayName: string;
      lat: number;
      lon: number;
      city: string;
      state: string;
      country: string;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/geocode/search?q=${encodeURIComponent(query)}`);
    return await res.json();
  },

  async reverseGeocode(lat: number, lon: number): Promise<{
    success: boolean;
    address?: string;
    city?: string;
    lat?: number;
    lon?: number;
    details?: Record<string, any>;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/geocode/reverse?lat=${lat}&lon=${lon}`);
    return await res.json();
  },

  // Services & Staff
  async addService(salonId: string, data: Partial<Service>): Promise<{ success: boolean; service: Service }> {
    const res = await fetch(`${API_BASE}/salons/${salonId}/services`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async createService(salonId: string, data: Partial<Service>): Promise<{ success: boolean; service: Service }> {
    return this.addService(salonId, data);
  },

  async updateService(serviceId: string, data: Partial<Service>): Promise<{ success: boolean; service: Service }> {
    const res = await fetch(`${API_BASE}/services/${serviceId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async addStaff(salonId: string, data: Partial<Staff>): Promise<{ success: boolean; staff: Staff }> {
    const res = await fetch(`${API_BASE}/salons/${salonId}/staff`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async createStaff(salonId: string, data: Partial<Staff>): Promise<{ success: boolean; staff: Staff }> {
    return this.addStaff(salonId, data);
  },

  async updateStaffStatus(staffId: string, status: string): Promise<{ success: boolean; staff: Staff }> {
    const res = await fetch(`${API_BASE}/staff/${staffId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    return await res.json();
  },

  // Availability (Salons & Turfs)
  async getAvailability(
    salonId: string,
    serviceIdOrOptions?: string | { serviceId?: string; staffId?: string; date?: string; resourceId?: string },
    staffId?: string,
    date?: string,
    resourceId?: string
  ): Promise<{ isOpen: boolean; message?: string; dayName: string; slots: GeneratedTurfSlot[]; resources: any[] }> {
    const query = new URLSearchParams();
    if (typeof serviceIdOrOptions === 'object' && serviceIdOrOptions !== null) {
      if (serviceIdOrOptions.serviceId) query.set('service_id', serviceIdOrOptions.serviceId);
      if (serviceIdOrOptions.staffId) query.set('staff_id', serviceIdOrOptions.staffId);
      if (serviceIdOrOptions.date) query.set('date', serviceIdOrOptions.date);
      if (serviceIdOrOptions.resourceId) query.set('resource_id', serviceIdOrOptions.resourceId);
    } else {
      if (typeof serviceIdOrOptions === 'string') query.set('service_id', serviceIdOrOptions);
      if (staffId) query.set('staff_id', staffId);
      if (date) query.set('date', date);
      if (resourceId) query.set('resource_id', resourceId);
    }

    const res = await fetch(`${API_BASE}/salons/${salonId}/availability?${query.toString()}`);
    return await res.json();
  },

  // Bookings (Appointments, Turf Slots & Live Tokens)
  async createBooking(bookingData: {
    salonId: string;
    customerName: string;
    customerPhone: string;
    serviceId?: string;
    staffId?: string;
    resourceId?: string;
    mode?: 'appointment' | 'token';
    scheduledDate?: string;
    scheduledTime?: string;
    slotEndTime?: string;
    price?: number;
    numberOfPlayers?: number;
    notes?: string;
    paymentType?: 'FULL' | 'ADVANCE' | 'pay_at_shop';
    advanceAmount?: number;
    manualBooking?: boolean;
    paymentId?: string;
    orderId?: string;
    paymentSignature?: string;
  }): Promise<{ success: boolean; booking?: Booking; qrPayload?: any; error?: string; slotTaken?: boolean }> {
    invalidateApiCache('bookings');
    invalidateApiCache('dashboard');
    invalidateApiCache('turf-slots');
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(bookingData),
    });
    return await res.json();
  },

  // Payment Orders & Cryptographic Verification
  async createPaymentOrder(data: {
    salonId: string;
    amount: number;
    paymentType?: 'FULL' | 'ADVANCE';
    bookingId?: string;
  }): Promise<{ success: boolean; orderId: string; amount: number; currency: string; error?: string }> {
    const res = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async verifyPayment(data: {
    orderId: string;
    paymentId: string;
    paymentSignature?: string;
    method?: string;
  }): Promise<{ success: boolean; orderId: string; paymentId: string; paymentSignature: string; status: string; error?: string }> {
    const res = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async createManualBooking(bookingData: {
    salonId: string;
    customerName: string;
    customerPhone: string;
    resourceId?: string;
    scheduledDate: string;
    scheduledTime: string;
    slotEndTime: string;
    numberOfPlayers?: number;
    notes?: string;
  }): Promise<{ success: boolean; booking?: Booking; qrPayload?: any; error?: string; slotTaken?: boolean }> {
    return this.createBooking({ ...bookingData, mode: 'appointment', manualBooking: true });
  },

  async getBookings(params?: { salonId?: string; date?: string; staffId?: string }): Promise<{ bookings: Booking[] }> {
    const query = new URLSearchParams();
    if (params?.salonId) query.set('salonId', params.salonId);
    if (params?.date) query.set('date', params.date);
    if (params?.staffId) query.set('staffId', params.staffId);
    const cacheKey = `bookings:${query.toString()}`;

    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/bookings?${query.toString()}`, {
        headers: authHeaders(false),
      });
      return await res.json();
    }, 10000);
  },

  async updateBookingStatus(bookingId: string, status: string): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    invalidateApiCache('bookings');
    invalidateApiCache('dashboard');
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    return await res.json();
  },

  async collectBalance(bookingId: string): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    invalidateApiCache('bookings');
    invalidateApiCache('dashboard');
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/collect-balance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async getBooking(id: string): Promise<{ success: boolean; booking: Booking; qrPayload: any }> {
    const res = await fetch(`${API_BASE}/bookings/${id}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async cancelBooking(id: string, reason?: string): Promise<{ success: boolean; message?: string; booking?: Booking; error?: string }> {
    invalidateApiCache('bookings');
    invalidateApiCache('dashboard');
    invalidateApiCache('turf-slots');
    const res = await fetch(`${API_BASE}/bookings/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  async markArriving(id: string): Promise<{ success: boolean; message: string; booking?: Booking }> {
    invalidateApiCache('bookings');
    const res = await fetch(`${API_BASE}/bookings/${id}/arriving`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    return await res.json();
  },

  // Queue Operations
  async getLiveQueue(salonId: string, staffId?: string): Promise<{
    salonId: string;
    queueLength: number;
    estimatedWaitMinutes: number;
    entries: QueueEntry[];
    staff: Staff[];
  }> {
    const query = new URLSearchParams();
    if (staffId) query.set('staffId', staffId);

    const res = await fetch(`${API_BASE}/queue/${salonId}/live?${query.toString()}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async addWalkIn(salonId: string, data: { customerName?: string; customerPhone?: string; serviceId?: string; staffId?: string }) {
    const res = await fetch(`${API_BASE}/queue/${salonId}/walk-in`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async callNextCustomer(salonId: string, staffId?: string) {
    const res = await fetch(`${API_BASE}/queue/${salonId}/call-next`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ staffId }),
    });
    return await res.json();
  },

  async markServed(salonId: string, data: { queueEntryId?: string; bookingId?: string; staffId?: string }) {
    const res = await fetch(`${API_BASE}/queue/${salonId}/mark-served`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async markNoShow(salonId: string, data: { queueEntryId?: string; bookingId?: string }) {
    const res = await fetch(`${API_BASE}/queue/${salonId}/mark-no-show`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async pauseQueue(salonId: string, reason?: string) {
    const res = await fetch(`${API_BASE}/queue/${salonId}/pause`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  // QR Check-in & Ticket Verification
  async verifyOwnerTicket(ticketId: string): Promise<{
    success: boolean;
    code?: string;
    message?: string;
    completedAt?: string;
    ticketId?: string;
    customerName?: string;
    venueName?: string;
    slotId?: string;
    slotDate?: string;
    slotTime?: string;
    currentStatus?: string;
    totalAmount?: number;
    paidAmount?: number;
    balanceDue?: number;
    paymentType?: string;
    paymentStatus?: string;
    balanceCollected?: boolean;
  }> {
    try {
      const res = await fetch(`${API_BASE}/owner/tickets/verify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ticketId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          success: false,
          code: data?.code || data?.reason || 'VERIFICATION_FAILED',
          message: data?.message || data?.error || (res.status === 401 ? 'Please sign in to verify tickets.' : `Server returned error ${res.status}`),
          completedAt: data?.completedAt,
          ticketId: data?.ticketId,
          customerName: data?.customerName,
          venueName: data?.venueName,
          slotId: data?.slotId,
          slotDate: data?.slotDate,
          slotTime: data?.slotTime,
          currentStatus: data?.currentStatus,
          totalAmount: data?.totalAmount,
          paidAmount: data?.paidAmount,
          balanceDue: data?.balanceDue,
          paymentType: data?.paymentType,
          paymentStatus: data?.paymentStatus,
          balanceCollected: data?.balanceCollected,
        };
      }
      return data || { success: false, message: 'Invalid response from server' };
    } catch (e: any) {
      if (import.meta.env.DEV) console.warn('[QGo API] verifyOwnerTicket network error:', e);
      return {
        success: false,
        message: 'Could not connect to QGo server. Please check network connection.',
        code: 'NETWORK_ERROR',
      };
    }
  },

  async completeOwnerTicket(ticketId: string, options?: { collectBalance?: boolean }): Promise<{
    success: boolean;
    code?: string;
    message?: string;
    completedAt?: string;
    ticketId?: string;
    customerName?: string;
    venueName?: string;
    slotId?: string;
    slotDate?: string;
    slotTime?: string;
    currentStatus?: string;
    totalAmount?: number;
    paidAmount?: number;
    balanceDue?: number;
    paymentType?: string;
    paymentStatus?: string;
    balanceCollected?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/owner/tickets/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ticketId, collectBalance: Boolean(options?.collectBalance) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          success: false,
          code: data?.code || data?.reason || 'COMPLETION_FAILED',
          message: data?.message || data?.error || `Server returned error ${res.status}`,
          completedAt: data?.completedAt,
          ticketId: data?.ticketId,
          customerName: data?.customerName,
          venueName: data?.venueName,
          slotId: data?.slotId,
          slotDate: data?.slotDate,
          slotTime: data?.slotTime,
          currentStatus: data?.currentStatus,
          totalAmount: data?.totalAmount,
          paidAmount: data?.paidAmount,
          balanceDue: data?.balanceDue,
          paymentType: data?.paymentType,
          paymentStatus: data?.paymentStatus,
          balanceCollected: data?.balanceCollected,
        };
      }
      return data || { success: false, message: 'Invalid server response' };
    } catch (e: any) {
      if (import.meta.env.DEV) console.warn('[QGo API] completeOwnerTicket network error:', e);
      return {
        success: false,
        message: 'Could not connect to QGo server. Please check network connection.',
        code: 'NETWORK_ERROR',
      };
    }
  },


  async verifyTicket(payload: string | object, salonId: string, source: 'camera' | 'manual', allowCheckedIn = true) {
    try {
      const res = await fetch(`${API_BASE}/vendor/bookings/verify-ticket`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ payload, salonId, source, allowCheckedIn }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          valid: false,
          status: res.status,
          message: data?.message || data?.error || (res.status === 401 ? 'Please sign in to verify tickets.' : `Server returned status ${res.status}`),
        };
      }
      return data || { valid: false, message: 'Invalid response from server' };
    } catch (e: any) {
      console.warn('[QGo API] verifyTicket network error:', e);
      return {
        valid: false,
        message: 'Could not connect to QGo server. Please check network connection.',
      };
    }
  },

  async checkInBooking(bookingId: string, salonId: string, markAsPaid?: boolean) {
    const res = await fetch(`${API_BASE}/vendor/bookings/${bookingId}/check-in`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ salonId, markAsPaid }),
    });
    return await res.json();
  },

  async completeSlot(bookingId: string, salonId: string): Promise<{
    success: boolean;
    valid?: boolean;
    alreadyCompleted?: boolean;
    message?: string;
    completedAt?: string;
    booking?: Booking;
    error?: string;
    reason?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/vendor/bookings/${bookingId}/complete-slot`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ salonId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          success: false,
          alreadyCompleted: data?.alreadyCompleted,
          message: data?.message || data?.error || `Server returned error ${res.status}`,
          reason: data?.reason,
          booking: data?.booking,
          completedAt: data?.completedAt,
        };
      }
      return data || { success: false, message: 'Invalid server response' };
    } catch (e: any) {
      console.warn('[QGo API] completeSlot network error:', e);
      return {
        success: false,
        message: 'Could not connect to QGo server. Please check network connection.',
        reason: 'NETWORK_ERROR',
      };
    }
  },

  async scanQr(qrData: string | object, salonId: string) {
    const res = await fetch(`${API_BASE}/checkin/scan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ qrData, salonId }),
    });
    return await res.json();
  },

  async manualCodeCheckIn(code: string, salonId: string) {
    const res = await fetch(`${API_BASE}/checkin/manual-code`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ code, salonId }),
    });
    return await res.json();
  },

  async acceptQrCheckIn(bookingId: string, salonId: string, markAsPaid?: boolean) {
    const res = await fetch(`${API_BASE}/checkin/accept`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ bookingId, salonId, markAsPaid }),
    });
    return await res.json();
  },

  // Reviews
  async getSalonReviews(salonId: string): Promise<{ success: boolean; reviews: Review[] }> {
    try {
      const res = await fetch(`${API_BASE}/salons/${salonId}/reviews`, {
        headers: authHeaders(false),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, reviews: [] };
    }
  },

  async submitReview(reviewData: {
    bookingId?: string;
    salonId: string;
    staffId?: string;
    rating: number;
    comment: string;
  }) {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(reviewData),
    });
    return await res.json();
  },

  async respondToReview(reviewId: string, response: string) {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/response`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ response }),
    });
    return await res.json();
  },

  async replyToReview(reviewId: string, response: string) {
    return this.respondToReview(reviewId, response);
  },

  // Analytics
  async getAnalytics(salonId: string, period?: string): Promise<{ analytics: any }> {
    const query = period ? `?period=${period}` : '';
    const res = await fetch(`${API_BASE}/salons/${salonId}/analytics${query}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: NotificationItem[] }> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async markAllNotificationsRead() {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    return await res.json();
  },

  // Firebase Storage
  async uploadImage(
    file: File,
    folderPath = 'salons/general'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    let processedFile: File | undefined;
    try {
      processedFile = await processImageForUpload(file);
      const useInlineFallback =
        import.meta.env.DEV &&
        typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname);

      if (useInlineFallback) {
        if (processedFile.size > INLINE_IMAGE_MAX_BYTES) {
          return { success: false, error: 'Please use an image under 650 KB.' };
        }
        return { success: true, url: await fileToDataUrl(processedFile) };
      }

      const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
      const storageRef = ref(storage, `${cleanFolder}/${processedFile.name}`);
      await uploadBytes(storageRef, processedFile, {
        contentType: processedFile.type,
      });
      const publicUrl = await getDownloadURL(storageRef);
      return { success: true, url: publicUrl };
    } catch (err: any) {
      // Firebase Storage can reject browser uploads when its CORS configuration
      // does not include the current development origin. Keep the owner flow
      // usable by storing a tightly size-limited, already-compressed image inline.
      // Cloud Storage remains the preferred path whenever it is available.
      try {
        if (!processedFile) {
          return { success: false, error: err?.message || 'Upload failed' };
        }
        if (processedFile.size > INLINE_IMAGE_MAX_BYTES) {
          return {
            success: false,
            error: 'Firebase Storage blocked this upload and the compressed image is too large for fallback storage. Please use an image under 650 KB.',
          };
        }
        return { success: true, url: await fileToDataUrl(processedFile) };
      } catch (fallbackErr: any) {
        return { success: false, error: fallbackErr?.message || err?.message || 'Upload failed' };
      }
    }
  },

  // ----------------------------------------------------
  // Super Admin Monitoring Dashboard APIs
  // ----------------------------------------------------
  async getAdminOverview(range?: '7d' | '30d' | '90d'): Promise<AdminOverviewResponse> {
    const q = range ? `?range=${range}` : '';
    const cacheKey = `admin:overview:${range || 'default'}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/admin/overview${q}`, {
        headers: authHeaders(),
      });
      return await res.json();
    }, 10000);
  },

  async getAdminOwners(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminOwnersResponse> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const cacheKey = `admin:owners:${q.toString()}`;

    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/admin/owners?${q.toString()}`, {
        headers: authHeaders(),
      });
      return await res.json();
    }, 10000);
  },

  async settleOwnerPayout(
    ownerId: string,
    data: { amount: number; notes?: string; referenceId?: string }
  ): Promise<{ success: boolean; message: string; settledPayoutAmount?: number; lastPayoutDate?: string; error?: string }> {
    invalidateApiCache('admin');
    const res = await fetch(`${API_BASE}/admin/owners/${ownerId}/settle-payout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async getAdminSettlements(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
  }): Promise<AdminSettlementsResponse> {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.category) query.set('category', params.category);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const cacheKey = `admin:settlements:summary:${qs}`;
    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/admin/settlements${qs}`, {
        headers: authHeaders(),
      });
      return await res.json();
    }, 5000);
  },

  async payAdminSettlement(
    salonId: string,
    data: { amountPaid: number; paymentMethod: string; utrReference: string; notes?: string }
  ): Promise<{ success: boolean; message?: string; payout?: SettlementPayoutRecord; error?: string }> {
    invalidateApiCache('admin');
    const res = await fetch(`${API_BASE}/admin/settlements/${salonId}/pay`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async sendAdminSettlementWhatsApp(data: {
    salonId: string;
    phone?: string;
  }): Promise<{ success: boolean; message: string; recipient: string; text: string; whatsappUrl: string; automatedSent?: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/settlements/whatsapp-alert`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async updateUserStatus(
    userId: string,
    data: { isBlocked: boolean; reason?: string }
  ): Promise<{ success: boolean; isBlocked?: boolean; user?: any; error?: string }> {
    invalidateApiCache('admin');
    const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async getAdminCustomers(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminCustomersResponse> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const cacheKey = `admin:customers:${q.toString()}`;

    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/admin/customers?${q.toString()}`, {
        headers: authHeaders(),
      });
      return await res.json();
    }, 10000);
  },

  async sendHeartbeat(): Promise<{ success: boolean; userId?: string; lastActiveAt?: string; isOnline?: boolean }> {
    const res = await fetch(`${API_BASE}/auth/heartbeat`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async getAdminBookings(params?: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; bookings: (Booking & { business: string; owner: string })[]; pagination: any }> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.paymentStatus) q.set('paymentStatus', params.paymentStatus);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const cacheKey = `admin:bookings:${q.toString()}`;

    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/admin/bookings?${q.toString()}`, {
        headers: authHeaders(),
      });
      return await res.json();
    }, 10000);
  },

  async cancelBookingAsAdmin(
    bookingId: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string; booking?: Booking; error?: string }> {
    invalidateApiCache('admin');
    invalidateApiCache('bookings');
    const res = await fetch(`${API_BASE}/admin/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  async getAdminVenues(params?: {
    search?: string;
    status?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; venues: any[]; pagination: any }> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.category) q.set('category', params.category);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const cacheKey = `admin:venues:${q.toString()}`;

    return fetchWithSwr(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/admin/venues?${q.toString()}`, {
        headers: authHeaders(),
      });
      return await res.json();
    }, 10000);
  },

  async approveVenue(salonId: string, reason?: string): Promise<{ success: boolean; message?: string; salon?: any; error?: string }> {
    invalidateApiCache('admin');
    invalidateApiCache('salon');
    invalidateApiCache('salons');
    const res = await fetch(`${API_BASE}/admin/businesses/${salonId}/approve`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  async rejectVenue(salonId: string, reason?: string): Promise<{ success: boolean; business?: any; error?: string }> {
    invalidateApiCache('admin');
    invalidateApiCache('salon');
    invalidateApiCache('salons');
    const res = await fetch(`${API_BASE}/admin/businesses/${salonId}/reject`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  async suspendVenue(salonId: string, reason?: string): Promise<{ success: boolean; business?: any; error?: string }> {
    invalidateApiCache('admin');
    invalidateApiCache('salon');
    invalidateApiCache('salons');
    const res = await fetch(`${API_BASE}/admin/businesses/${salonId}/suspend`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  async getAdminAuditLogs(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; auditLogs: any[]; pagination: any }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/admin/audit-logs?${q.toString()}`, {
      headers: authHeaders(),
    });
    return await res.json();
  },

  async getAdminSettings(): Promise<{ success: boolean; settings: any }> {
    return fetchWithSwr('admin:settings', async () => {
      const res = await fetch(`${API_BASE}/admin/settings`, { headers: authHeaders() });
      return await res.json();
    }, 15000);
  },

  async updateAdminSettings(settings: any): Promise<{ success: boolean; settings?: any; error?: string }> {
    invalidateApiCache('admin:settings');
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(settings),
    });
    return await res.json();
  },

  async broadcastAlert(data: {
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
    audience?: 'customers' | 'owners' | 'all';
    targetAudience?: 'customers' | 'owners' | 'all';
  }): Promise<{ success: boolean; count?: number; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/broadcast`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async backupAll(): Promise<{ success: boolean; backup?: any; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/backup-all`, {
      headers: authHeaders(),
    });
    return await res.json();
  },

  async getAppVersion(): Promise<{
    success: boolean;
    latestVersion: string;
    minSupportedVersion?: string;
    apkDownloadUrl?: string;
    releaseNotes?: string;
    forceUpdate?: boolean;
    updatedAt?: string;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/app-version`);
    return await res.json();
  },

  async publishAppVersion(data: {
    latestVersion: string;
    minSupportedVersion?: string;
    apkDownloadUrl: string;
    releaseNotes?: string;
    forceUpdate?: boolean;
  }): Promise<{ success: boolean; version?: any; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/app-version`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async submitTicket(data: {
    category: string;
    description?: string;
    message?: string;
    title?: string;
    subject?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    attachmentUrl?: string;
    deviceInfo?: any;
  }): Promise<{ success: boolean; ticket?: any; error?: string }> {
    const payload = {
      ...data,
      title: data.title || data.subject || 'Beta Bug Report',
      description: data.description || data.message || '',
    };
    const res = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  },

  async getAdminReminders(): Promise<{ success: boolean; reminders: AdminReminderRecord[] }> {
    const res = await fetch(`${API_BASE}/admin/reminders`, { headers: authHeaders() });
    return await res.json();
  },

  async createAdminReminder(data: {
    targetTime: string;
    targetDate?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    targetTimestamp?: number;
    title: string;
    note?: string;
    notifyPhone?: string;
  }): Promise<{ success: boolean; reminder?: AdminReminderRecord; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/reminders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async deleteAdminReminder(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/reminders/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async triggerAdminReminder(id: string): Promise<{ success: boolean; reminder?: AdminReminderRecord; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/reminders/${id}/trigger`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async acknowledgeAdminReminder(id: string): Promise<{ success: boolean; reminder?: AdminReminderRecord; error?: string }> {
    const res = await fetch(`${API_BASE}/admin/reminders/${id}/acknowledge`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async testQbeCall(phone?: string): Promise<{
    success: boolean;
    message?: string;
    recipient: string;
    whatsappUrl: string;
    automatedSent: boolean;
    deliveryChannel?: string;
    twilioStatus?: any;
    missingTwilioEnv?: string[];
    callData: {
      callerName: string;
      callerSubtitle: string;
      title: string;
      message: string;
      timestamp: string;
    };
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/admin/test-qbe-call`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone }),
    });
    return await res.json();
  },
};
