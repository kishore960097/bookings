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
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const API_BASE = '/api/v1';
export const AUTH_TOKEN_KEY = 'qgo_token';

function authHeaders(includeJson = true): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Auth
  async requestOtp(phone: string): Promise<{ success: boolean; message: string; devOtp?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error', error: e?.message };
    }
  },

  async verifyOtp(phone: string, otp: string, name?: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, name }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async loginWithGoogle(
    credential: string,
    requestedRole: string,
    accessToken?: string,
    name?: string,
    picture?: string
  ): Promise<{ success: boolean; user?: User; token?: string; error?: string; code?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, accessToken, requestedRole, name, picture }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async loginAsDemo(role: 'consumer' | 'owner'): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async getMe(token?: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const authToken = token || localStorage.getItem(AUTH_TOKEN_KEY);
      if (!authToken) return { success: false, error: 'No token' };
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async switchRole(role: 'consumer' | 'owner'): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
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
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.category && params.category !== 'all') query.set('category', params.category);
      if (params?.maxWait) query.set('maxWait', String(params.maxWait));

      const res = await fetch(`${API_BASE}/salons?${query.toString()}`);
      return await res.json();
    } catch (e: any) {
      return { salons: [], count: 0 };
    }
  },

  async getSalonDetail(id: string): Promise<{
    salon: Salon;
    services: Service[];
    staff: Staff[];
    reviews: Review[];
    queue: { length: number; estimatedWaitMinutes: number; entries: QueueEntry[] };
  }> {
    const res = await fetch(`${API_BASE}/salons/${id}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async getOwnerSalons(): Promise<{ salons: Salon[]; count: number }> {
    const res = await fetch(`${API_BASE}/owner/salons`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async getMyStaffAssignment(): Promise<{ success: boolean; staff?: Staff; salon?: Salon; error?: string }> {
    const res = await fetch(`${API_BASE}/staff/me`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async updateSalon(id: string, data: Partial<Salon>): Promise<{ success: boolean; salon: Salon }> {
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

  async approveSalon(id: string): Promise<{ success: boolean; salon: Salon; message?: string }> {
    const res = await fetch(`${API_BASE}/salons/${id}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await res.json();
  },

  async getDashboardOverview(id: string): Promise<{ success: boolean; data: DashboardOverviewData }> {
    const res = await fetch(`${API_BASE}/salons/${id}/dashboard-overview`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async getSalonCustomers(id: string): Promise<{ success: boolean; customers: OwnerCustomerSummary[] }> {
    const res = await fetch(`${API_BASE}/salons/${id}/customers`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async getSalonRevenueStats(id: string, params?: { period?: string; startDate?: string; endDate?: string }): Promise<{ success: boolean; data: OwnerRevenueData }> {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const res = await fetch(`${API_BASE}/salons/${id}/revenue-stats?${query.toString()}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async blockSlot(salonId: string, data: { date: string; startTime: string; endTime?: string; resourceId?: string; reason?: string }): Promise<{ success: boolean; message: string; affectedBookings?: Booking[] }> {
    const res = await fetch(`${API_BASE}/salons/${salonId}/block-slot`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async unblockSlot(salonId: string, data: { date: string; startTime: string; resourceId?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/salons/${salonId}/unblock-slot`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async blockDate(salonId: string, data: { date: string; reason?: string; forceCancelBookings?: boolean }): Promise<{ success: boolean; message: string; affectedBookings?: Booking[] }> {
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
    } else if (typeof serviceIdOrOptions === 'string') {
      query.set('service_id', serviceIdOrOptions);
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
  }): Promise<{ success: boolean; booking?: Booking; qrPayload?: any; error?: string; slotTaken?: boolean }> {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(bookingData),
    });
    return await res.json();
  },

  async getBookings(params?: { salonId?: string; date?: string; staffId?: string }): Promise<{ bookings: Booking[] }> {
    const query = new URLSearchParams();
    if (params?.salonId) query.set('salonId', params.salonId);
    if (params?.date) query.set('date', params.date);
    if (params?.staffId) query.set('staffId', params.staffId);

    const res = await fetch(`${API_BASE}/bookings?${query.toString()}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async updateBookingStatus(bookingId: string, status: string): Promise<{ success: boolean; booking?: Booking }> {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    return await res.json();
  },

  async getBooking(id: string): Promise<{ success: boolean; booking: Booking; qrPayload: any }> {
    const res = await fetch(`${API_BASE}/bookings/${id}`, {
      headers: authHeaders(false),
    });
    return await res.json();
  },

  async cancelBooking(id: string, reason?: string): Promise<{ success: boolean; message: string; booking?: Booking }> {
    const res = await fetch(`${API_BASE}/bookings/${id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  async markArriving(id: string): Promise<{ success: boolean; message: string; booking?: Booking }> {
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

  // QR Check-in
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

  // Supabase Storage & direct queries if configured
  async uploadImage(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    if (isSupabaseConfigured) {
      try {
        const ext = file.name.split('.').pop();
        const fileName = `${Math.random()}.${ext}`;
        const { data, error } = await supabase.storage.from('turf-images').upload(fileName, file);
        if (error) return { success: false, error: error.message };
        const { data: publicUrlData } = supabase.storage.from('turf-images').getPublicUrl(fileName);
        return { success: true, url: publicUrlData.publicUrl };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    }
    return { success: false, error: 'Supabase storage is not configured' };
  }
};
