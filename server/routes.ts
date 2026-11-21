import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { adminAuth, adminDb } from './firebaseAdmin';
import {
  Booking,
  QueueEntry,
  Review,
  Salon,
  Service,
  Staff,
  User,
  NotificationItem,
  AuthAccount,
  UserRoleMap,
  UserRole,
  isTurfBusiness,
  TurfResource,
  GeneratedTurfSlot,
  OwnerCustomerSummary,
  OwnerRevenueData,
  SettlementCalculation,
  SettlementPayoutRecord,
  AdminSettlementsResponse,
  AdminReminderRecord,
} from '../src/types';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { format12Hour, minutesToTime, timeToMinutes } from '../packages/shared/src/time';
import { getSessionSecret, isSuperAdminEmail, ADMIN_EMAILS, DEFAULT_SUPER_ADMIN_EMAIL } from './config';
import { checkinLimiter } from './middleware/security';
import { businessToday, slotInstantMs, shiftBusinessDate } from './lib/businessTime';
import {
  normalizePaymentStatus,
  makeOrderSignature,
  makePaymentSignature,
  verifyPaymentSignature,
} from './lib/payment';
import {
  extractOwnerTicketId,
  findOwnerTicketBooking,
  getBookingSlotId,
  getOwnerTicketEligibilityError,
} from './lib/ownerTickets';
import {
  validateBody,
  otpRequestSchema,
  otpVerifySchema,
  bookingCreationSchema,
  reviewCreationSchema,
  supportTicketSchema,
} from './middleware/validation';

// Fail fast at startup if QGO_SESSION_SECRET is missing or invalid (< 32 chars)
if (process.env.NODE_ENV !== 'test') getSessionSecret();

const platformAdminEmails = ADMIN_EMAILS;

type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    role: UserRole;
    user: User;
    claims: Record<string, unknown>;
  };
};

const normalizeEmail = (email?: unknown) =>
  typeof email === 'string' ? email.trim().normalize('NFKC').toLowerCase() : '';
const normalizePhone = (phone?: unknown) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export function getLocalDateString(date: Date = new Date(), timeZone: string = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export function getLocalMinutes(date: Date = new Date(), timeZone: string = 'Asia/Kolkata'): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.format(date).split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}
const isPlatformAdmin = (user?: User | null, claims?: Record<string, unknown>) =>
  Boolean(claims?.admin === true || isSuperAdminEmail(user?.email));

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)qgo_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1].trim());
    }
  }
  return null;
}

function normalizeRequestedRole(role: unknown): 'consumer' | 'owner' | null {
  if (role === 'owner') return 'owner';
  if (role === 'consumer' || role === 'customer') return 'consumer';
  return null;
}

function getAuthorizedRoles(user: User, claims?: Record<string, unknown>): UserRole[] {
  const roles = new Set<UserRole>(['consumer']);
  Array.from(db.userRoles.values())
    .filter((r) => r.userId === user.id && r.status === 'active')
    .forEach((r) => roles.add(r.role));

  if (Array.from(db.salons.values()).some((s) => s.ownerId === user.id)) {
    roles.add('owner');
  }
  if (isPlatformAdmin(user, claims)) {
    roles.add('admin');
  }
  return Array.from(roles);
}

function ensureConsumerRole(userId: string) {
  const existing = Array.from(db.userRoles.values()).find((r) => r.userId === userId && r.role === 'consumer');
  if (!existing) {
    const id = `rm_${crypto.randomUUID()}`;
    db.userRoles.set(id, {
      id,
      userId,
      role: 'consumer',
      status: 'active',
    });
  }
}

const lastPersistedActiveAt = new Map<string, number>();

export function isUserOnline(user?: { lastActiveAt?: string | null } | null): boolean {
  if (!user || !user.lastActiveAt) return false;
  const parsed = Date.parse(user.lastActiveAt);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= 5 * 60 * 1000;
}

export function toIstDateString(isoString?: string | null): string | null {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) return null;
  // IST is UTC+05:30 = 5.5 * 3600 * 1000 ms = 19,800,000 ms
  return new Date(parsed + 19800000).toISOString().slice(0, 10);
}

export function recordUserActivity(user?: User | null): void {
  if (!user || !user.id) return;
  const now = Date.now();
  const isoNow = new Date(now).toISOString();
  user.lastActiveAt = isoNow;
  db.users.set(user.id, user);

  const lastPersist = lastPersistedActiveAt.get(user.id) || 0;
  if (now - lastPersist >= 60 * 1000) {
    lastPersistedActiveAt.set(user.id, now);
    if (adminDb && process.env.NODE_ENV !== 'test') {
      adminDb.collection('users').doc(user.id).set(
        { lastActiveAt: isoNow },
        { merge: true }
      ).catch((err: any) => {
        console.warn(`[Presence] Failed to persist lastActiveAt for ${user.id}:`, err?.message || err);
      });
    }
  }
}

function buildAuthenticatedUser(user: User, activeRole: UserRole, claims?: Record<string, unknown>) {
  const authorizedRoles = getAuthorizedRoles(user, claims);
  const ownerSalon = activeRole === 'owner'
    ? Array.from(db.salons.values()).find((s) => s.ownerId === user.id)
    : undefined;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    role: activeRole,
    activeRole,
    authorizedRoles,
    salonId: ownerSalon?.id || user.salonId,
    createdAt: user.createdAt,
  };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const rawToken = getBearerToken(req);
  if (!rawToken) {
    console.warn('[Auth 401] Missing bearer token');
    return res.status(401).json({ success: false, error: 'Unauthorized: missing token', code: 'auth/missing-token' });
  }

  let decoded: any = null;

  // Only Firebase Admin verifies identities. Do not trust access tokens or decoded JWTs from clients.
  try {
    try {
      decoded = await adminAuth.verifyIdToken(rawToken, true);
    } catch (checkRevokedErr: any) {
      const msg = checkRevokedErr?.message || '';
      const c = checkRevokedErr?.code || '';
      if (
        c === 'auth/insufficient-permission' ||
        c === 'app/invalid-credential' ||
        c === 'auth/credential-error' ||
        msg.includes('credential') ||
        msg.includes('permission')
      ) {
        decoded = await adminAuth.verifyIdToken(rawToken, false);
      } else {
        throw checkRevokedErr;
      }
    }
  } catch (err: any) {
    let code = err?.code || err?.errorInfo?.code;
    const msg = String(err?.message || '');
    if (!code) {
      if (msg.includes('auth/id-token-expired') || msg.toLowerCase().includes('expired')) {
        code = 'auth/id-token-expired';
      } else if (msg.includes('auth/id-token-revoked') || msg.toLowerCase().includes('revoked')) {
        code = 'auth/id-token-revoked';
      } else if (msg.includes('auth/argument-error') || msg.toLowerCase().includes('decoding') || msg.toLowerCase().includes('jwt')) {
        code = 'auth/argument-error';
      } else if (msg.includes('admin-not-configured') || msg.toLowerCase().includes('credentials are not configured')) {
        code = 'auth/admin-not-configured';
      } else {
        code = 'auth/invalid-token';
      }
    }
    console.warn(`[Auth 401] Token verification failed - code: ${code}, message: ${msg}`);
    if (code === 'auth/admin-not-configured') {
      return res.status(401).json({
        success: false,
        error: 'Firebase Admin credentials are not configured on server',
        code,
        message: msg,
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid, expired, or revoked Firebase session',
      code,
      message: msg,
    });
  }

  try {
    let user = db.users.get(decoded.uid);
    const isVerifiedEmail = decoded.email_verified === true || decoded.email_verified === 'true' || process.env.NODE_ENV === 'test';
    if (!user) {
      user = {
        id: decoded.uid,
        ...(decoded.email && isVerifiedEmail ? { email: decoded.email } : {}),
        ...(decoded.phone_number ? { phone: decoded.phone_number } : {}),
        name: decoded.name || decoded.phone_number || 'QGo User',
        ...(decoded.picture ? { profileImage: decoded.picture } : {}),
        role: 'consumer',
        createdAt: new Date().toISOString(),
      };
      db.users.set(user.id, user);
      ensureConsumerRole(user.id);
    } else if (
      (decoded.email && isVerifiedEmail && user.email !== decoded.email) ||
      (decoded.phone_number && user.phone !== decoded.phone_number) ||
      (decoded.name && user.name !== decoded.name) ||
      (decoded.picture && user.profileImage !== decoded.picture)
    ) {
      if (decoded.email && isVerifiedEmail) user.email = decoded.email;
      if (decoded.phone_number) user.phone = decoded.phone_number;
      if (decoded.name) user.name = decoded.name;
      if (decoded.picture) user.profileImage = decoded.picture;
      db.users.set(user.id, user);
    }

    if (user.isBlocked) {
      console.warn(`[Auth 403] Blocked user access attempt: ${user.id}`);
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked by an administrator.',
        code: 'auth/user-blocked',
      });
    }

    // Automatic Super Admin promotion for allowlisted emails with verified email
    if (isSuperAdminEmail(decoded.email) && isVerifiedEmail) {
      user.role = 'admin';
      user.activeRole = 'admin';
      const adminRole = Array.from(db.userRoles.values()).find(
        (r) => r.userId === user.id && r.role === 'admin'
      );
      if (!adminRole) {
        const id = `rm_admin_${user.id}`;
        db.userRoles.set(id, {
          id,
          userId: user.id,
          role: 'admin',
          status: 'active',
        });
      }
      db.users.set(user.id, user);
    }

    // Check if user owns any salon strictly by ownerId
    const matchingSalons = Array.from(db.salons.values()).filter(
      (s) => s.ownerId === user.id
    );

    if (matchingSalons.length > 0) {
      user.salonId = matchingSalons[0].id;
      const ownerRole = Array.from(db.userRoles.values()).find(
        (r) => r.userId === user.id && r.role === 'owner'
      );
      if (!ownerRole) {
        const id = `rm_${crypto.randomUUID()}`;
        db.userRoles.set(id, {
          id,
          userId: user.id,
          role: 'owner',
          status: 'active',
          ...(matchingSalons[0].id ? { businessId: matchingSalons[0].id } : {}),
        });
      }
      if (!user.activeRole) {
        user.role = 'owner';
        user.activeRole = 'owner';
        db.users.set(user.id, user);
      }
    }

    const claims = decoded as unknown as Record<string, unknown>;
    const authorizedRoles = getAuthorizedRoles(user, claims);
    const preferredRole = user.activeRole || user.role;
    const role: UserRole = isPlatformAdmin(user, claims)
      ? 'admin'
      : (preferredRole && authorizedRoles.includes(preferredRole))
      ? preferredRole
      : (authorizedRoles.includes('owner') ? 'owner' : 'consumer');
    user.role = role;
    user.activeRole = role;
    recordUserActivity(user);
    req.auth = { userId: user.id, role, user, claims };
    next();
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error(`[Auth 500] User profile/role resolution failed: ${errorMsg}`, error?.stack);
    return res.status(500).json({ success: false, error: 'Internal error resolving user session', code: 'auth/user-resolution-failed' });
  }
}

function requireRole(...roles: Array<'consumer' | 'owner' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = req.auth.user;
    const claims = req.auth.claims;
    const authorized = getAuthorizedRoles(user, claims);
    const isAdmin = req.auth.role === 'admin' || isPlatformAdmin(user, claims);
    if (isAdmin) {
      return next();
    }
    const hasDirectRole = roles.includes(req.auth.role);
    const hasAuthorizedRole = roles.some((r) => authorized.includes(r));
    if (!hasDirectRole && !hasAuthorizedRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

const requireOwner = requireRole('owner', 'admin');
function requireTicketOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Sign in as the venue owner to scan tickets.' });
  }
  if (req.auth.role !== 'owner' || !getAuthorizedRoles(req.auth.user, req.auth.claims).includes('owner')) {
    return res.status(403).json({ success: false, code: 'OWNER_REQUIRED', message: 'Only the venue owner can scan and complete tickets.' });
  }
  next();
}
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
  if (req.auth.role !== 'admin' || !isPlatformAdmin(req.auth.user, req.auth.claims)) return res.status(403).json({ success: false, error: { code: 'ADMIN_ACCESS_DENIED', message: 'Admin access is restricted to the authorized QGo administrator.' } });
  next();
}

function canManageSalon(auth: AuthenticatedRequest['auth'], salonId: string) {
  if (!auth) return false;
  if (auth.role === 'admin' || isPlatformAdmin(auth.user, auth.claims)) return true;
  const salon = db.salons.get(salonId);
  if (!salon) return false;
  if (salon.ownerId === auth.userId) return true;

  const userRole = Array.from(db.userRoles.values()).find(
    (r) => r.userId === auth.userId && r.role === 'owner' && r.businessId === salonId
  );
  if (userRole) {
    return true;
  }

  if (auth.user?.salonId === salonId && auth.role === 'owner') {
    return true;
  }

  return false;
}

function canActOnStaff(auth: AuthenticatedRequest['auth'], salonId: string, _staffId?: string) {
  return canManageSalon(auth, salonId);
}

function canReadBooking(auth: AuthenticatedRequest['auth'], booking: Booking) {
  if (!auth) return false;
  if (booking.customerId === auth.userId) return true;
  return canManageSalon(auth, booking.salonId);
}

function forbidden(res: Response) {
  return res.status(403).json({ error: 'Forbidden' });
}

function sanitizeSalon(salon: Salon, includePrivate = false) {
  if (includePrivate) return salon;
  const { ownerId, pin, ...publicSalon } = salon;
  return publicSalon;
}

function sanitizeStaff(staff: Staff, includePrivate = false) {
  if (includePrivate) return staff;
  const { userId, phone, ...publicStaff } = staff;
  return publicStaff;
}

function sanitizeReview(review: Review, includePrivate = false) {
  if (includePrivate) return review;
  const { bookingId, customerId, ...publicReview } = review;
  return publicReview;
}

function sanitizeQueueEntry(entry: QueueEntry, includePrivate = false) {
  if (includePrivate) return entry;
  const { bookingId, customerName, customerPhone, ...publicEntry } = entry;
  return publicEntry;
}

function isValidStaffStatus(status: unknown): status is Staff['status'] {
  return status === 'available' || status === 'busy' || status === 'break' || status === 'off';
}

function isValidBookingStatus(status: unknown): status is Booking['status'] {
  return (
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'checked_in' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'cancelled' ||
    status === 'no_show'
  );
}

export const apiRouter = Router();

function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
      return next();
    }
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}`;
    const current = requests.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    requests.set(key, entry);

    if (requests.size > 5_000) {
      for (const [clientKey, client] of requests) {
        if (client.resetAt <= now) requests.delete(clientKey);
      }
    }

    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }
    next();
  };
}

// Rate limiting is centrally managed by server/middleware/security.ts
apiRouter.use('/bookings', createRateLimiter(300, 5 * 60 * 1000));
apiRouter.use('/checkin', createRateLimiter(60, 5 * 60 * 1000));

// Helper to notify user
function sendNotification(userId: string, notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) {
  const userNotifs = db.notifications.get(userId) || [];
  const newNotif: NotificationItem = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  userNotifs.unshift(newNotif);
  db.notifications.set(userId, userNotifs);
}

function enrichPublicSalon(salon: Salon) {
  const activeServices = Array.from(db.services.values()).filter((srv) => srv.salonId === salon.id && srv.isActive);
  const startingPrice =
    activeServices.length > 0 ? Math.min(...activeServices.map((srv) => srv.price)) : undefined;
  const facilities = [
    ...new Set<string>([
      ...activeServices.map((srv) => String(srv.category)).filter(Boolean),
      salon.category,
    ]),
  ];

  return {
    ...sanitizeSalon(salon),
    startingPrice,
    facilities,
    photos: [salon.coverUrl, salon.logoUrl].filter(Boolean),
  };
}

function makeQrSignature(bookingId: string, salonId: string, qrCodeId: string) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${bookingId}:${salonId}:${qrCodeId}`)
    .digest('base64url');
}

function isBookingExpired(booking: Booking) {
  if (booking.mode === 'appointment' && booking.scheduledDate && booking.scheduledTime) {
    try {
      const startMs = slotInstantMs(booking.scheduledDate, booking.scheduledTime);
      const durationMs = (booking.serviceDuration || 30) * 60_000;
      return Date.now() > startMs + durationMs;
    } catch {
      return false;
    }
  }

  const createdAt = new Date(booking.createdAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt > 12 * 60 * 60 * 1000;
}

function parseQrBooking(qrData: unknown) {
  let parsed: any;
  const expectsSignedQr = typeof qrData !== 'string' || qrData.trim().startsWith('{');

  try {
    parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch (e) {
    parsed = { tokenNumber: qrData };
  }

  const booking = Array.from(db.bookings.values()).find((b) => {
    if (parsed?.bookingId && b.id === parsed.bookingId) return true;
    if (parsed?.qrCodeId && b.qrCodeId === parsed.qrCodeId) return true;
    if (parsed?.tokenNumber && b.tokenNumber === parsed.tokenNumber) return true;
    return false;
  });

  return { parsed, expectsSignedQr, booking };
}

function validateBookingForCheckIn(booking: Booking | undefined, salonId: string, parsed?: any, expectsSignedQr = false) {
  if (!booking) {
    return {
      ok: false,
      status: 404,
      reason: 'INVALID_QR',
      message: 'No matching booking found for this QR code.',
    };
  }

  if (booking.salonId !== salonId) {
    return {
      ok: false,
      status: 403,
      reason: 'WRONG_SALON',
      message: 'This booking pass belongs to another shop.',
      booking,
    };
  }

  if (expectsSignedQr && parsed?.qrSignature !== booking.qrSignature) {
    return {
      ok: false,
      status: 403,
      reason: 'INVALID_SIGNATURE',
      message: 'QR signature could not be verified.',
    };
  }

  if (booking.status === 'checked_in') {
    return {
      ok: false,
      status: 400,
      reason: 'ALREADY_CHECKED_IN',
      message: 'This booking has already been accepted.',
      booking,
    };
  }

  if (booking.status === 'cancelled' || booking.status === 'no_show' || booking.status === 'completed') {
    return {
      ok: false,
      status: 400,
      reason: booking.status.toUpperCase(),
      message: 'This booking is not eligible for check-in.',
      booking,
    };
  }

  if (isBookingExpired(booking)) {
    return {
      ok: false,
      status: 400,
      reason: 'EXPIRED',
      message: 'This booking pass has expired.',
      booking,
    };
  }

  return { ok: true, status: 200, booking };
}

function releaseBookingSlotLock(booking: Booking) {
  db.releaseBookingSlotReservation(booking);
  const targetId = booking.resourceId || booking.staffId;
  if (!targetId || !booking.scheduledDate || !booking.scheduledTime) return;

  const startM = timeToMinutes(booking.scheduledTime);
  const duration = booking.serviceDuration || 30;
  let endM = booking.slotEndTime ? timeToMinutes(booking.slotEndTime) : startM + duration;
  if (endM <= startM) endM += 1440;
  for (let m = startM; m < endM; m += 15) {
    const timeStr = minutesToTime(m % 1440);
    db.releaseSlotLock(booking.salonId, targetId, booking.scheduledDate, timeStr, undefined);
  }
}

// ----------------------------------------------------
// 1. AUTHENTICATION & QUICK SWITCHER (OTP, Demo & Roles)
// ----------------------------------------------------

const OTP_COOLDOWN_MS = 60 * 1000;
const lastOtpRequestByPhone = new Map<string, number>();

apiRouter.post('/auth/otp/request', validateBody(otpRequestSchema), (req: Request, res: Response) => {
  const { phone } = req.body;
  const cleanPhone = phone.replace(/[\s\-()]/g, '');

  // Enforce 60-second cooldown per phone number
  const lastRequested = lastOtpRequestByPhone.get(cleanPhone);
  if (lastRequested && Date.now() - lastRequested < OTP_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - lastRequested)) / 1000);
    return res.status(429).json({
      success: false,
      error: `Please wait ${waitSeconds} seconds before requesting another verification code.`,
    });
  }
  lastOtpRequestByPhone.set(cleanPhone, Date.now());

  // Generate cryptographically secure random 6-digit OTP
  const generatedOtp = crypto.randomInt(100000, 1000000).toString();
  db.otpStore.set(cleanPhone, { otp: generatedOtp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
  const maskedPhone = cleanPhone.length > 4 ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-3)}` : '****';
  console.log(`[QGo Auth] Verification code issued for ${maskedPhone}`);

  return res.json({
    success: true,
    message: 'OTP sent successfully',
    devOtp: process.env.NODE_ENV !== 'production' ? generatedOtp : undefined,
  });
});

apiRouter.post('/auth/otp/verify', validateBody(otpVerifySchema), async (req: Request, res: Response) => {
  const { phone, otp, name, role: requestedRoleInput } = req.body;
  const cleanPhone = String(phone).replace(/[\s\-()]/g, '');
  const cleanOtp = String(otp).trim();

  // Strict OTP format rule: exactly 6 digits
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ success: false, error: 'OTP must be exactly 6 digits' });
  }

  // Validate customer name format if provided
  if (name && typeof name === 'string' && name.trim()) {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || !/^[a-zA-Z\s.\-']{2,50}$/.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        error: 'Name must be at least 2 characters and contain only letters and standard characters',
      });
    }
  }

  const stored = db.otpStore.get(cleanPhone);
  if (!stored || stored.expiresAt < Date.now()) {
    return res.status(400).json({ success: false, error: 'Invalid or expired OTP. Please request a new code.' });
  }

  if (stored.attempts >= 5) {
    db.otpStore.delete(cleanPhone);
    return res.status(400).json({ success: false, error: 'Too many failed attempts. Please request a new OTP.' });
  }

  if (stored.otp !== cleanOtp) {
    stored.attempts = (stored.attempts || 0) + 1;
    db.otpStore.set(cleanPhone, stored);
    return res.status(400).json({ success: false, error: 'Invalid verification code. Please check and try again.' });
  }

  // OTP successfully verified — clear from store to prevent replay
  db.otpStore.delete(cleanPhone);

  const normPhone = normalizePhone(cleanPhone);
  let user = Array.from(db.users.values()).find((u) => normPhone && normalizePhone(u.phone) === normPhone);
  const uid = user ? user.id : `mock-uid-${cleanPhone.replace(/\+/g, '')}`;

  if (!user) {
    user = {
      id: uid,
      phone: cleanPhone,
      name: name || cleanPhone || 'QGo User',
      role: requestedRoleInput === 'owner' ? 'owner' : 'consumer',
      createdAt: new Date().toISOString(),
    };
    db.users.set(uid, user);
    ensureConsumerRole(uid);
  }

  const matchingSalons = Array.from(db.salons.values()).filter(
    (s) => s.ownerId === user!.id || (normPhone && normalizePhone(s.phone) === normPhone)
  );

  if (matchingSalons.length > 0 || requestedRoleInput === 'owner') {
    for (const s of matchingSalons) {
      if (s.ownerId !== user.id) {
        s.ownerId = user.id;
        db.salons.set(s.id, s);
      }
    }
    user.salonId = matchingSalons[0]?.id || user.salonId;
    user.role = 'owner';
    user.activeRole = 'owner';
    const hasRole = Array.from(db.userRoles.values()).some((r) => r.userId === user!.id && r.role === 'owner');
    if (!hasRole) {
      const rId = `rm_${crypto.randomUUID()}`;
      db.userRoles.set(rId, { id: rId, userId: user.id, role: 'owner', status: 'active', businessId: user.salonId });
    }
  }

  const authorizedRoles = getAuthorizedRoles(user);
  const activeRole: UserRole = authorizedRoles.includes('admin')
    ? 'admin'
    : authorizedRoles.includes('owner')
    ? 'owner'
    : 'consumer';
  user.role = activeRole;
  user.activeRole = activeRole;
  db.users.set(user.id, user);

  let token: string;
  try {
    token = await adminAuth.createCustomToken(user.id, { role: activeRole });
  } catch (err: any) {
    console.error('[Auth 500] Failed to generate custom token for OTP login:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Authentication service unavailable' });
  }
  return res.json({
    success: true,
    token,
    user: buildAuthenticatedUser(user, activeRole),
  });
});

apiRouter.post('/auth/firebase/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const requestedRole = normalizeRequestedRole(req.body?.requestedRole);
  const user = req.auth!.user;
  ensureConsumerRole(user.id);

  if (requestedRole === 'owner') {
    const hasOwner = Array.from(db.userRoles.values()).some((r) => r.userId === user.id && r.role === 'owner');
    if (!hasOwner) {
      const rId = `rm_${crypto.randomUUID()}`;
      db.userRoles.set(rId, {
        id: rId,
        userId: user.id,
        role: 'owner',
        status: 'active',
        ...(user.salonId ? { businessId: user.salonId } : {}),
      });
    }
  }

  const authorizedRoles = getAuthorizedRoles(user, req.auth!.claims);
  const activeRole: UserRole = authorizedRoles.includes('admin')
    ? 'admin'
    : (requestedRole === 'owner' && authorizedRoles.includes('owner'))
    ? 'owner'
    : (requestedRole === 'consumer' && authorizedRoles.includes('consumer'))
    ? 'consumer'
    : (user.activeRole && authorizedRoles.includes(user.activeRole))
    ? user.activeRole
    : (authorizedRoles.includes('owner') ? 'owner' : 'consumer');

  user.role = activeRole;
  user.activeRole = activeRole;
  user.authorizedRoles = authorizedRoles;
  db.users.set(user.id, user);

  // Set cross-origin session cookie for persistent browser & Capacitor sessions
  const rawToken = getBearerToken(req);
  if (rawToken) {
    res.cookie('qgo_token', rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 3600 * 1000,
      path: '/',
    });
  }

  return res.json({ success: true, user: buildAuthenticatedUser(user, activeRole, req.auth!.claims) });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('qgo_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { user, role } = req.auth!;
  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, role, req.auth!.claims),
  });
});

apiRouter.patch('/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId;
  const user = db.users.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const { name, phone, photoUrl } = req.body || {};
  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }
  if (typeof phone === 'string') {
    user.phone = phone.trim();
  }
  if (typeof photoUrl === 'string') {
    user.photoUrl = photoUrl.trim();
    user.profileImage = photoUrl.trim();
  }

  db.users.set(userId, user);

  try {
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.set(
      {
        ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
        ...(typeof photoUrl === 'string' ? { photoUrl: photoUrl.trim() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Profile Update] Firestore persist error:', err);
  }

  return res.json({ success: true, user: buildAuthenticatedUser(user, req.auth!.role, req.auth!.claims) });
});

apiRouter.post('/auth/switch-role', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const requestedRole = normalizeRequestedRole(req.body?.role);
  if (!requestedRole) {
    return res.status(400).json({ error: 'Invalid role requested' });
  }

  const user = req.auth!.user;
  ensureConsumerRole(user.id);

  if (requestedRole === 'owner') {
    const hasOwner = Array.from(db.userRoles.values()).some((r) => r.userId === user.id && r.role === 'owner');
    if (!hasOwner) {
      const rId = `rm_${crypto.randomUUID()}`;
      db.userRoles.set(rId, {
        id: rId,
        userId: user.id,
        role: 'owner',
        status: 'active',
        ...(user.salonId ? { businessId: user.salonId } : {}),
      });
    }
  }

  const authorizedRoles = getAuthorizedRoles(user, req.auth!.claims);
  if (!authorizedRoles.includes(requestedRole)) {
    return res.status(403).json({
      success: false,
      code: requestedRole === 'owner' ? 'OWNER_ACCESS_DENIED' : 'ROLE_ACCESS_DENIED',
      error: 'Requested role is not authorized for this account',
    });
  }

  user.role = requestedRole;
  user.activeRole = requestedRole;
  user.authorizedRoles = authorizedRoles;

  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, requestedRole, req.auth!.claims),
  });
});

apiRouter.post('/auth/heartbeat', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.auth!.user;
  recordUserActivity(user);
  return res.json({
    success: true,
    userId: user.id,
    lastActiveAt: user.lastActiveAt,
    isOnline: true,
  });
});

// ----------------------------------------------------
// ADMIN DASHBOARD
// ----------------------------------------------------
const adminDate = () => new Date().toISOString();
const adminProfile = (user: User) => ({ id: user.id, name: user.name, email: user.email || '', phone: user.phone || '', role: user.role, createdAt: user.createdAt, lastActiveAt: user.lastActiveAt || null });
const adminTicket = (ticket: any) => ({ ...ticket, user: db.users.get(ticket.userId) ? adminProfile(db.users.get(ticket.userId)!) : null });
const adminRequest = (request: any) => ({ ...request, requester: db.users.get(request.requesterId) ? adminProfile(db.users.get(request.requesterId)!) : null });
const auditAdmin = (req: AuthenticatedRequest, action: string, entityType: string, entityId = '', metadata: Record<string, unknown> = {}) => {
  const id = crypto.randomUUID();
  db.adminAuditLogs.set(id, { id, adminUserId: (req as any).auth!.userId, adminEmail: req.auth!.user.email, action, entityType, entityId, metadata, timestamp: adminDate(), ipAddress: req.ip, requestId: req.headers['x-request-id'] || id });
};
const adminPage = <T>(items: T[], req: Request) => { const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25)); return { items: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / limit)) } }; };
const adminMatches = (value: unknown, search?: unknown) => !search || JSON.stringify(value).toLowerCase().includes(String(search).trim().toLowerCase());

apiRouter.get('/admin/me', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { auditAdmin(req, 'ADMIN_LOGIN', 'session'); return res.json({ success: true, admin: adminProfile(req.auth!.user) }); });

apiRouter.get('/admin/dashboard', requireAuth, requireAdmin, (_req, res) => {
  const today = businessToday();
  const bookings = Array.from(db.bookings.values());
  const customers = Array.from(db.users.values()).filter((user) => !Array.from(db.salons.values()).some((salon) => salon.ownerId === user.id) && !isPlatformAdmin(user));
  const owners = Array.from(db.users.values()).filter((user) => Array.from(db.salons.values()).some((salon) => salon.ownerId === user.id));
  return res.json({ success: true, counters: {
    activeUsers: Array.from(db.users.values()).filter((user) => user.createdAt?.slice(0, 10) === today).length,
    newBookings: Array.from(db.bookings.values()).filter((booking) => booking.createdAt?.slice(0, 10) === today).length,
    pendingApprovals: Array.from(db.salons.values()).filter((salon) => salon.status === 'under_review').length,
    openTickets: Array.from(db.supportTickets.values()).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length,
  }, data: { activeUsersToday: Array.from(db.users.values()).filter((user) => user.createdAt?.slice(0, 10) === today).length, newBookingsToday: bookings.filter((booking) => booking.createdAt?.slice(0, 10) === today).length, pendingBusinessApprovals: Array.from(db.salons.values()).filter((salon) => salon.status === 'under_review').length, openTickets: Array.from(db.supportTickets.values()).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length, totalCustomers: customers.length, totalOwners: owners.length, totalBusinesses: db.salons.size, totalBookings: bookings.length, todayRevenue: bookings.filter((booking) => booking.createdAt?.slice(0, 10) === today && normalizePaymentStatus(booking.paymentStatus) === 'paid').reduce((sum, booking) => sum + (booking.amount || 0), 0), pendingPayments: bookings.filter((booking) => normalizePaymentStatus(booking.paymentStatus) === 'pending').length, pendingRefunds: bookings.filter((booking: any) => booking.refundStatus === 'pending').length } });
});

// ----------------------------------------------------
// SUPER ADMIN MONITORING DASHBOARD (OVERVIEW & DIRECTORIES)
// ----------------------------------------------------

apiRouter.get('/admin/overview', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const today = businessToday();
  const allBookings = Array.from(db.bookings.values());
  const allSalons = Array.from(db.salons.values());
  const allUsers = Array.from(db.users.values());
  const allPaymentOrders = Array.from(db.paymentOrders.values());

  const ownerIds = new Set(allSalons.map((s) => s.ownerId));
  const customers = allUsers.filter((u) => !ownerIds.has(u.id) && !isPlatformAdmin(u));
  const owners = allUsers.filter((u) => ownerIds.has(u.id) || u.role === 'owner');

  const paidBookings = allBookings.filter((b) => {
    const s = normalizePaymentStatus(b.paymentStatus);
    return s === 'paid' || s === 'partially_paid';
  });

  const totalGmv = paidBookings.reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0);
  const qgoNetEarnings = Math.round(totalGmv * 0.05); // 5% platform fee
  const gstCollected = Math.round(qgoNetEarnings * 0.18); // 18% GST on platform fee
  const totalRefunds = allBookings.reduce((sum, b: any) => sum + (b.refundAmount || 0), 0);
  const payoutsSettled = owners.reduce((sum, o) => sum + (o.settledPayoutAmount || 0), 0);
  const payoutsDue = Math.max(0, totalGmv - qgoNetEarnings - totalRefunds - payoutsSettled);

  const todayBookings = allBookings.filter((b) => (b.scheduledDate || b.createdAt?.slice(0, 10)) === today);
  const todayCompletedCount = todayBookings.filter((b) => b.status === 'completed').length;
  const todayConfirmedCount = todayBookings.filter((b) => b.status === 'confirmed').length;
  const todayCancelledCount = todayBookings.filter((b) => b.status === 'cancelled').length;
  const todayNoShowCount = todayBookings.filter((b) => b.status === 'no_show').length;
  const todayCheckInCount = todayBookings.filter((b) => b.status === 'checked_in' || b.status === 'in_progress').length;

  const activeSalonsCount = allSalons.filter((s) => !isTurfBusiness(s.category, s.bookingMode) && (s.isPublished || s.status === 'approved' || s.status === 'live')).length;
  const activeTurfsCount = allSalons.filter((s) => isTurfBusiness(s.category, s.bookingMode) && (s.isPublished || s.status === 'approved' || s.status === 'live')).length;
  const pendingApprovalsCount = allSalons.filter((s) => s.status === 'under_review' || s.status === 'draft').length;

  // Time-series generator for past N days
  const getPastDates = (numDays: number): string[] => {
    const list: string[] = [];
    const [y, m, d] = today.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    for (let i = numDays - 1; i >= 0; i--) {
      const dt = new Date(base.getTime() - i * 86400000);
      list.push(dt.toISOString().slice(0, 10));
    }
    return list;
  };

  const buildTimeSeries = (numDays: number) => {
    const dates = getPastDates(numDays);
    return dates.map((date) => {
      const dayBookings = allBookings.filter((b) => (b.scheduledDate || b.createdAt?.slice(0, 10)) === date);
      const paid = dayBookings.filter((b) => {
        const s = normalizePaymentStatus(b.paymentStatus);
        return s === 'paid' || s === 'partially_paid';
      });
      const gmv = paid.reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0);
      const qgoEarnings = Math.round(gmv * 0.05);
      return {
        date,
        gmv,
        qgoEarnings,
        bookings: dayBookings.length,
      };
    });
  };

  // Status breakdown
  const statusBreakdown: Record<string, number> = {
    confirmed: allBookings.filter((b) => b.status === 'confirmed').length,
    completed: allBookings.filter((b) => b.status === 'completed').length,
    cancelled: allBookings.filter((b) => b.status === 'cancelled').length,
    no_show: allBookings.filter((b) => b.status === 'no_show').length,
    checked_in: allBookings.filter((b) => b.status === 'checked_in' || b.status === 'in_progress').length,
    pending: allBookings.filter((b) => b.status === 'pending').length,
  };

  // Category split
  const turfBookingsCount = allBookings.filter((b) => {
    const s = db.salons.get(b.salonId);
    return isTurfBusiness(s?.category, s?.bookingMode) || Boolean(b.resourceId);
  }).length;
  const salonBookingsCount = Math.max(0, allBookings.length - turfBookingsCount);

  // Payment mode split
  const paymentModeSplit = {
    paid: allBookings.filter((b) => normalizePaymentStatus(b.paymentStatus) === 'paid').length,
    partially_paid: allBookings.filter((b) => normalizePaymentStatus(b.paymentStatus) === 'partially_paid').length,
    pay_at_shop: allBookings.filter((b) => normalizePaymentStatus(b.paymentStatus) === 'pay_at_shop').length,
  };

  // Proactive problem intimations / system alerts
  const alerts: any[] = [];

  // 1. Unapproved venues
  allSalons.filter((s) => s.status === 'under_review').forEach((s) => {
    alerts.push({
      id: `appr-${s.id}`,
      severity: 'warning',
      category: 'approval',
      title: 'Business Pending Review',
      message: `${s.name} in ${s.city} is awaiting verification to go live.`,
      targetTab: 'venues',
      entityId: s.id,
      createdAt: s.createdAt || adminDate(),
    });
  });

  // 2. Pending customer refunds
  allBookings.filter((b: any) => b.refundStatus === 'pending' || (b.status === 'cancelled' && ['paid', 'partially_paid'].includes(normalizePaymentStatus(b.paymentStatus)) && !b.refundStatus)).forEach((b: any) => {
    alerts.push({
      id: `ref-${b.id}`,
      severity: 'critical',
      category: 'refund',
      title: 'Action Needed: Customer Refund Pending',
      message: `Booking #${b.id.slice(-6)} for ${b.customerName} has ₹${b.refundAmount || b.paidAmount || b.amount || 0} pending refund.`,
      targetTab: 'payments',
      entityId: b.id,
      createdAt: b.cancelledAt || b.updatedAt || b.createdAt || adminDate(),
    });
  });

  // 3. Failed payment orders
  allPaymentOrders.filter((o) => o.status === 'failed').forEach((o) => {
    alerts.push({
      id: `pay-${o.orderId}`,
      severity: 'critical',
      category: 'payment',
      title: 'Payment Gateway Failure',
      message: `Payment order #${o.orderId.slice(-8)} for ₹${o.amount} failed during checkout.`,
      targetTab: 'payments',
      entityId: o.orderId,
      createdAt: o.createdAt || adminDate(),
    });
  });

  // 4. Repeated customer no-shows (>= 2 no-shows)
  customers.forEach((c) => {
    const noShows = allBookings.filter((b) => b.customerId === c.id && b.status === 'no_show').length;
    if (noShows >= 2) {
      alerts.push({
        id: `noshow-${c.id}`,
        severity: 'warning',
        category: 'reliability',
        title: 'Chronic No-Show Customer',
        message: `${c.name} (${c.phone || c.email}) has ${noShows} missed appointment no-shows.`,
        targetTab: 'customers',
        entityId: c.id,
        createdAt: adminDate(),
      });
    }
  });

  // 5. Low venue ratings (< 3.5 with >= 2 reviews)
  allSalons.filter((s) => s.reviewCount >= 2 && s.rating < 3.5).forEach((s) => {
    alerts.push({
      id: `rate-${s.id}`,
      severity: 'warning',
      category: 'venue',
      title: 'Low Venue Rating Intimation',
      message: `${s.name} customer rating is ${s.rating}★ (${s.reviewCount} reviews).`,
      targetTab: 'venues',
      entityId: s.id,
      createdAt: adminDate(),
    });
  });

  // 6. Suspended venues
  allSalons.filter((s) => s.status === 'suspended').forEach((s) => {
    alerts.push({
      id: `susp-${s.id}`,
      severity: 'info',
      category: 'venue',
      title: 'Venue Suspended',
      message: `${s.name} is currently suspended and hidden from user search.`,
      targetTab: 'venues',
      entityId: s.id,
      createdAt: adminDate(),
    });
  });

  auditAdmin(req, 'OVERVIEW_VIEWED', 'overview');

  return res.json({
    success: true,
    kpis: {
      totalGmv,
      qgoNetEarnings,
      gstCollected,
      totalRefunds,
      payoutsDue,
      payoutsSettled,
      todayBookingsCount: todayBookings.length,
      todayCompletedCount,
      todayConfirmedCount,
      todayCancelledCount,
      todayNoShowCount,
      todayCheckInCount,
      activeSalonsCount,
      activeTurfsCount,
      pendingApprovalsCount,
      totalCustomersCount: customers.length,
      totalOwnersCount: owners.length,
    },
    timeSeries: {
      '7d': buildTimeSeries(7),
      '30d': buildTimeSeries(30),
      '90d': buildTimeSeries(90),
    },
    statusBreakdown,
    categorySplit: {
      salon: salonBookingsCount,
      turf: turfBookingsCount,
    },
    paymentModeSplit,
    alerts,
  });
});

apiRouter.get('/admin/customers', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const ownerIds = new Set(Array.from(db.salons.values()).map((salon) => salon.ownerId));
  const allCustomerUsers = Array.from(db.users.values())
    .filter((user) => !ownerIds.has(user.id) && !isPlatformAdmin(user));

  const todayIst = businessToday();
  const totalCustomers = allCustomerUsers.length;
  const onlineCustomers = allCustomerUsers.filter((u) => isUserOnline(u)).length;
  const activeTodayCustomers = allCustomerUsers.filter((u) => {
    if (isUserOnline(u)) return true;
    const activeDate = toIstDateString(u.lastActiveAt);
    return activeDate === todayIst;
  }).length;

  const rows = allCustomerUsers
    .filter((user) => adminMatches(user, req.query.search))
    .map((user) => {
      const bookings = Array.from(db.bookings.values()).filter((booking) => booking.customerId === user.id);
      const completedBookings = bookings.filter((b) => b.status === 'completed').length;
      const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;
      const noShowCount = bookings.filter((b) => b.status === 'no_show').length;
      const totalSpent = bookings
        .filter((booking) => ['paid', 'partially_paid'].includes(normalizePaymentStatus(booking.paymentStatus)))
        .reduce((sum, booking) => sum + (booking.paidAmount || booking.amount || 0), 0);
      const totalRefundsReceived = bookings.reduce((sum, b: any) => sum + (b.refundAmount || 0), 0);
      const lastBooking = bookings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]?.createdAt || null;

      // Reliability Score: 100% baseline, penalized by no-shows (2.0x weight) and cancellations (0.5x weight)
      const penalty = Math.round(((noShowCount * 2.0 + cancelledBookings * 0.5) / (bookings.length || 1)) * 100);
      const reliabilityScore = bookings.length === 0
        ? 100
        : Math.max(0, Math.min(100, 100 - penalty));

      return {
        ...adminProfile(user),
        isBlocked: Boolean(user.isBlocked),
        blockedReason: user.blockedReason,
        isOnline: isUserOnline(user),
        lastActiveAt: user.lastActiveAt || null,
        totalBookings: bookings.length,
        bookingCount: bookings.length,
        completedBookings,
        cancelledBookings,
        noShowCount,
        reliabilityScore,
        totalSpent,
        totalRefundsReceived,
        lastBooking,
        lastBookingDate: lastBooking,
      };
    });

  auditAdmin(req, 'CUSTOMERS_VIEWED', 'customer');
  const page = adminPage(rows, req);
  return res.json({
    success: true,
    totalCustomers,
    onlineCustomers,
    activeTodayCustomers,
    customers: page.items,
    pagination: page.pagination,
  });
});

apiRouter.get('/admin/owners', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const allSalons = Array.from(db.salons.values());
  const allBookings = Array.from(db.bookings.values());
  const allReviews = Array.from(db.reviews.values());
  const ownerIds = new Set(allSalons.map((salon) => salon.ownerId));

  const allOwnerUsers = Array.from(db.users.values())
    .filter((user) => ownerIds.has(user.id) || user.role === 'owner');

  const totalOwners = allOwnerUsers.length;
  const onlineOwners = allOwnerUsers.filter((u) => isUserOnline(u)).length;

  let turfOwnersCount = 0;
  let salonOwnersCount = 0;
  let otherOwnersCount = 0;

  for (const owner of allOwnerUsers) {
    const venues = allSalons.filter((s) => s.ownerId === owner.id);
    const hasTurf = venues.some((v) => isTurfBusiness(v.category, v.bookingMode));
    const hasSalon = venues.some((v) => !isTurfBusiness(v.category, v.bookingMode));
    if (hasTurf) {
      turfOwnersCount++;
    } else if (hasSalon) {
      salonOwnersCount++;
    } else {
      otherOwnersCount++;
    }
  }

  const rows = allOwnerUsers
    .filter((user) => adminMatches(user, req.query.search))
    .map((user) => {
      const venues = allSalons.filter((salon) => salon.ownerId === user.id);
      const venueIds = new Set(venues.map((v) => v.id));
      const ownerBookings = allBookings.filter((b) => venueIds.has(b.salonId));

      const completedBookings = ownerBookings.filter((b) => b.status === 'completed').length;
      const cancelledBookings = ownerBookings.filter((b) => b.status === 'cancelled').length;

      const grossRevenue = ownerBookings
        .filter((b) => ['paid', 'partially_paid'].includes(normalizePaymentStatus(b.paymentStatus)))
        .reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0);

      const qgoFeeDeducted = Math.round(grossRevenue * 0.05); // 5% platform fee
      const refundsDeducted = ownerBookings.reduce((sum, b: any) => sum + (b.refundAmount || 0), 0);
      const netPayable = Math.max(0, grossRevenue - qgoFeeDeducted - refundsDeducted);
      const settledPayoutAmount = user.settledPayoutAmount || 0;
      const pendingPayoutBalance = Math.max(0, netPayable - settledPayoutAmount);

      const categories: string[] = [];
      let hasTurf = false;
      let hasSalon = false;
      for (const v of venues) {
        if (isTurfBusiness(v.category, v.bookingMode)) {
          hasTurf = true;
          if (!categories.includes('turf')) categories.push('turf');
        } else {
          hasSalon = true;
          const cat = v.category || 'salon';
          if (!categories.includes(cat)) categories.push(cat);
        }
      }
      const primaryCategory: 'turf' | 'salon' | 'other' = hasTurf ? 'turf' : (hasSalon ? 'salon' : 'other');

      const ownerReviews = allReviews.filter((r) => venueIds.has(r.salonId));
      const averageRating = ownerReviews.length > 0
        ? Math.round((ownerReviews.reduce((sum, r) => sum + r.rating, 0) / ownerReviews.length) * 10) / 10
        : (venues.length > 0 && venues.some((v) => (v.rating || 0) > 0)
            ? Math.round((venues.reduce((sum, v) => sum + (v.rating || 0), 0) / (venues.filter((v) => (v.rating || 0) > 0).length || 1)) * 10) / 10
            : 5.0);

      return {
        ...adminProfile(user),
        isBlocked: Boolean(user.isBlocked),
        blockedReason: user.blockedReason,
        isOnline: isUserOnline(user),
        lastActiveAt: user.lastActiveAt || null,
        categories,
        primaryCategory,
        averageRating,
        venues,
        businessCount: venues.length,
        totalBookings: ownerBookings.length,
        completedBookings,
        cancelledBookings,
        grossRevenue,
        qgoFeeDeducted,
        refundsDeducted,
        netPayable,
        settledPayoutAmount,
        pendingPayoutBalance,
        lastPayoutDate: user.lastPayoutDate,
      };
    });

  auditAdmin(req, 'OWNERS_VIEWED', 'owner');
  const page = adminPage(rows, req);
  return res.json({
    success: true,
    totalOwners,
    onlineOwners,
    categoryCounts: {
      turf: turfOwnersCount,
      salon: salonOwnersCount,
      other: otherOwnersCount,
    },
    owners: page.items,
    pagination: page.pagination,
  });
});

apiRouter.post('/admin/owners/:id/settle-payout', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const owner = db.users.get(id);
  if (!owner) {
    return res.status(404).json({ success: false, error: 'Owner not found' });
  }

  const amount = Number(req.body?.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'A positive payout amount is required' });
  }

  owner.settledPayoutAmount = (owner.settledPayoutAmount || 0) + amount;
  owner.lastPayoutDate = adminDate();
  db.users.set(owner.id, owner);

  auditAdmin(req, 'OWNER_PAYOUT_SETTLED', 'owner', owner.id, {
    amount,
    notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 500) : '',
    referenceId: typeof req.body?.referenceId === 'string' ? req.body.referenceId.slice(0, 100) : '',
  });

  return res.json({
    success: true,
    message: `₹${amount.toLocaleString('en-IN')} payout recorded for ${owner.name}`,
    settledPayoutAmount: owner.settledPayoutAmount,
    lastPayoutDate: owner.lastPayoutDate,
  });
});

// ============================================================================
// PARTNER PAYOUTS & SETTLEMENT ENGINE
// ============================================================================
const ADMIN_PAYOUT_WHATSAPP = '919600971886';

function computeSalonSettlement(salon: Salon): SettlementCalculation {
  const owner = db.users.get(salon.ownerId);
  const salonBookings = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === salon.id && b.status !== 'cancelled'
  );
  const unsettledBookings = salonBookings.filter((b) => !b.payoutSettled);

  const totalBookings = unsettledBookings.length;
  let grossSlotValue = 0;
  let totalOnlineCollected = 0;

  for (const b of unsettledBookings) {
    const slotPrice = Number(b.totalAmount || b.amount || b.servicePrice || 0);
    grossSlotValue += slotPrice;

    let advancePaid = 0;
    if (b.paymentType === 'ADVANCE' || b.paymentStatus === 'partially_paid' || b.paymentStatus === 'PARTIALLY_PAID') {
      advancePaid = Number(b.advanceAmount || b.paidAmount || Math.floor(slotPrice * 0.2));
    } else {
      advancePaid = Number(b.paidAmount || slotPrice);
    }
    totalOnlineCollected += (advancePaid + 35.40);
  }

  const qgoConvenienceFee = totalBookings * 30.00;
  const qgoGstCollected = Number((totalBookings * 5.40).toFixed(2));
  const qgoTotalRetained = Number((qgoConvenienceFee + qgoGstCollected).toFixed(2));
  const netOwnerPayable = Math.max(0, Math.round(totalOnlineCollected - qgoTotalRetained));
  const venueBalanceCollected = Math.max(0, grossSlotValue - netOwnerPayable);

  // All-time permanent vault metrics for this salon (never drop to 0 after payout)
  const allTimeBookingsCount = salonBookings.length;
  let allTimeGrossSlotValue = 0;
  for (const b of salonBookings) {
    allTimeGrossSlotValue += Number(b.totalAmount || b.amount || b.servicePrice || 0);
  }
  const allTimeQgoFee = allTimeBookingsCount * 30.00;
  const allTimeQgoRetained = Number((allTimeBookingsCount * 35.40).toFixed(2));

  const cycle = (salon.payoutCycle === 'monthly' ? 'monthly' : 'weekly') as 'weekly' | 'monthly';
  const now = new Date();
  const timeZone = 'Asia/Kolkata';
  const nowMs = now.getTime();
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ...

  let cyclePeriodLabel = '';
  let nextPayoutDate = '';
  let cycleStartDateStr = '';
  let isCycleDay = false;

  if (cycle === 'monthly') {
    cyclePeriodLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone });
    const year = now.getFullYear();
    const month = now.getMonth();
    const nextMonth = new Date(year, month + 1, 1);
    nextPayoutDate = getLocalDateString(nextMonth, timeZone);
    cycleStartDateStr = getLocalDateString(new Date(year, month, 1), timeZone);
    isCycleDay = now.getDate() === 1;
  } else {
    const diffToMon = (dayOfWeek + 6) % 7;
    const monday = new Date(nowMs - diffToMon * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const monStr = monday.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone });
    const sunStr = sunday.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone });
    cyclePeriodLabel = `${monStr} – ${sunStr}`;
    cycleStartDateStr = getLocalDateString(monday, timeZone);
    const daysUntilNextMon = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
    const nextMon = new Date(nowMs + (daysUntilNextMon === 0 ? 0 : daysUntilNextMon) * 86400000);
    nextPayoutDate = getLocalDateString(nextMon, timeZone);
    isCycleDay = dayOfWeek === 1;
  }

  const hasOlderBookings = unsettledBookings.some((b) => {
    const bDate = b.scheduledDate || (b.createdAt ? b.createdAt.slice(0, 10) : '');
    return Boolean(bDate && bDate < cycleStartDateStr);
  });

  const isPayoutDue = netOwnerPayable > 0 && (isCycleDay || hasOlderBookings);

  return {
    salonId: salon.id,
    salonName: salon.name,
    category: salon.category || 'Turf',
    ownerId: salon.ownerId,
    ownerName: owner?.name || 'Partner Owner',
    ownerPhone: salon.phone || owner?.phone || '',
    payoutCycle: cycle,
    upiId: salon.upiId,
    bankAccountHolder: salon.bankAccountHolder,
    bankName: salon.bankName,
    accountNumber: salon.accountNumber,
    ifscCode: salon.ifscCode,
    payoutAgreementAccepted: salon.payoutAgreementAccepted,
    payoutAgreementAcceptedAt: salon.payoutAgreementAcceptedAt,
    totalBookings,
    grossSlotValue,
    totalOnlineCollected,
    qgoConvenienceFee,
    qgoGstCollected,
    qgoTotalRetained,
    netOwnerPayable,
    venueBalanceCollected,
    cyclePeriodLabel,
    nextPayoutDate,
    isPayoutDue,
    unsettledBookingIds: unsettledBookings.map((b) => b.id),
    allTimeBookingsCount,
    allTimeGrossSlotValue,
    allTimeQgoFee,
    allTimeQgoRetained,
  };
}

apiRouter.get('/admin/settlements', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const range = (req.query.range as string) || 'all';
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const categoryFilter = (req.query.category as string) || 'all';

  const salons = Array.from(db.salons.values());
  const settlements: SettlementCalculation[] = salons.map((s) => computeSalonSettlement(s));

  let totalOnlineCollected = 0;
  let qgoPlatformFee = 0;
  let gstCollected = 0;
  let netPayableToOwners = 0;

  for (const s of settlements) {
    totalOnlineCollected += s.totalOnlineCollected;
    qgoPlatformFee += s.qgoConvenienceFee;
    gstCollected += s.qgoGstCollected;
    netPayableToOwners += s.netOwnerPayable;
  }

  const payoutHistory = Array.from(db.settlementPayouts.values()).sort(
    (a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()
  );

  const totalSettledHistorical = payoutHistory.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  // ─── PERMANENT QGO INCOME VAULT & TIMEFRAME CALCULATIONS ───
  const now = new Date();
  const nowMs = now.getTime();
  const dayOfWeek = now.getDay();
  const timeZone = 'Asia/Kolkata';

  let filterStart = '';
  let filterEnd = '';

  if (range === 'week') {
    const diffToMon = (dayOfWeek + 6) % 7;
    const monday = new Date(nowMs - diffToMon * 86400000);
    filterStart = getLocalDateString(monday, timeZone);
  } else if (range === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    filterStart = getLocalDateString(new Date(y, m, 1), timeZone);
  } else if (range === 'custom') {
    if (startDate) filterStart = startDate;
    if (endDate) filterEnd = endDate;
  }

  const allConfirmedBookings = Array.from(db.bookings.values()).filter(
    (b) => b.status !== 'cancelled'
  );

  const vaultBookings = allConfirmedBookings.filter((b) => {
    const bDate = b.scheduledDate || (b.createdAt ? b.createdAt.slice(0, 10) : '');
    if (filterStart && bDate && bDate < filterStart) return false;
    if (filterEnd && bDate && bDate > filterEnd) return false;
    return true;
  });

  const vaultBookingsCount = vaultBookings.length;
  const vaultGrossQgoPlatformIncome = Math.round(vaultBookingsCount * 35.40);
  const vaultStatutoryGst = Number((vaultBookingsCount * 5.40).toFixed(2));

  let vaultTotalOnline = 0;
  for (const b of vaultBookings) {
    const slotPrice = Number(b.totalAmount || b.amount || b.servicePrice || 0);
    let advancePaid = 0;
    if (b.paymentType === 'ADVANCE' || b.paymentStatus === 'partially_paid' || b.paymentStatus === 'PARTIALLY_PAID') {
      advancePaid = Number(b.advanceAmount || b.paidAmount || Math.floor(slotPrice * 0.2));
    } else {
      advancePaid = Number(b.paidAmount || slotPrice);
    }
    vaultTotalOnline += (advancePaid + 35.40);
  }

  // Estimated online gateway processing cost: ~2.36% on all online collected funds
  const vaultEstimatedGatewayCost = Number((vaultTotalOnline * 0.0236).toFixed(2));
  const vaultNetProfit = Math.round(vaultGrossQgoPlatformIncome - vaultStatutoryGst - vaultEstimatedGatewayCost);

  // ─── SPLIT CATEGORY OVERVIEW (TURF VS SALON) ───
  const turfSalons = salons.filter((s) => isTurfBusiness(s.category, s.bookingMode));
  const turfSalonIds = new Set(turfSalons.map((s) => s.id));
  const turfBookings = allConfirmedBookings.filter((b) => turfSalonIds.has(b.salonId));
  const turfPendingPayouts = settlements
    .filter((s) => turfSalonIds.has(s.salonId))
    .reduce((sum, s) => sum + s.netOwnerPayable, 0);
  const turfDisbursedPayouts = payoutHistory
    .filter((p) => turfSalonIds.has(p.salonId))
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  const nonTurfSalons = salons.filter((s) => !isTurfBusiness(s.category, s.bookingMode));
  const nonTurfSalonIds = new Set(nonTurfSalons.map((s) => s.id));
  const nonTurfBookings = allConfirmedBookings.filter((b) => nonTurfSalonIds.has(b.salonId));
  const nonTurfPendingPayouts = settlements
    .filter((s) => nonTurfSalonIds.has(s.salonId))
    .reduce((sum, s) => sum + s.netOwnerPayable, 0);
  const nonTurfDisbursedPayouts = payoutHistory
    .filter((p) => nonTurfSalonIds.has(p.salonId))
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  const turfMetrics = {
    venueCount: turfSalons.length,
    totalBookings: turfBookings.length,
    qgoFeeIncome: turfBookings.length * 30,
    disbursedPayouts: Math.round(turfDisbursedPayouts),
    pendingPayouts: Math.round(turfPendingPayouts),
  };

  const salonMetrics = {
    venueCount: nonTurfSalons.length,
    totalBookings: nonTurfBookings.length,
    qgoFeeIncome: nonTurfBookings.length * 30,
    disbursedPayouts: Math.round(nonTurfDisbursedPayouts),
    pendingPayouts: Math.round(nonTurfPendingPayouts),
  };

  // Optional category filter on settlements list
  let filteredSettlements = settlements;
  if (categoryFilter === 'turf') {
    filteredSettlements = settlements.filter((s) => turfSalonIds.has(s.salonId));
  } else if (categoryFilter === 'salon') {
    filteredSettlements = settlements.filter((s) => nonTurfSalonIds.has(s.salonId));
  }

  // Vault income is permanent: QGo platform fee never drops to 0 even after paying all owners
  const permanentQgoFee = vaultBookingsCount * 30.00;

  const response: AdminSettlementsResponse = {
    success: true,
    summary: {
      totalOnlineCollected: Math.round(totalOnlineCollected || vaultTotalOnline),
      qgoPlatformFee: Math.round(permanentQgoFee > 0 ? permanentQgoFee : qgoPlatformFee),
      gstCollected: Number(vaultStatutoryGst > 0 ? vaultStatutoryGst : gstCollected),
      netPayableToOwners: Math.round(netPayableToOwners),
      totalSettledHistorical: Math.round(totalSettledHistorical),
      vaultGrossQgoPlatformIncome,
      vaultStatutoryGst,
      vaultEstimatedGatewayCost,
      vaultNetProfit,
      totalPendingPayable: Math.round(netPayableToOwners),
      totalDisbursedHistorical: Math.round(totalSettledHistorical),
      turfMetrics,
      salonMetrics,
    },
    settlements: filteredSettlements,
    payoutHistory,
  };

  return res.json(response);
});

apiRouter.post('/admin/settlements/:salonId/pay', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ success: false, error: 'Venue not found' });
  }

  const amountPaid = Number(req.body?.amountPaid);
  const paymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod : 'UPI Transfer';
  const utrReference = typeof req.body?.utrReference === 'string' ? req.body.utrReference.trim() : '';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

  if (isNaN(amountPaid) || amountPaid <= 0) {
    return res.status(400).json({ success: false, error: 'A positive payout amount is required' });
  }
  if (!utrReference) {
    return res.status(400).json({ success: false, error: 'UTR / Bank transaction reference is required' });
  }

  const owner = db.users.get(salon.ownerId);
  const unsettledBookings = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === salon.id && !b.payoutSettled && b.status !== 'cancelled'
  );

  const settlementId = `stl_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const nowIso = new Date().toISOString();

  // Mark all unsettled bookings as paid & settled
  for (const b of unsettledBookings) {
    b.payoutSettled = true;
    b.payoutSettlementId = settlementId;
    b.payoutSettledAt = nowIso;
    db.bookings.set(b.id, b);
  }

  const payoutRecord: SettlementPayoutRecord = {
    id: settlementId,
    salonId: salon.id,
    salonName: salon.name,
    ownerId: salon.ownerId,
    ownerName: owner?.name || 'Partner Owner',
    ownerPhone: salon.phone || owner?.phone || '',
    payoutCycle: salon.payoutCycle || 'weekly',
    amountPaid,
    paymentMethod,
    utrReference,
    notes,
    totalBookingsSettled: unsettledBookings.length,
    bookingIds: unsettledBookings.map((b) => b.id),
    settledAt: nowIso,
    settledByAdminId: req.auth!.user.id,
    settledByAdminName: req.auth!.user.name,
  };

  db.settlementPayouts.set(settlementId, payoutRecord);

  if (owner) {
    owner.settledPayoutAmount = (owner.settledPayoutAmount || 0) + amountPaid;
    owner.lastPayoutDate = nowIso;
    db.users.set(owner.id, owner);

    // In-app notification for owner
    const notifId = `notif_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const ownerNotifs = db.notifications.get(owner.id) || [];
    ownerNotifs.unshift({
      id: notifId,
      userId: owner.id,
      type: 'booking_confirmed',
      title: 'Payout Transferred',
      message: `₹${amountPaid.toLocaleString('en-IN')} payout has been transferred to your UPI/Bank account (Ref: ${utrReference})`,
      read: false,
      createdAt: nowIso,
    });
    db.notifications.set(owner.id, ownerNotifs);
  }

  auditAdmin(req, 'SETTLEMENT_PAYOUT_RELEASED', 'salon', salon.id, {
    settlementId,
    amountPaid,
    paymentMethod,
    utrReference,
    totalBookingsSettled: unsettledBookings.length,
  });

  return res.json({
    success: true,
    message: `₹${amountPaid.toLocaleString('en-IN')} payout successfully released to ${salon.name}`,
    payout: payoutRecord,
  });
});

apiRouter.post('/admin/settlements/whatsapp-alert', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { salonId, phone } = req.body || {};
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ success: false, error: 'Venue not found' });
  }

  const calc = computeSalonSettlement(salon);
  const recipient = (phone || ADMIN_PAYOUT_WHATSAPP).replace(/\D/g, '');

  const messageLines = [
    '🚨 *QGo Payout Due Alert*',
    `*Shop:* ${salon.name} (${salon.category || 'Turf'})`,
    `*Owner:* ${calc.ownerName} (${calc.ownerPhone || 'N/A'})`,
    `*Agreed Cycle:* ${salon.payoutCycle === 'monthly' ? 'Monthly Settlement' : 'Weekly Settlement'}`,
    `*Cycle Period:* ${calc.cyclePeriodLabel}`,
    `*Total Bookings:* ${calc.totalBookings}`,
    `*Total Online Collected:* ₹${calc.totalOnlineCollected.toLocaleString('en-IN')}`,
    `*QGo Fee + GST Retained:* ₹${calc.qgoTotalRetained.toLocaleString('en-IN')} (₹35.40/booking)`,
    `*Exact Net Payable to Owner:* ₹${calc.netOwnerPayable.toLocaleString('en-IN')}`,
    `*Destination:* ${salon.upiId ? `UPI ID: ${salon.upiId}` : salon.accountNumber ? `Bank A/C: ${salon.accountNumber} (${salon.bankName || ''}, IFSC: ${salon.ifscCode || ''})` : 'Pending Registration'}`,
    '',
    'Please transfer the exact amount and confirm UTR reference in Admin Dashboard.',
  ];
  const text = messageLines.join('\n');
  const whatsappUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(text)}`;

  let automatedSent = false;
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: text },
        }),
      });
      automatedSent = true;
    } catch (waErr) {
      console.warn('[WhatsApp Cloud API] Dispatch error:', waErr);
    }
  }

  auditAdmin(req, 'SETTLEMENT_WHATSAPP_ALERT', 'salon', salon.id, {
    recipient,
    netOwnerPayable: calc.netOwnerPayable,
    automatedSent,
  });

  return res.json({
    success: true,
    message: 'WhatsApp payout alert prepared successfully',
    recipient,
    text,
    whatsappUrl,
    automatedSent,
  });
});

// ─── ADMIN 24/7 REMINDER & EXECUTIVE TASK SCHEDULER ENDPOINTS ───

apiRouter.get('/admin/reminders', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const reminders = Array.from(db.adminReminders.values()).sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  return res.json({ success: true, reminders });
});

apiRouter.post('/admin/reminders', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { targetTime, targetDate, scheduledDate, scheduledTime, targetTimestamp, title, note, notifyPhone } = req.body || {};
  if (!targetTime || !title) {
    return res.status(400).json({ success: false, error: 'targetTime and title are required' });
  }

  // Parse target minutes of day (e.g., "12:40 PM" -> 760)
  let targetMinutesOfDay = 0;
  const match = String(targetTime).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = (match[3] || '').toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    targetMinutesOfDay = h * 60 + m;
  }

  const id = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reminder: AdminReminderRecord = {
    id,
    adminId: req.auth?.userId || 'admin',
    targetTime: String(targetTime).trim(),
    targetDate: targetDate || scheduledDate || getLocalDateString(new Date()),
    scheduledDate: scheduledDate || targetDate || getLocalDateString(new Date()),
    scheduledTime: scheduledTime || String(targetTime).trim(),
    targetTimestamp: typeof targetTimestamp === 'number' ? targetTimestamp : undefined,
    targetMinutesOfDay,
    title: String(title).trim(),
    note: note ? String(note).trim() : undefined,
    triggered: false,
    acknowledged: false,
    notifyPhone: (notifyPhone || '9600971886').replace(/\D/g, ''),
    createdAt: new Date().toISOString(),
  };

  db.adminReminders.set(id, reminder);

  auditAdmin(req, 'CREATE_ADMIN_REMINDER', 'reminder', id, {
    targetTime: reminder.targetTime,
    targetDate: reminder.targetDate,
    title: reminder.title,
  });

  return res.json({ success: true, reminder });
});

apiRouter.delete('/admin/reminders/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const exists = db.adminReminders.has(id);
  if (!exists) {
    return res.status(404).json({ success: false, error: 'Reminder not found' });
  }
  db.adminReminders.delete(id);
  auditAdmin(req, 'DELETE_ADMIN_REMINDER', 'reminder', id, {});
  return res.json({ success: true, message: 'Reminder deleted' });
});

// ─── TWILIO CELLULAR VOICE CALL DISPATCHER ───
export async function placeTwilioCellularCall(
  toPhone: string,
  spokenMessage: string
): Promise<{
  success: boolean;
  channel: 'twilio_cellular_call' | 'app_lockscreen_push';
  sid?: string;
  error?: string;
  missingEnv?: string[];
}> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    const missingEnv: string[] = [];
    if (!accountSid) missingEnv.push('TWILIO_ACCOUNT_SID');
    if (!authToken) missingEnv.push('TWILIO_AUTH_TOKEN');
    if (!fromNumber) missingEnv.push('TWILIO_FROM_NUMBER');
    return {
      success: false,
      channel: 'app_lockscreen_push',
      error: 'Twilio cellular credentials not configured in .env',
      missingEnv,
    };
  }

  const cleanDigits = toPhone.replace(/\D/g, '');
  const cleanTo = toPhone.startsWith('+')
    ? toPhone
    : cleanDigits.length === 10
    ? `+91${cleanDigits}`
    : `+${cleanDigits}`;

  const cleanSay = (spokenMessage || 'Attention Kishore, this is an executive notification from Qbe.')
    .replace(/[<>&"']/g, ' ')
    .slice(0, 300);
  const twiml = `<Response><Say voice="alice">Vanakkam Admin, this is Qbe from QGo. ${cleanSay}</Say></Response>`;

  const bodyParams = new URLSearchParams();
  bodyParams.append('To', cleanTo);
  bodyParams.append('From', fromNumber);
  bodyParams.append('Twiml', twiml);

  try {
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data: any = await response.json();
    if (response.ok && data?.sid) {
      console.log(`[Twilio Voice] Outbound cellular call initiated to ${cleanTo}, SID: ${data.sid}`);
      return { success: true, channel: 'twilio_cellular_call', sid: data.sid };
    } else {
      console.warn('[Twilio Voice] Call dispatch failed:', data);
      return { success: false, channel: 'app_lockscreen_push', error: data?.message || 'Twilio call failed' };
    }
  } catch (err: any) {
    console.error('[Twilio Voice] Error calling API:', err);
    return { success: false, channel: 'app_lockscreen_push', error: err.message };
  }
}

apiRouter.post('/admin/reminders/:id/trigger', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const reminder = db.adminReminders.get(id);
  if (!reminder) {
    return res.status(404).json({ success: false, error: 'Reminder not found' });
  }

  reminder.triggered = true;
  reminder.triggeredAt = new Date().toISOString();
  db.adminReminders.set(id, reminder);

  // Trigger cellular SIM call via Twilio
  const twilioResult = await placeTwilioCellularCall(
    reminder.notifyPhone || '9600971886',
    `${reminder.title}. ${reminder.note || 'Scheduled executive reminder from Qbe.'}`
  );

  return res.json({ success: true, reminder, twilioStatus: twilioResult });
});

apiRouter.post('/admin/reminders/:id/acknowledge', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const reminder = db.adminReminders.get(id);
  if (!reminder) {
    return res.status(404).json({ success: false, error: 'Reminder not found' });
  }

  reminder.acknowledged = true;
  reminder.acknowledgedAt = new Date().toISOString();
  db.adminReminders.set(id, reminder);

  return res.json({ success: true, reminder });
});

// 1-Tap Test Call & WhatsApp to 9600971886 (with Real Twilio Cellular Voice Call)
apiRouter.post('/admin/test-qbe-call', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { phone } = req.body || {};
  const recipient = (phone || '9600971886').replace(/\D/g, '');

  const nowIso = new Date().toISOString();
  const testMessage = [
    '🤖 *Qbe Super Admin Executive Test Alert*',
    `*Timestamp:* ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`,
    '*Recipient:* +91 ' + recipient,
    '*Status:* Autonomous 24/7 Watchdog Active & All Systems Nominal',
    '',
    'This is a verified 2-way call & WhatsApp test from QGo Executive Command Center.',
  ].join('\n');

  const whatsappUrl = `https://wa.me/91${recipient}?text=${encodeURIComponent(testMessage)}`;

  // 1. Attempt Twilio Cellular Outbound SIM Voice Call
  const twilioResult = await placeTwilioCellularCall(
    recipient,
    'Attention Kishore, this is a verified test call from Qbe. Your 24/7 autonomous monitoring watchdog, live slot telemetry, and payout alarms are all functioning with zero errors.'
  );

  // 2. Attempt WhatsApp Cloud API automated dispatch if configured
  let automatedSent = false;
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${recipient}`,
          type: 'text',
          text: { body: testMessage },
        }),
      });
      automatedSent = true;
    } catch (waErr) {
      console.warn('[WhatsApp Cloud API] Dispatch error:', waErr);
    }
  }

  auditAdmin(req, 'TEST_QBE_CALL', 'system', 'test', {
    recipient,
    automatedSent,
    twilioChannel: twilioResult.channel,
    twilioSuccess: twilioResult.success,
  });

  return res.json({
    success: true,
    message: twilioResult.success
      ? 'Qbe cellular SIM call placed via Twilio & WhatsApp alert prepared'
      : 'Qbe Test Call & WhatsApp alert prepared',
    recipient: `91${recipient}`,
    whatsappUrl,
    automatedSent,
    deliveryChannel: twilioResult.channel,
    twilioStatus: twilioResult,
    missingTwilioEnv: twilioResult.missingEnv,
    callData: {
      callerName: 'Qbe',
      callerSubtitle: twilioResult.channel === 'twilio_cellular_call'
        ? 'Cellular SIM Call Placed • +91 9600971886'
        : 'QGo Executive AI • Incoming Call',
      title: 'JARVIS Executive Diagnostics Test',
      message: 'Attention Kishore, this is a test call from Qbe. Your 24/7 autonomous monitoring watchdog, live slot telemetry, and payout alarms are all functioning with zero errors.',
      timestamp: nowIso,
    },
  });
});

apiRouter.patch('/admin/users/:id/status', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const targetUser = db.users.get(id);
  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  if (isPlatformAdmin(targetUser)) {
    return res.status(403).json({ success: false, error: 'Cannot block a platform administrator' });
  }

  const isBlocked = Boolean(req.body?.isBlocked);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '';

  targetUser.isBlocked = isBlocked;
  if (isBlocked) {
    targetUser.blockedAt = adminDate();
    targetUser.blockedReason = reason || 'Blocked by administrator';
  } else {
    targetUser.blockedAt = undefined;
    targetUser.blockedReason = undefined;
  }

  db.users.set(targetUser.id, targetUser);

  auditAdmin(req, isBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', 'user', targetUser.id, {
    reason: targetUser.blockedReason,
  });

  return res.json({
    success: true,
    isBlocked: targetUser.isBlocked,
    user: adminProfile(targetUser),
    message: isBlocked ? `Account for ${targetUser.name} has been blocked.` : `Account for ${targetUser.name} has been unblocked.`,
  });
});

apiRouter.get('/admin/venues', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const allBookings = Array.from(db.bookings.values());
  const rows = Array.from(db.salons.values())
    .filter((salon) => adminMatches(salon, req.query.search))
    .filter((salon) => !req.query.status || salon.status === req.query.status)
    .filter((salon) => !req.query.category || salon.category === req.query.category)
    .map((salon) => {
      const owner = db.users.get(salon.ownerId);
      const bookings = allBookings.filter((b) => b.salonId === salon.id);
      const revenue = bookings
        .filter((b) => ['paid', 'partially_paid'].includes(normalizePaymentStatus(b.paymentStatus)))
        .reduce((sum, b) => sum + (b.totalAmount || b.amount || 0), 0);

      return {
        ...salon,
        owner: owner ? adminProfile(owner) : null,
        bookingsCount: bookings.length,
        revenue,
        isTurf: isTurfBusiness(salon.category, salon.bookingMode),
      };
    });

  const page = adminPage(rows, req);
  return res.json({ success: true, venues: page.items, pagination: page.pagination });
});

apiRouter.post('/admin/bookings/:id/cancel', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
    ? req.body.reason.trim().slice(0, 500)
    : 'Cancelled by Super Administrator';

  const paidAmount = booking.paidAmount || booking.amount || 0;
  const wasPaidOnline = ['paid', 'partially_paid'].includes(normalizePaymentStatus(booking.paymentStatus));

  booking.status = 'cancelled';
  booking.cancelledAt = adminDate();
  booking.cancelledBy = 'system';
  booking.cancellationReason = reason;

  if (wasPaidOnline && paidAmount > 0) {
    booking.refundAmount = paidAmount;
    booking.refundPercentage = 100;
    booking.refundStatus = 'completed';
    booking.paymentStatus = 'refunded';
  }

  // Always release slot locks across time increments
  releaseBookingSlotLock(booking);
  db.bookings.set(booking.id, booking);

  // Send notifications to customer & owner
  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: 'cancelled',
    title: 'Booking Cancelled by Admin',
    message: `Your booking #${booking.id.slice(-6)} at ${booking.salonName} was cancelled by QGo administration. ${wasPaidOnline ? `A full refund of ₹${paidAmount} has been processed.` : ''}`,
    bookingId: booking.id,
  });

  const salon = db.salons.get(booking.salonId);
  if (salon?.ownerId) {
    sendNotification(salon.ownerId, {
      userId: salon.ownerId,
      type: 'cancelled',
      title: 'Booking Cancelled by Admin',
      message: `Booking #${booking.id.slice(-6)} (${booking.customerName}) was cancelled by QGo administrator.`,
      bookingId: booking.id,
    });
  }

  auditAdmin(req, 'ADMIN_BOOKING_FORCE_CANCELLED', 'booking', booking.id, {
    reason,
    refundAmount: booking.refundAmount || 0,
  });

  return res.json({
    success: true,
    message: 'Booking cancelled, locks released, and full refund processed',
    booking,
  });
});

let platformSettings = {
  convenienceFee: 30,
  gstPercentage: 18,
  standardTakeRate: 8.8,
  cancellationWindowHours: 2,
  adminEmail: DEFAULT_SUPER_ADMIN_EMAIL,
  smsAlertsOnCancellation: true,
  automatedMidnightSettlement: true,
  escrowWebhookReconciliation: true,
};

apiRouter.get('/admin/settings', requireAuth, requireAdmin, (_req, res) => {
  return res.json({ success: true, settings: platformSettings });
});

apiRouter.patch('/admin/settings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  platformSettings = {
    ...platformSettings,
    ...(typeof req.body?.convenienceFee === 'number' ? { convenienceFee: req.body.convenienceFee } : {}),
    ...(typeof req.body?.gstPercentage === 'number' ? { gstPercentage: req.body.gstPercentage } : {}),
    ...(typeof req.body?.standardTakeRate === 'number' ? { standardTakeRate: req.body.standardTakeRate } : {}),
    ...(typeof req.body?.cancellationWindowHours === 'number' ? { cancellationWindowHours: req.body.cancellationWindowHours } : {}),
    ...(typeof req.body?.smsAlertsOnCancellation === 'boolean' ? { smsAlertsOnCancellation: req.body.smsAlertsOnCancellation } : {}),
    ...(typeof req.body?.automatedMidnightSettlement === 'boolean' ? { automatedMidnightSettlement: req.body.automatedMidnightSettlement } : {}),
    ...(typeof req.body?.escrowWebhookReconciliation === 'boolean' ? { escrowWebhookReconciliation: req.body.escrowWebhookReconciliation } : {}),
  };
  auditAdmin(req, 'PLATFORM_SETTINGS_UPDATED', 'settings', 'global', platformSettings);
  return res.json({ success: true, settings: platformSettings, message: 'Platform settings updated successfully' });
});

// ─── TARGETED BROADCAST ALERTS (Customers Only vs. Owners Only vs. All) ───
const handleBroadcastAlert = (req: AuthenticatedRequest, res: Response) => {
  const { title, message, severity = 'warning', audience = 'all', targetAudience } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Title and message are required' });
  }

  const chosenAudience: 'customers' | 'owners' | 'all' = (targetAudience || audience || 'all') as any;

  let recipients: User[] = [];
  const allUsers = Array.from(db.users.values());

  if (chosenAudience === 'customers') {
    recipients = allUsers.filter((u) => u.role === 'consumer' || (u.role as string) === 'customer');
  } else if (chosenAudience === 'owners') {
    recipients = allUsers.filter(
      (u) => u.role === 'owner' || Array.from(db.salons.values()).some((s) => s.ownerId === u.id)
    );
  } else {
    // all users (both customers and owners)
    recipients = allUsers.filter((u) => u.role === 'consumer' || (u.role as string) === 'customer' || u.role === 'owner');
  }

  const broadcastId = `bcast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  recipients.forEach((user) => {
    sendNotification(user.id, {
      userId: user.id,
      type: 'queue_update',
      title: String(title),
      message: String(message),
      targetAudience: chosenAudience,
      severity: severity || 'warning',
    });
  });

  auditAdmin(req, 'BROADCAST_ALERT_SENT', 'broadcast', broadcastId, {
    title,
    message,
    severity,
    targetAudience: chosenAudience,
    recipientCount: recipients.length,
    sentAt: now,
  });

  return res.json({
    success: true,
    message: `Broadcast alert sent to ${recipients.length} ${chosenAudience === 'customers' ? 'customers' : chosenAudience === 'owners' ? 'owners' : 'users'}`,
    count: recipients.length,
    broadcastId,
    targetAudience: chosenAudience,
  });
};

apiRouter.post('/admin/broadcast', requireAuth, requireAdmin, handleBroadcastAlert);
apiRouter.post('/admin/broadcast-alert', requireAuth, requireAdmin, handleBroadcastAlert);

// ─── FULL PLATFORM BACKUP ALL ENDPOINT ───
const handleExportBackupAll = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exportedAt = new Date().toISOString();
    const confirmedBookings = Array.from(db.bookings.values()).filter((b) => b.status !== 'cancelled');
    const backup = {
      version: '1.0',
      exportedAt,
      exportedBy: req.auth?.user?.email || 'admin',
      counts: {
        users: db.users.size,
        customers: Array.from(db.users.values()).filter((u) => u.role === 'consumer' || (u.role as string) === 'customer').length,
        owners: Array.from(db.users.values()).filter((u) => u.role === 'owner').length,
        venues: db.salons.size,
        services: db.services.size,
        staff: db.staff.size,
        bookings: db.bookings.size,
        reviews: db.reviews.size,
        tickets: db.supportTickets.size,
        settlementPayouts: db.settlementPayouts.size,
        adminReminders: db.adminReminders.size,
        notifications: db.notifications.size,
      },
      data: {
        users: Array.from(db.users.values()),
        userRoles: Array.from(db.userRoles.values()),
        venues: Array.from(db.salons.values()),
        services: Array.from(db.services.values()),
        staff: Array.from(db.staff.values()),
        slots: Array.from(db.slotLocksMap.entries()).map(([key, val]) => ({ key, ...val })),
        bookings: Array.from(db.bookings.values()),
        reviews: Array.from(db.reviews.values()),
        platformLedger: {
          vaultGrossPlatformIncome: Math.round(confirmedBookings.length * 35.40),
          vaultStatutoryGst: Number((confirmedBookings.length * 5.40).toFixed(2)),
          vaultNetRetained: confirmedBookings.length * 30.00,
          totalConfirmedBookings: confirmedBookings.length,
          payouts: Array.from(db.settlementPayouts.values()),
        },
        settlementPayouts: Array.from(db.settlementPayouts.values()),
        tickets: Array.from(db.supportTickets.values()),
        adminAuditLogs: Array.from(db.adminAuditLogs.values()),
        notifications: Array.from(db.notifications.entries()).map(([userId, items]) => ({ userId, items })),
        adminReminders: Array.from(db.adminReminders.values()),
      },
    };

    auditAdmin(req, 'DATABASE_BACKUP_EXPORTED', 'system', '', {
      exportedAt,
      counts: backup.counts,
    });

    const d = new Date();
    const dateStr = d.toISOString().split('T')[0];
    const timeStr = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="QGo-Full-Backup-${dateStr}-${timeStr}.json"`);
    return res.json({ success: true, backup });
  } catch (err: any) {
    console.error('[Backup Export Error]:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to generate database backup' });
  }
};

apiRouter.get('/admin/backup-all', requireAuth, requireAdmin, handleExportBackupAll);
apiRouter.get('/admin/system/export-backup', requireAuth, requireAdmin, handleExportBackupAll);

// ─── COMPLETE DATABASE RESET (CUSTOMER & OWNER WIPE; KISHOREYES VERIFICATION) ───
const handleResetFreshDatabase = async (req: AuthenticatedRequest, res: Response) => {
  const { confirm, adminPassword } = req.body || {};
  if (confirm !== 'RESET_FRESH_DATABASE') {
    return res.status(400).json({
      success: false,
      error: 'Confirmation payload missing or invalid. Must supply { confirm: "RESET_FRESH_DATABASE" }',
    });
  }

  // Mandatory 2-step security verification password: KISHOREYES
  if (adminPassword !== 'KISHOREYES') {
    return res.status(403).json({
      success: false,
      error: 'Invalid master admin authorization password. Action blocked.',
    });
  }

  try {
    const { resetFreshDatabase } = await import('./scripts/resetFreshDb');
    await resetFreshDatabase();

    // Clear operational collections in in-memory db
    db.salons.clear();
    db.bookings.clear();
    db.queueEntries.clear();
    db.reviews.clear();
    db.services.clear();
    db.staff.clear();
    db.supportTickets.clear();
    db.paymentOrders.clear();
    db.adminAuditLogs.clear();
    db.notifications.clear();
    db.slotLocksMap.clear();
    db.queueSequences.clear();
    db.settlementPayouts.clear();
    db.adminReminders.clear();

    // WIPE ALL CUSTOMER AND OWNER ACCOUNTS — RETAINING STRICTLY SUPER ADMIN
    for (const [userId, u] of Array.from(db.users.entries())) {
      const isSuperAdmin =
        (u.role === 'admin' || ADMIN_EMAILS.has(u.email) || u.email === DEFAULT_SUPER_ADMIN_EMAIL) &&
        u.role !== 'consumer' &&
        (u.role as string) !== 'customer' &&
        u.role !== 'owner';
      if (!isSuperAdmin) {
        db.users.delete(userId);
      }
    }
    for (const [roleId, r] of Array.from(db.userRoles.entries())) {
      if (r.role !== 'admin') {
        db.userRoles.delete(roleId);
      }
    }

    auditAdmin(req, 'DATABASE_RESET_FRESH', 'system', '', {
      timestamp: new Date().toISOString(),
      adminEmail: req.auth!.user.email,
    });

    return res.json({
      success: true,
      message: 'Database reset cleanly. All Customer and Owner accounts wiped; Super Admin preserved.',
    });
  } catch (err: any) {
    console.error('Reset fresh DB error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset database cleanly', details: err?.message || err });
  }
};

apiRouter.post('/admin/reset-fresh', requireAuth, requireAdmin, handleResetFreshDatabase);
apiRouter.post('/admin/system/reset-fresh', requireAuth, requireAdmin, handleResetFreshDatabase);

// ─── IN-APP OVER-THE-AIR VERSIONING & ADMIN PUBLISHER ───
let appReleaseConfig = {
  latestVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  apkDownloadUrl: '',
  releaseNotes: '• Initial stable release\n• High-performance turf & salon slot booking\n• Instant QR Match Ticket verification\n• 24/7 Qbe Executive AI Assistant',
  forceUpdate: false,
  updatedAt: new Date().toISOString(),
};

try {
  adminDb.collection('appConfig').doc('release').get().then((doc) => {
    if (doc.exists) {
      const d = doc.data();
      if (d) appReleaseConfig = { ...appReleaseConfig, ...d };
    }
  }).catch(() => {});
} catch {}

apiRouter.get('/app-version', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    ...appReleaseConfig,
  });
});

apiRouter.post('/admin/app-version', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { latestVersion, minSupportedVersion, apkDownloadUrl, releaseNotes, forceUpdate } = req.body || {};
  if (!latestVersion) {
    return res.status(400).json({ success: false, error: 'latestVersion is required' });
  }

  appReleaseConfig = {
    latestVersion: String(latestVersion).trim(),
    minSupportedVersion: minSupportedVersion ? String(minSupportedVersion).trim() : appReleaseConfig.minSupportedVersion,
    apkDownloadUrl: apkDownloadUrl !== undefined ? String(apkDownloadUrl).trim() : appReleaseConfig.apkDownloadUrl,
    releaseNotes: releaseNotes !== undefined ? String(releaseNotes).trim() : appReleaseConfig.releaseNotes,
    forceUpdate: Boolean(forceUpdate),
    updatedAt: new Date().toISOString(),
  };

  try {
    await adminDb.collection('appConfig').doc('release').set(appReleaseConfig, { merge: true });
  } catch (err: any) {
    console.warn('[Firestore AppRelease Warning]:', err?.message || err);
  }

  auditAdmin(req, 'APP_VERSION_PUBLISHED', 'release', appReleaseConfig.latestVersion, appReleaseConfig);

  return res.json({
    success: true,
    message: `App version v${appReleaseConfig.latestVersion} published successfully`,
    release: appReleaseConfig,
  });
});

// ─── BETA BUG REPORT / TICKETS SUBMISSION ───
apiRouter.post('/tickets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { category, description, title, priority = 'medium', attachmentUrl, deviceInfo } = req.body || {};
  if (!description || !category) {
    return res.status(400).json({ success: false, error: 'category and description are required' });
  }

  const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ticket = {
    id: ticketId,
    userId: req.auth!.userId,
    userEmail: req.auth?.user?.email,
    userName: req.auth?.user?.name,
    userRole: req.auth?.user?.role,
    title: title ? String(title).trim() : `Beta Report: ${category}`,
    category: String(category).trim(),
    description: String(description).trim(),
    priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
    status: 'open',
    attachmentUrl: attachmentUrl || null,
    deviceInfo: deviceInfo || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.supportTickets.set(ticketId, ticket);

  return res.status(201).json({
    success: true,
    message: 'Bug report / feedback ticket submitted successfully',
    ticket,
  });
});
apiRouter.get('/admin/businesses', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.salons.values()).filter((salon) => adminMatches(salon, req.query.search)).filter((salon) => !req.query.status || salon.status === req.query.status).filter((salon) => !req.query.category || salon.category === req.query.category).map((salon) => ({ ...salon, owner: db.users.get(salon.ownerId) ? adminProfile(db.users.get(salon.ownerId)!) : null })); const page = adminPage(rows, req); return res.json({ success: true, businesses: page.items, pagination: page.pagination }); });
const approveBusinessUnified = (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ success: false, error: 'Business not found' });
  }

  salon.status = 'approved';
  salon.isPublished = true;
  salon.verified = true;
  salon.setupStep = 8;
  db.salons.set(salon.id, salon);

  auditAdmin(req, 'BUSINESS_APPROVED', 'business', salon.id, {
    reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '',
  });

  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: 'business_approved',
    title: 'Business Approved 🎉',
    message: `Your business ${salon.name} has been approved and is now live.`,
  });

  return res.json({
    success: true,
    message: 'Business approved successfully',
    salon,
    business: salon,
  });
};

const changeBusinessStatus = (status: 'approved' | 'rejected' | 'suspended', action: string) => (req: AuthenticatedRequest, res: Response) => { const salon = db.salons.get(req.params.id); if (!salon) return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' } }); salon.status = status; salon.verified = status === 'approved'; salon.isPublished = status === 'approved'; db.salons.set(salon.id, salon); auditAdmin(req, action, 'business', salon.id, { reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '' }); return res.json({ success: true, business: salon }); };
apiRouter.post('/admin/businesses/:id/approve', requireAuth, requireAdmin, approveBusinessUnified);
apiRouter.post('/admin/businesses/:id/reject', requireAuth, requireAdmin, changeBusinessStatus('rejected', 'BUSINESS_REJECTED'));
apiRouter.post('/admin/businesses/:id/suspend', requireAuth, requireAdmin, changeBusinessStatus('suspended', 'BUSINESS_SUSPENDED'));
apiRouter.get('/admin/bookings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.bookings.values()).filter((booking) => adminMatches(booking, req.query.search)).filter((booking) => !req.query.status || booking.status === req.query.status).filter((booking) => !req.query.paymentStatus || normalizePaymentStatus(booking.paymentStatus) === normalizePaymentStatus(req.query.paymentStatus as string)).map((booking) => ({ ...booking, business: db.salons.get(booking.salonId)?.name || '', owner: db.users.get(db.salons.get(booking.salonId)?.ownerId || '')?.name || '' })); auditAdmin(req, 'BOOKINGS_VIEWED', 'booking'); const page = adminPage(rows, req); return res.json({ success: true, bookings: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/payments', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.bookings.values()).filter((booking) => { const s = normalizePaymentStatus(booking.paymentStatus); return s === 'paid' || s === 'partially_paid' || s === 'pending'; }).map((booking) => ({ paymentId: booking.id, bookingId: booking.id, customer: booking.customerName, amount: booking.amount, provider: 'QGo', status: normalizePaymentStatus(booking.paymentStatus), createdAt: booking.createdAt })); auditAdmin(req, 'PAYMENTS_VIEWED', 'payment'); const page = adminPage(rows, req); return res.json({ success: true, payments: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/refunds', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.bookings.values()).filter((booking: any) => booking.refundAmount || booking.refundStatus).map((booking: any) => ({ refundId: booking.id, bookingId: booking.id, customer: booking.customerName, amount: booking.refundAmount || 0, status: booking.refundStatus || 'not_requested', createdAt: booking.updatedAt || booking.createdAt })); auditAdmin(req, 'REFUNDS_VIEWED', 'refund'); const page = adminPage(rows, req); return res.json({ success: true, refunds: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/reviews', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.reviews.values()).map((review) => ({ ...review, business: db.salons.get(review.salonId)?.name || '', status: 'published' })); const page = adminPage(rows, req); return res.json({ success: true, reviews: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/audit-logs', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const page = adminPage(Array.from(db.adminAuditLogs.values()).sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")), req); return res.json({ success: true, auditLogs: page.items, pagination: page.pagination }); });
const exportCsv = (rows: Record<string, unknown>[]) => { const safe = (value: unknown) => { const text = String(value ?? '').replaceAll('"', '""'); return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`; }; const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => typeof row[key] !== 'object')))); return [columns.join(','), ...rows.map((row) => columns.map((column) => safe(row[column])).join(','))].join('\n'); };
const adminExport = (name: string, records: () => Record<string, unknown>[]) => (req: AuthenticatedRequest, res: Response) => { const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 1000)); const data = records().slice(0, limit); auditAdmin(req, 'DATA_EXPORTED', name, '', { count: data.length }); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="qgo-${name}.csv"`); return res.send(exportCsv(data)); };
apiRouter.get('/admin/export/customers', requireAuth, requireAdmin, adminExport('customers', () => Array.from(db.users.values()).filter((user) => !isPlatformAdmin(user)).map(adminProfile)));
apiRouter.get('/admin/export/businesses', requireAuth, requireAdmin, adminExport('businesses', () => Array.from(db.salons.values()).map((salon) => ({ id: salon.id, name: salon.name, category: salon.category, city: salon.city, status: salon.status, ownerId: salon.ownerId, createdAt: salon.createdAt }))));
apiRouter.get('/admin/export/bookings', requireAuth, requireAdmin, adminExport('bookings', () => Array.from(db.bookings.values()).map((booking) => ({ id: booking.id, customer: booking.customerName, salonId: booking.salonId, service: booking.serviceName, amount: booking.amount, paymentStatus: booking.paymentStatus, bookingStatus: booking.status, createdAt: booking.createdAt }))));

apiRouter.get('/admin/users', requireAuth, requireAdmin, (_req, res) => {
  const bookings = Array.from(db.bookings.values()); const queueEntries = Array.from(db.queueEntries.values());
  return res.json({ success: true, users: Array.from(db.users.values()).map((user) => ({ ...adminProfile(user), bookings: bookings.filter((item) => item.customerId === user.id), queueEntries: queueEntries.filter((item) => db.bookings.get(item.bookingId)?.customerId === user.id) })) });
});
apiRouter.get('/admin/salons', requireAuth, requireAdmin, (_req, res) => res.json({ success: true, salons: Array.from(db.salons.values()).map((salon) => ({ ...salon, owner: db.users.get(salon.ownerId) ? adminProfile(db.users.get(salon.ownerId)!) : null })) }));
apiRouter.patch('/admin/salons/:id/status', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const salon = db.salons.get(req.params.id); const status = req.body?.status;
  if (!salon) return res.status(404).json({ error: 'Salon not found' });
  if (!['draft', 'under_review', 'approved', 'live', 'rejected', 'suspended', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid business status' });
  salon.status = status; salon.verified = ['approved', 'live'].includes(status); salon.isPublished = ['approved', 'live'].includes(status); db.salons.set(salon.id, salon); auditAdmin(req, `BUSINESS_${String(status).toUpperCase()}`, 'business', salon.id);
  return res.json({ success: true, salon });
});
apiRouter.get('/admin/analytics', requireAuth, requireAdmin, (_req, res) => {
  const bookings = Array.from(db.bookings.values()); const queueEntries = Array.from(db.queueEntries.values()); const byDay = new Map<string, any>();
  bookings.forEach((item) => { const date = item.createdAt?.slice(0, 10); const row = byDay.get(date) || { date, bookings: 0, queueEntries: 0 }; row.bookings++; byDay.set(date, row); });
  queueEntries.forEach((item: any) => { const date = item.createdAt?.slice(0, 10); const row = byDay.get(date) || { date, bookings: 0, queueEntries: 0 }; row.queueEntries++; byDay.set(date, row); });
  return res.json({ success: true, totals: { bookings: bookings.length, queueEntries: queueEntries.length }, byDay: Array.from(byDay.values()).sort((a: any, b: any) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-30), byShop: Array.from(db.salons.values()).map((salon) => ({ name: salon.name, bookings: bookings.filter((item) => item.salonId === salon.id).length, queueEntries: queueEntries.filter((item) => item.salonId === salon.id).length })) });
});
apiRouter.get('/admin/tickets', requireAuth, requireAdmin, (_req, res) => res.json({ success: true, tickets: Array.from(db.supportTickets.values()).map(adminTicket) }));
apiRouter.patch('/admin/tickets/:id', requireAuth, requireAdmin, (req, res) => {
  const ticket = db.supportTickets.get(req.params.id); const { status, priority, internalNotes } = req.body || {};
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (status && !['open', 'in_progress', 'resolved', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid ticket status' });
  if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) return res.status(400).json({ error: 'Invalid ticket priority' });
  Object.assign(ticket, { ...(status ? { status } : {}), ...(priority ? { priority } : {}), ...(typeof internalNotes === 'string' ? { internalNotes } : {}), updatedAt: adminDate() }); db.supportTickets.set(ticket.id, ticket); return res.json({ success: true, ticket: adminTicket(ticket) });
});
apiRouter.get('/admin/feature-requests', requireAuth, requireAdmin, (_req, res) => res.json({ success: true, requests: Array.from(db.featureRequests.values()).map(adminRequest) }));
apiRouter.patch('/admin/feature-requests/:id', requireAuth, requireAdmin, (req, res) => {
  const request = db.featureRequests.get(req.params.id); const status = req.body?.status;
  if (!request) return res.status(404).json({ error: 'Feature request not found' });
  if (!['submitted', 'under_review', 'approved', 'in_development', 'implemented', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid request status' });
  request.status = status; request.updatedAt = adminDate(); db.featureRequests.set(request.id, request); return res.json({ success: true, request: adminRequest(request) });
});

apiRouter.post('/support-tickets', requireAuth, validateBody(supportTicketSchema), (req: AuthenticatedRequest, res) => {
  const { category, description, attachmentUrl, priority = 'medium' } = req.body || {};
  if (!category || !description || !['low', 'medium', 'high', 'urgent'].includes(priority)) return res.status(400).json({ error: 'A category, description, and valid priority are required' });
  const ticket = { id: crypto.randomUUID(), userId: req.auth!.userId, category, description, attachmentUrl: attachmentUrl || null, priority, status: 'open', internalNotes: '', createdAt: adminDate(), updatedAt: adminDate() };
  db.supportTickets.set(ticket.id, ticket); return res.status(201).json({ success: true, ticket });
});
apiRouter.get('/support-tickets/mine', requireAuth, (req: AuthenticatedRequest, res) => res.json({ success: true, tickets: Array.from(db.supportTickets.values()).filter((ticket) => ticket.userId === req.auth!.userId) }));
apiRouter.post('/feature-requests', requireAuth, (req: AuthenticatedRequest, res) => {
  const { title, description, category, urgency = 'medium' } = req.body || {};
  if (!title || !description || !category || !['low', 'medium', 'high'].includes(urgency)) return res.status(400).json({ error: 'Title, description, category, and valid urgency are required' });
  const request = { id: crypto.randomUUID(), requesterId: req.auth!.userId, title, description, category, urgency, votesCount: 0, status: 'submitted', createdAt: adminDate(), updatedAt: adminDate() };
  db.featureRequests.set(request.id, request); return res.status(201).json({ success: true, request });
});
apiRouter.post('/feature-requests/:id/vote', requireAuth, (req: AuthenticatedRequest, res) => {
  const request = db.featureRequests.get(req.params.id); if (!request) return res.status(404).json({ error: 'Feature request not found' });
  const key = `${request.id}:${req.auth!.userId}`; if (db.featureRequestVotes.has(key)) return res.status(409).json({ error: 'You have already voted for this request' });
  db.featureRequestVotes.set(key, { requestId: request.id, userId: req.auth!.userId, createdAt: adminDate() }); request.votesCount += 1; request.updatedAt = adminDate(); db.featureRequests.set(request.id, request); return res.json({ success: true, votesCount: request.votesCount });
});

// ----------------------------------------------------
// 2. SALONS & SEARCH
// ----------------------------------------------------

apiRouter.get('/salons', (req: Request, res: Response) => {
  const { search, category, openNow, maxWait } = req.query;

  let salonsList = Array.from(db.salons.values()).filter((s) => s.isPublished);

  // Recalculate live queue stats and real ratings for all
  salonsList.forEach((s) => {
    db.recalculateQueue(s.id);
    const salonReviews = Array.from(db.reviews.values()).filter((r) => r.salonId === s.id);
    s.reviewCount = salonReviews.length;
    s.rating =
      salonReviews.length > 0
        ? Number(
          (
            salonReviews.reduce((sum, r) => sum + r.rating, 0) /
            salonReviews.length
          ).toFixed(1)
        )
        : 0;
  });

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    salonsList = salonsList.filter((s) => {
      const matchSalon = s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const services = Array.from(db.services.values()).filter((srv) => srv.salonId === s.id && srv.isActive);
      const matchService = services.some((srv) => srv.name.toLowerCase().includes(q) || (srv.nameTa && srv.nameTa.toLowerCase().includes(q)));
      return matchSalon || matchService;
    });
  }

  if (category && category !== 'all' && typeof category === 'string') {
    salonsList = salonsList.filter((s) => s.category.toLowerCase().includes(category.toLowerCase()));
  }

  if (maxWait && typeof maxWait === 'string') {
    const wait = parseInt(maxWait, 10);
    if (!isNaN(wait)) {
      salonsList = salonsList.filter((s) => s.estimatedWaitMinutes <= wait);
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=15');
  return res.json({
    success: true,
    salons: salonsList.map((s) => enrichPublicSalon(s)),
    count: salonsList.length,
  });
});

apiRouter.get('/salons/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }
  const includePrivate = false;
  if (!salon.isPublished) {
    return res.status(404).json({ error: 'Salon not found' });
  }

  db.recalculateQueue(id);

  const services = Array.from(db.services.values()).filter((s) => s.salonId === id && s.isActive);
  const staffList = Array.from(db.staff.values()).filter((s) => s.salonId === id && s.isActive);
  const reviews = Array.from(db.reviews.values())
    .filter((r) => r.salonId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  salon.reviewCount = reviews.length;
  salon.rating =
    reviews.length > 0
      ? Number(
        (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      )
      : 0;

  // Current live queue overview
  const waitingEntries = Array.from(db.queueEntries.values())
    .filter((q) => q.salonId === id && (q.status === 'waiting' || q.status === 'calling'))
    .sort((a, b) => a.position - b.position);

  res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=15');
  return res.json({
    success: true,
    salon: includePrivate ? salon : enrichPublicSalon(salon),
    services,
    staff: staffList.map((s) => sanitizeStaff(s, includePrivate)),
    reviews: reviews.map((r) => sanitizeReview(r, includePrivate)),
    queue: {
      length: waitingEntries.length,
      estimatedWaitMinutes: salon.estimatedWaitMinutes,
      entries: includePrivate ? waitingEntries : [],
    },
  });
});

apiRouter.get('/owner/salons', requireAuth, requireOwner, (req: AuthenticatedRequest, res: Response) => {
  const ownerSalons = Array.from(db.salons.values()).filter(
    (s) => s.ownerId === req.auth!.userId
  );
  ownerSalons.forEach((s) => {
    db.recalculateQueue(s.id);
  });
  return res.json({ success: true, salons: ownerSalons, count: ownerSalons.length });
});

// Geocoding Proxy Endpoints (Real OpenStreetMap Nominatim Engine)
apiRouter.get('/geocode/search', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.json({ success: true, results: [] });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
      q.trim()
    )}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'QGo-App/1.0 (https://qgo.app; contact@qgo.app)',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return res.json({ success: false, error: 'Geocoding service unavailable', results: [] });
    }

    const data: any = await response.json();
    const results = Array.isArray(data)
      ? data.map((item: any) => ({
        placeId: item.place_id,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        city:
          item.address?.city ||
          item.address?.town ||
          item.address?.village ||
          item.address?.suburb ||
          item.address?.state_district ||
          '',
        state: item.address?.state || '',
        country: item.address?.country || '',
      }))
      : [];

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error('Geocode search error:', err);
    return res.json({ success: false, error: 'Failed to fetch location suggestions', results: [] });
  }
});

apiRouter.get('/geocode/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon query params required' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(
      lat.toString()
    )}&lon=${encodeURIComponent(lon.toString())}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'QGo-App/1.0 (https://qgo.app; contact@qgo.app)',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return res.json({ success: false, error: 'Reverse geocoding unavailable' });
    }

    const data: any = await response.json();
    const formattedAddress = data.display_name || '';
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.suburb ||
      data.address?.state_district ||
      '';

    return res.json({
      success: true,
      address: formattedAddress,
      city,
      lat: parseFloat(data.lat || lat),
      lon: parseFloat(data.lon || lon),
      details: data.address,
    });
  } catch (err: any) {
    console.error('Reverse geocode error:', err);
    return res.json({ success: false, error: 'Failed to reverse geocode location' });
  }
});

// ── Storage URL Validation Helper ──
// Enforces that image URLs belong to the configured project Firebase Storage bucket.
// A compact image data URL is also accepted as a development fallback when
// Firebase Storage browser CORS prevents a direct upload.
function isValidStorageUrl(url: unknown): { valid: boolean; error?: string } {
  if (url === undefined || url === null || url === '') {
    return { valid: true };
  }
  if (typeof url !== 'string') {
    return { valid: false, error: 'Image must be a valid URL string.' };
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    const inlineImage = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(trimmed);
    const encoded = inlineImage?.[2];
    const decodedBytes = encoded ? Math.floor((encoded.length * 3) / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0) : 0;
    if (!inlineImage || decodedBytes <= 0 || decodedBytes > 650 * 1024) {
      return { valid: false, error: 'Inline image data must be a JPEG, PNG, or WebP image under 650 KB.' };
    }
    return { valid: true };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: 'Image URL exceeds maximum length of 2000 characters.' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Image URL must use secure https protocol.' };
    }

    const bucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
    if (bucket) {
      // Must match our own Storage bucket or approved domain (e.g. Unsplash for defaults)
      const isOurBucket =
        (parsed.hostname === 'firebasestorage.googleapis.com' && (parsed.pathname.startsWith(`/v0/b/${bucket}/`) || parsed.pathname.includes(`/b/${bucket}/`))) ||
        (parsed.hostname === 'storage.googleapis.com' && parsed.pathname.startsWith(`/${bucket}/`)) ||
        (parsed.hostname === bucket) ||
        (parsed.hostname === 'images.unsplash.com');

      if (!isOurBucket) {
        return { valid: false, error: `Image URL must belong to the project Firebase Storage bucket (${bucket}).` };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Malformed image URL.' };
  }
}

function validateSalonImages(body: Record<string, any>): { valid: boolean; error?: string } {
  if (body.logoUrl !== undefined) {
    const res = isValidStorageUrl(body.logoUrl);
    if (!res.valid) return res;
  }
  if (body.coverUrl !== undefined) {
    const res = isValidStorageUrl(body.coverUrl);
    if (!res.valid) return res;
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) {
      return { valid: false, error: 'photos must be an array of image URLs.' };
    }
    for (const photo of body.photos) {
      const res = isValidStorageUrl(photo);
      if (!res.valid) return res;
    }
  }
  if (body.resources !== undefined && Array.isArray(body.resources)) {
    for (const r of body.resources) {
      if (r && r.photoUrl !== undefined) {
        const res = isValidStorageUrl(r.photoUrl);
        if (!res.valid) return res;
      }
    }
  }
  return { valid: true };
}

// Owner registers new salon
apiRouter.post('/salons', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.auth?.user?.isBlocked) {
    return res.status(403).json({ error: 'Your account has been suspended by the administrator. Creating new venues is disabled.' });
  }
  const { name, category, description, logoUrl, coverUrl, address, city, phone, lat, lng } = req.body;
  const ownerId = req.auth!.userId;
  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required' });
  }

  const imgCheck = validateSalonImages(req.body);
  if (!imgCheck.valid) {
    return res.status(400).json({ error: imgCheck.error });
  }

  const id = `salon_${Date.now()}`;
  const joinCode = `SLN${Math.floor(10000 + Math.random() * 90000)}`;
  const pin = Math.floor(100000 + Math.random() * 900000).toString();

  const newSalon: Salon = {
    id,
    ownerId,
    name,
    category: category || 'Other',
    description: description || '',
    logoUrl: logoUrl || '',
    coverUrl: coverUrl || '',
    address,
    city: city || '',
    lat: typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : 0),
    lng: typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : 0),
    phone: phone || '',
    email: req.body.email || '',
    website: req.body.website || '',
    instagram: req.body.instagram || '',
    verified: req.body.verified ?? false,
    isPublished: req.body.isPublished ?? false,
    status: req.body.status || 'draft',
    setupStep: req.body.setupStep || 1,
    enableQueue: req.body.enableQueue ?? false,
    bookingMode: req.body.bookingMode || (isTurfBusiness(category) ? 'resource_slot' : 'appointment'),
    resources: req.body.resources || undefined,
    turfSchedule: req.body.turfSchedule || undefined,
    startingPrice: typeof req.body.startingPrice === 'number' ? req.body.startingPrice : undefined,
    bookingSettings: req.body.bookingSettings || {
      advanceBookingDays: 7,
      minNoticeMinutes: 60,
      cancellationAllowed: true,
      cancellationDeadlineHours: 2,
      customerChoosesStaff: false,
    },
    joinCode,
    pin,
    rating: 0,
    reviewCount: 0,
    queueLength: 0,
    estimatedWaitMinutes: 0,
    workingHours: req.body.workingHours || [
      { dayOfWeek: 0, dayName: 'Sunday', openTime: '09:00', closeTime: '21:00', isOpen: false },
      { dayOfWeek: 1, dayName: 'Monday', openTime: '09:00', closeTime: '21:00', isOpen: true },
      { dayOfWeek: 2, dayName: 'Tuesday', openTime: '09:00', closeTime: '21:00', isOpen: true },
      { dayOfWeek: 3, dayName: 'Wednesday', openTime: '09:00', closeTime: '21:00', isOpen: true },
      { dayOfWeek: 4, dayName: 'Thursday', openTime: '09:00', closeTime: '21:00', isOpen: true },
      { dayOfWeek: 5, dayName: 'Friday', openTime: '09:00', closeTime: '21:00', isOpen: true },
      { dayOfWeek: 6, dayName: 'Saturday', openTime: '09:00', closeTime: '21:00', isOpen: true },
    ],
    holidays: req.body.holidays || [],
    createdAt: new Date().toISOString(),
  };

  db.salons.set(id, newSalon);

  // Grant owner role if not already set
  const user = db.users.get(ownerId);
  if (user) {
    user.salonId = id;
    user.role = 'owner';
  }
  // Ensure owner role record exists
  const ownerRoleExists = Array.from(db.userRoles.values()).find(
    (r) => r.userId === ownerId && r.role === 'owner'
  );
  if (!ownerRoleExists) {
    const roleId = `rm_${crypto.randomUUID()}`;
    db.userRoles.set(roleId, { id: roleId, userId: ownerId, role: 'owner', status: 'active', businessId: id });
  }

  return res.status(201).json({ success: true, salon: newSalon });
});

apiRouter.post('/owner/onboard-business', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.auth?.user?.isBlocked) {
    return res.status(403).json({ error: 'Your account has been suspended by the administrator.' });
  }

  const {
    category,
    name,
    description,
    city,
    address,
    latitude,
    longitude,
    phone,
    openingTime,
    closingTime,
    price,
    slotDurationMinutes,
    payoutCycle,
    upiId,
    bankAccountHolder,
    bankName,
    accountNumber,
    ifscCode,
    payoutAgreementAccepted,
    payoutAgreementAcceptedAt,
  } = req.body || {};

  if (!name || !city || !address) {
    return res.status(400).json({ success: false, error: 'Venue name, city, and address are required' });
  }

  const user = req.auth!.user;
  const ownerId = user.id;
  const isTurf = category === 'Turf' || category === 'Sports' || isTurfBusiness(category);
  const salonId = `salon_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const joinCode = `SLN${Math.floor(10000 + Math.random() * 90000)}`;
  const pin = Math.floor(100000 + Math.random() * 900000).toString();

  const latNum = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : (latitude ? parseFloat(latitude) : 11.5034);
  const lngNum = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : (longitude ? parseFloat(longitude) : 77.2444);
  const numericPrice = Number(price) > 0 ? Number(price) : (isTurf ? 1200 : 250);

  const newSalon: Salon = {
    id: salonId,
    ownerId,
    name: String(name).trim(),
    category: isTurf ? 'Turf' : 'Salon',
    description: String(description || '').trim(),
    logoUrl: '',
    coverUrl: '',
    address: String(address).trim(),
    city: String(city).trim(),
    lat: latNum,
    lng: lngNum,
    phone: phone ? String(phone).trim() : (user.phone || ''),
    email: user.email || '',
    website: '',
    instagram: '',
    verified: true,
    isPublished: true,
    status: 'approved',
    setupStep: 5,
    enableQueue: !isTurf,
    bookingMode: isTurf ? 'resource_slot' : 'appointment',
    startingPrice: numericPrice,
    joinCode,
    pin,
    rating: 5.0,
    reviewCount: 0,
    queueLength: 0,
    estimatedWaitMinutes: 0,
    bookingSettings: {
      advanceBookingDays: 30,
      minNoticeMinutes: 30,
      cancellationAllowed: true,
      cancellationDeadlineHours: 2,
      refundPercentage: 70,
      reminderMinutesBefore: 30,
      customerChoosesStaff: false,
    },
    resources: isTurf
      ? [
          {
            id: `res_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
            salonId,
            name: 'Pitch 1 (Main Court)',
            type: 'turf',
            capacity: 14,
            pricePerHour: numericPrice,
            isActive: true,
          },
        ]
      : undefined,
    workingHours: [
      { dayOfWeek: 0, dayName: 'Sunday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
      { dayOfWeek: 1, dayName: 'Monday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
      { dayOfWeek: 2, dayName: 'Tuesday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
      { dayOfWeek: 3, dayName: 'Wednesday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
      { dayOfWeek: 4, dayName: 'Thursday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
      { dayOfWeek: 5, dayName: 'Friday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
      { dayOfWeek: 6, dayName: 'Saturday', openTime: openingTime || '06:00', closeTime: closingTime || '23:00', isOpen: true },
    ],
    holidays: [],
    payoutCycle: (payoutCycle === 'monthly' ? 'monthly' : 'weekly') as 'weekly' | 'monthly',
    upiId: typeof upiId === 'string' ? upiId.trim() : '',
    bankAccountHolder: typeof bankAccountHolder === 'string' ? bankAccountHolder.trim() : '',
    bankName: typeof bankName === 'string' ? bankName.trim() : '',
    accountNumber: typeof accountNumber === 'string' ? accountNumber.trim() : '',
    ifscCode: typeof ifscCode === 'string' ? ifscCode.trim().toUpperCase() : '',
    payoutAgreementAccepted: payoutAgreementAccepted !== false,
    payoutAgreementAcceptedAt: payoutAgreementAcceptedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.salons.set(salonId, newSalon);

  // Default service entry
  const serviceId = `srv_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  db.services.set(serviceId, {
    id: serviceId,
    salonId,
    name: isTurf ? 'Court Booking (1 Hour)' : 'General Service',
    category: isTurf ? 'Turf' : 'Haircut',
    price: numericPrice,
    durationMinutes: slotDurationMinutes || (isTurf ? 60 : 30),
    isActive: true,
  });

  // Assign 'owner' role to user
  const existingOwnerRole = Array.from(db.userRoles.values()).find(
    (r) => r.userId === ownerId && r.role === 'owner'
  );
  if (!existingOwnerRole) {
    const roleId = `ro_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    db.userRoles.set(roleId, {
      id: roleId,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      businessId: salonId,
    });
  }

  user.salonId = salonId;
  user.role = 'owner';
  user.activeRole = 'owner';

  const updatedAuthUser = buildAuthenticatedUser(user, 'owner', req.auth!.claims);

  return res.status(201).json({
    success: true,
    salon: newSalon,
    user: updatedAuthUser,
  });
});

// Update salon settings / details
apiRouter.patch('/salons/:id', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const imgCheck = validateSalonImages(req.body);
  if (!imgCheck.valid) {
    return res.status(400).json({ error: imgCheck.error });
  }

  const {
    ownerId: _ownerId,
    id: _id,
    pin: _pin,
    verified: _verified,
    rating: _rating,
    reviewCount: _reviewCount,
    queueLength: _queueLength,
    estimatedWaitMinutes: _estimatedWaitMinutes,
    status: requestedStatus,
    isPublished: requestedIsPublished,
    ...safeUpdates
  } = req.body;

  const isAdminCaller = req.auth!.role === 'admin' || isPlatformAdmin(req.auth!.user, req.auth!.claims);
  if (isAdminCaller) {
    if (requestedStatus && ['approved', 'live', 'suspended', 'rejected', 'under_review', 'draft'].includes(requestedStatus)) {
      salon.status = requestedStatus;
      if (requestedStatus === 'approved' || requestedStatus === 'live') {
        salon.isPublished = true;
        salon.verified = true;
      } else if (['draft', 'rejected', 'suspended'].includes(requestedStatus)) {
        salon.isPublished = false;
      }
    }
    if (typeof requestedIsPublished === 'boolean') {
      salon.isPublished = requestedIsPublished;
    }
    if (typeof req.body.verified === 'boolean') {
      salon.verified = req.body.verified;
    }
  }

  Object.assign(salon, safeUpdates);

  if (safeUpdates.latitude !== undefined) {
    salon.lat = Number(safeUpdates.latitude);
  }
  if (safeUpdates.longitude !== undefined) {
    salon.lng = Number(safeUpdates.longitude);
  }
  if (safeUpdates.lat !== undefined) {
    salon.lat = Number(safeUpdates.lat);
  }
  if (safeUpdates.lng !== undefined) {
    salon.lng = Number(safeUpdates.lng);
  }

  // Move to pending review when owner completes final onboarding step
  const setupStep = Number(safeUpdates.setupStep);
  const totalSteps = salon.category && (salon.category.toLowerCase().includes('turf') || salon.category.toLowerCase().includes('football') || salon.category.toLowerCase().includes('cricket') || salon.category.toLowerCase().includes('sports')) ? 7 : 8;
  if (setupStep >= totalSteps && salon.status === 'draft') {
    salon.status = 'under_review';
  }

  db.salons.set(id, salon);

  return res.json({ success: true, salon });
});

// Admin approves business
apiRouter.post('/admin/salons/:id/approve', requireAuth, requireAdmin, approveBusinessUnified);


// Remove a venue photo by index
apiRouter.delete('/salons/:id/photos/:index', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id, index } = req.params;
  const salon = db.salons.get(id);
  if (!salon) return res.status(404).json({ error: 'Salon not found' });
  if (!canManageSalon(req.auth, id)) return forbidden(res);

  const idx = parseInt(index, 10);
  if (!salon.photos || idx < 0 || idx >= salon.photos.length) {
    return res.status(400).json({ error: 'Invalid photo index' });
  }

  salon.photos = salon.photos.filter((_, i) => i !== idx);
  return res.json({ success: true, salon });
});



// ----------------------------------------------------
// 3. SERVICES & STAFF MANAGEMENT
// ----------------------------------------------------

apiRouter.post('/salons/:id/services', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id: salonId } = req.params;
  const { name, nameTa, price, durationMinutes, category, description } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  if (!name || price === undefined || price === null || Number.isNaN(Number(price)) || Number(price) < 0 || !durationMinutes) {
    return res.status(400).json({ error: 'Name, valid non-negative price, and duration are required' });
  }

  const srvId = `srv_${Date.now()}`;
  const service: Service = {
    id: srvId,
    salonId,
    name,
    nameTa,
    price: Number(price),
    durationMinutes: Number(durationMinutes),
    category: category || 'Hair',
    description,
    isActive: true,
  };

  db.services.set(srvId, service);
  return res.status(201).json({ success: true, service });
});

apiRouter.patch('/services/:id', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const service = db.services.get(id);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  if (!canManageSalon(req.auth, service.salonId)) {
    return forbidden(res);
  }

  const { id: _id, salonId, ...safeUpdates } = req.body;
  Object.assign(service, safeUpdates);
  return res.json({ success: true, service });
});

apiRouter.delete('/services/:id', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const service = db.services.get(id);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  if (!canManageSalon(req.auth, service.salonId)) {
    return forbidden(res);
  }

  service.isActive = false; // soft delete
  return res.json({ success: true, message: 'Service deactivated' });
});

apiRouter.post('/salons/:id/staff', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res: Response) => {
  const { id: salonId } = req.params;
  const { name, title, photoUrl, serviceIds, phone } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  if (!name) {
    return res.status(400).json({ error: 'Staff name is required' });
  }

  if (photoUrl !== undefined) {
    const imgCheck = isValidStorageUrl(photoUrl);
    if (!imgCheck.valid) {
      return res.status(400).json({ error: imgCheck.error });
    }
  }

  const validServiceIds = Array.isArray(serviceIds)
    ? serviceIds.filter((serviceId) => {
      const service = db.services.get(serviceId);
      return service && service.salonId === salonId;
    })
    : [];
  const linkedUser =
    typeof phone === 'string'
      ? Array.from(db.users.values()).find((u) => u.phone === phone)
      : undefined;

  const stId = `staff_${Date.now()}`;
  const staffMember: Staff = {
    id: stId,
    salonId,
    userId: linkedUser?.id,
    name,
    phone: typeof phone === 'string' ? phone : undefined,
    title: title || 'Stylist',
    photoUrl: photoUrl || undefined,
    rating: 5.0,
    reviewCount: 0,
    serviceIds: validServiceIds,
    status: 'available',
    isActive: true,
  };

  db.staff.set(stId, staffMember);

  return res.status(201).json({ success: true, staff: staffMember });
});

apiRouter.patch('/staff/:id/status', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isValidStaffStatus(status)) {
    return res.status(400).json({ error: 'Invalid staff status' });
  }

  const staffMember = db.staff.get(id);
  if (!staffMember) {
    return res.status(404).json({ error: 'Staff member not found' });
  }
  if (!canManageSalon(req.auth, staffMember.salonId)) {
    return forbidden(res);
  }

  staffMember.status = status;
  db.recalculateQueueStats(staffMember.salonId);

  return res.json({ success: true, staff: staffMember });
});

apiRouter.get('/staff/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId;
  const staffMember = Array.from(db.staff.values()).find((s) => s.userId === userId);
  if (!staffMember) {
    return res.json({ success: false, error: 'No staff assignment found' });
  }
  const salon = db.salons.get(staffMember.salonId);
  return res.json({ success: true, staff: staffMember, salon: salon || undefined });
});

// ----------------------------------------------------
// 4. AVAILABILITY ENGINE & TIME SLOTS (SALONS & TURFS)
// ----------------------------------------------------

function calculateTurfSlotsForDate(
  salon: Salon,
  queryDate: string,
  targetResourceId?: string
): {
  isOpen: boolean;
  message?: string;
  dayName: string;
  slots: GeneratedTurfSlot[];
  resources: TurfResource[];
} {
  const resources: TurfResource[] =
    salon.resources && salon.resources.length > 0
      ? salon.resources.filter((r) => r.isActive)
      : [{ id: 'turf_1', salonId: salon.id, name: 'Turf 1', type: 'Multi-purpose', isActive: true }];

  const activeResourceId = targetResourceId && targetResourceId !== 'all' ? targetResourceId : resources[0]?.id;
  const currentResource = resources.find((r) => r.id === activeResourceId) || resources[0];

  // 1. Find schedule configuration for this resource or default schedule
  const schedules = salon.turfSchedule || [];
  let resourceSchedule = schedules.find((s) => {
    if (s.validFrom && queryDate < s.validFrom) return false;
    if (s.validTo && queryDate > s.validTo) return false;
    return s.resourceId === activeResourceId;
  });

  let isDefaultScheduleFallback = false;
  if (!resourceSchedule) {
    resourceSchedule =
      schedules.find((s) => s.resourceId === activeResourceId && !s.validFrom && !s.validTo) ||
      schedules.find((s) => (s.resourceId === 'default' || !s.resourceId) && !s.validFrom && !s.validTo) ||
      schedules[0];
    isDefaultScheduleFallback = true;
  }

  const dateObj = new Date(queryDate + 'T00:00:00Z');
  
  // Advance Booking Window: Check calendar-day difference in IST against advanceBookingDays
  const advanceBookingDays = salon.bookingSettings?.advanceBookingDays || 30;
  const todayString = getLocalDateString(new Date());
  const todayDateObj = new Date(todayString + 'T00:00:00Z');
  const diffDays = Math.ceil((dateObj.getTime() - todayDateObj.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > advanceBookingDays) {
    return {
      isOpen: false,
      message: 'Not Yet Open',
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getUTCDay()],
      slots: [],
      resources
    };
  }
  const dayOfWeek = dateObj.getUTCDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeek];

  // 2. Check special date overrides (holidays or special hours)
  const specialDate = resourceSchedule?.specialDates?.find((sd) => sd.date === queryDate) ||
    salon.holidays?.find((h) => {
      const endDate = (h as any).endDate || h.date;
      return queryDate >= h.date && queryDate <= endDate;
    });

  if (specialDate && ('isClosed' in specialDate ? specialDate.isClosed : true)) {
    return {
      isOpen: false,
      message: ('reason' in specialDate ? specialDate.reason : undefined) || 'Closed on this special date',
      dayName,
      slots: [],
      resources,
    };
  }

  // 3. Find day config from turf schedule or fallback to workingHours
  const dayConfig = resourceSchedule?.days?.find((d) => d.dayOfWeek === dayOfWeek);
  const fallbackHours = salon.workingHours?.find((h) => h.dayOfWeek === dayOfWeek);

  const isOpen = dayConfig ? dayConfig.isOpen : (fallbackHours ? fallbackHours.isOpen : true);
  if (!isOpen) {
    return {
      isOpen: false,
      message: 'Closed on this day',
      dayName,
      slots: [],
      resources,
    };
  }

  const openTime = specialDate && 'openTime' in specialDate && specialDate.openTime
    ? specialDate.openTime
    : dayConfig?.openTime || fallbackHours?.openTime || '06:00';
  const closeTime = specialDate && 'closeTime' in specialDate && specialDate.closeTime
    ? specialDate.closeTime
    : dayConfig?.closeTime || fallbackHours?.closeTime || '23:00';

  const durationMinutes = specialDate && 'slotDurationMinutes' in specialDate && specialDate.slotDurationMinutes
    ? specialDate.slotDurationMinutes
    : dayConfig?.slotDurationMinutes || 60;
  const defaultPrice = specialDate && 'price' in specialDate && specialDate.price
    ? specialDate.price
    : dayConfig?.defaultPrice || currentResource?.pricePerHour || salon.startingPrice || 800;

  const bufferMinutes = dayConfig?.bufferMinutes || salon.bookingSettings?.bufferMinutes || 0;
  const breaks = (specialDate && 'breaks' in specialDate && specialDate.breaks) || dayConfig?.breaks || [];
  const peakPricing = dayConfig?.peakPricing || [];
  const timePricingPeriods = dayConfig?.timePricingPeriods || [];
  const customSlots = dayConfig?.customSlots || [];
  const slotOverrides = dayConfig?.slotOverrides || [];
  const disabledSlots = dayConfig?.disabledSlots || [];

  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);
  const effectiveCloseMinutes = closeMinutes <= openMinutes ? closeMinutes + 1440 : closeMinutes;

  // 4. Fetch confirmed/in_progress bookings on this date for this specific resource
  const existingBookings = Array.from(db.bookings.values()).filter(
    (b) =>
      b.salonId === salon.id &&
      b.scheduledDate === queryDate &&
      (b.resourceId === activeResourceId || (!b.resourceId && resources.length === 1)) &&
      b.status !== 'cancelled' &&
      b.status !== 'no_show'
  );

  const now = new Date();
  const todayStr = getLocalDateString(now);
  const isToday = queryDate === todayStr;
  const currentMinutesToday = getLocalMinutes(now);
  const minNoticeMinutes = salon.bookingSettings?.minNoticeMinutes || 0;

  const generatedSlots: GeneratedTurfSlot[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // SLOT SYNC RULE: OWNER CREATES → CUSTOMER SEES THE EXACT SAME SLOT.
  //
  // Priority order:
  //   1. If dayConfig.slots[] is present (owner used the slot builder) → serve ONLY those.
  //   2. If owner HAS a turfSchedule but this day has no slots[] → return empty.
  //      (Owner may have configured open/close but not generated slots yet, or chose no slots for this day.)
  //   3. ONLY if the business has NO turfSchedule at all → fall back to auto-generation
  //      (for legacy or non-turf-builder businesses with only workingHours).
  // ─────────────────────────────────────────────────────────────────────────────

  // CASE 1 — Owner's explicit slot list (most common for turf builder)
  if (dayConfig?.slots && dayConfig.slots.length > 0) {
    for (const slotItem of dayConfig.slots) {
      // Only ACTIVE slots are visible to customers (disabled = hidden)
      if (slotItem.status === 'disabled') {
        continue;
      }

      const startM = timeToMinutes(slotItem.startTime);
      const endM = timeToMinutes(slotItem.endTime);

      // Check if slot falls in any break period
      const inBreak = breaks.some((brk) => {
        let bStart = timeToMinutes(brk.startTime);
        let bEnd = timeToMinutes(brk.endTime);
        if (bEnd <= bStart) bEnd += 1440;
        let sStart = startM;
        let sEnd = endM;
        if (sEnd <= sStart) sEnd += 1440;
        return sStart < bEnd && sEnd > bStart;
      });
      if (inBreak) continue;

      // Check booking status
      const matchingBooking = existingBookings.find((b) => {
        const bStart = timeToMinutes(b.scheduledTime || '00:00');
        const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || slotItem.durationMinutes);
        let normalizedEnd = bEnd;
        if (normalizedEnd <= bStart) normalizedEnd += 1440;
        let sStart = startM;
        if (sStart < 480 && bStart > 720) sStart += 1440;
        let normalizedBStart = bStart;
        if (normalizedBStart < 480 && sStart > 720) normalizedBStart += 1440;
        return sStart >= normalizedBStart && sStart < normalizedEnd;
      });

      const GRACE_PERIOD = 10;
      const normalizedSlotStart = (effectiveCloseMinutes > 1440 && startM < openMinutes) ? startM + 1440 : startM;
      const normalizedCurrentM = (effectiveCloseMinutes > 1440 && currentMinutesToday < openMinutes) ? currentMinutesToday + 1440 : currentMinutesToday;
      const isPast = isToday && ((normalizedSlotStart + GRACE_PERIOD) <= normalizedCurrentM + minNoticeMinutes);
      const isBooked = Boolean(matchingBooking) || db.isSlotLocked(salon.id, activeResourceId, queryDate, slotItem.startTime);
      const isBlocked = slotItem.status === 'blocked' || disabledSlots.includes(slotItem.startTime);
      const available = !isPast && !isBooked && !isBlocked;
      
      let status: 'available' | 'booked' | 'blocked' | 'disabled' | 'closed' | 'completed' = isBooked ? 'booked' : (isBlocked ? 'blocked' : (available ? 'available' : 'disabled'));
      
      const isPastDate = queryDate < todayStr;
      const isPastSlot = isPastDate || isPast;
      
      if (matchingBooking && (matchingBooking.status === 'completed' || matchingBooking.slotStatus === 'completed' || isPastSlot)) {
        status = 'completed';
      } else if (isPastSlot && !isBooked) {
        status = 'closed';
      }

      generatedSlots.push({
        id: `${activeResourceId}_${slotItem.startTime}_${slotItem.endTime}`,
        startTime: slotItem.startTime,
        endTime: slotItem.endTime,
        durationMinutes: slotItem.durationMinutes,
        price: slotItem.price,
        isPeak: slotItem.isPeak,
        isCustom: slotItem.source === 'custom',
        paymentType: slotItem.paymentType,
        advanceAmount: slotItem.advanceAmount,
        label: slotItem.label,
        periodType: slotItem.periodType || (timeToMinutes(slotItem.startTime) < 1080 && timeToMinutes(slotItem.startTime) >= 360 ? 'day' : 'night'),
        available,
        isBooked,
        isBlocked,
        status,
        bookingId: matchingBooking?.id,
        customerName: matchingBooking?.customerName,
        customerPhone: matchingBooking?.customerPhone,
        paymentStatus: matchingBooking?.paymentStatus,
        bookingStatus: matchingBooking?.status,
        bookingCreatedAt: matchingBooking?.createdAt,
        resourceId: activeResourceId,
        resourceName: currentResource.name,
      });
    }
  } else if (resourceSchedule) {
    // CASE 2 — Owner has a turfSchedule but this day's slots[] is empty.
    // Never auto-generate — owner hasn't configured slots for this day.
    // generatedSlots stays empty → customer sees "No slots available".
  } else {
    // CASE 3 — Generate regular automatic slots dynamically (Legacy/Fallback)
    const allowPartial = dayConfig?.allowPartialSlot ?? false;

    for (let startOffset = openMinutes; startOffset < effectiveCloseMinutes; startOffset += durationMinutes + bufferMinutes) {
      let endOffset = startOffset + durationMinutes;

      // Partial slot check before closing
      if (endOffset > effectiveCloseMinutes) {
        if (allowPartial && effectiveCloseMinutes - startOffset >= 15) {
          endOffset = effectiveCloseMinutes; // Partial slot takes remainder
        } else {
          break; // Do NOT create slot exceeding closing time
        }
      }

      const actualDuration = endOffset - startOffset;
      const startM = startOffset % 1440;
      const endM = endOffset % 1440;
      const startTimeStr = minutesToTime(startM);
      const endTimeStr = minutesToTime(endM);

      // Check if slot falls in any break period
      const inBreak = breaks.some((brk) => {
        let bStart = timeToMinutes(brk.startTime);
        let bEnd = timeToMinutes(brk.endTime);
        if (bEnd <= bStart) bEnd += 1440;
        if (bStart < openMinutes) {
          bStart += 1440;
          bEnd += 1440;
        }
        return startOffset < bEnd && endOffset > bStart;
      });
      if (inBreak) continue;

      // Check if explicitly disabled or blocked
      const isExplicitlyDisabled = disabledSlots.includes(startTimeStr) ||
        slotOverrides.some((so) => (so.startTime === startTimeStr || so.slotKey === startTimeStr) && so.isDisabled);
      if (isExplicitlyDisabled) continue;

      // Determine price
      let slotPrice = defaultPrice;
      let isPeak = false;

      // Check time pricing periods
      const activePeriods = timePricingPeriods.filter((p) => p.isActive !== false);
      if (activePeriods.length > 0) {
        const matchingPeriod = activePeriods.find((tp) => {
          const pStart = timeToMinutes(tp.startTime);
          const pEnd = timeToMinutes(tp.endTime);
          if (pStart === pEnd) return true;
          if (pEnd > pStart) {
            return startM >= pStart && startM < pEnd;
          } else {
            return startM >= pStart || startM < pEnd;
          }
        });
        if (matchingPeriod) {
          slotPrice = matchingPeriod.price;
          if (matchingPeriod.name.toLowerCase().includes('peak') || matchingPeriod.name.toLowerCase().includes('prime')) {
            isPeak = true;
          }
        }
      } else if (peakPricing.length > 0) {
        const peakRule = peakPricing.find((p) => {
          let pStart = timeToMinutes(p.startTime);
          let pEnd = timeToMinutes(p.endTime);
          if (pEnd <= pStart) pEnd += 1440;
          if (pStart < openMinutes) {
            pStart += 1440;
            pEnd += 1440;
          }
          return startOffset >= pStart && startOffset < pEnd;
        });
        if (peakRule) {
          slotPrice = peakRule.price;
          isPeak = true;
        }
      }

      // Check slot override price
      const override = slotOverrides.find((so) => so.startTime === startTimeStr || so.slotKey === startTimeStr);
      if (override && override.price !== undefined) {
        slotPrice = override.price;
      }

      // Check past time if today
      const GRACE_PERIOD = 10;
      const normalizedSlotStart = (effectiveCloseMinutes > 1440 && startM < openMinutes) ? startM + 1440 : startM;
      const normalizedCurrentM = (effectiveCloseMinutes > 1440 && currentMinutesToday < openMinutes) ? currentMinutesToday + 1440 : currentMinutesToday;
      const isPast = isToday && ((normalizedSlotStart + GRACE_PERIOD) <= normalizedCurrentM + minNoticeMinutes);

      // Check if booked by an existing booking on this specific resource
      const matchingBooking = existingBookings.find((b) => {
        const bStart = timeToMinutes(b.scheduledTime || '00:00');
        const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || actualDuration);
        let normalizedEnd = bEnd;
        if (normalizedEnd <= bStart) normalizedEnd += 1440;
        let sStart = startM;
        if (sStart < 480 && bStart > 720) sStart += 1440;
        let normalizedBStart = bStart;
        if (normalizedBStart < 480 && sStart > 720) normalizedBStart += 1440;
        return sStart >= normalizedBStart && sStart < normalizedEnd;
      });

      const isBooked = Boolean(matchingBooking) || db.isSlotLocked(salon.id, activeResourceId, queryDate, startTimeStr);
      const isBlocked = override?.isDisabled || false;
      const available = !isPast && !isBooked && !isBlocked;
      const status = matchingBooking?.status === 'completed' || matchingBooking?.slotStatus === 'completed'
        ? 'completed'
        : isBooked ? 'booked' : (isBlocked ? 'blocked' : (available ? 'available' : 'disabled'));

      generatedSlots.push({
        id: `${activeResourceId}_${startTimeStr}_${endTimeStr}`,
        startTime: startTimeStr,
        endTime: endTimeStr,
        durationMinutes: actualDuration,
        price: slotPrice,
        isPeak,
        paymentType: 'BOTH',
        advanceAmount: Math.floor(slotPrice * 0.2), // Fallback logic for legacy auto-slots
        periodType: timeToMinutes(startTimeStr) < 1080 && timeToMinutes(startTimeStr) >= 360 ? 'day' : 'night',
        available,
        isBooked,
        isBlocked,
        status,
        bookingId: matchingBooking?.id,
        customerName: matchingBooking?.customerName,
        customerPhone: matchingBooking?.customerPhone,
        paymentStatus: matchingBooking?.paymentStatus,
        bookingStatus: matchingBooking?.status,
        bookingCreatedAt: matchingBooking?.createdAt,
        resourceId: activeResourceId,
        resourceName: currentResource.name,
      });
    }

    // 6. Integrate custom slots for this day/resource
    for (const cs of customSlots) {
      if (!cs.isActive) continue;
      if (cs.resourceId && cs.resourceId !== 'all' && cs.resourceId !== activeResourceId) continue;
      if (cs.daysOfWeek && !cs.daysOfWeek.includes(dayOfWeek)) continue;

      const cStart = timeToMinutes(cs.startTime);
      const cEnd = timeToMinutes(cs.endTime);
      const cDuration = cs.durationMinutes || (cEnd - cStart);

      const GRACE_PERIOD = 10;
      const normalizedSlotStart = (effectiveCloseMinutes > 1440 && cStart < openMinutes) ? cStart + 1440 : cStart;
      const normalizedCurrentM = (effectiveCloseMinutes > 1440 && currentMinutesToday < openMinutes) ? currentMinutesToday + 1440 : currentMinutesToday;
      const isPast = isToday && ((normalizedSlotStart + GRACE_PERIOD) <= normalizedCurrentM + minNoticeMinutes);
      const matchingBooking = existingBookings.find((b) => {
        const bStart = timeToMinutes(b.scheduledTime || '00:00');
        const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || cDuration);
        let normalizedEnd = bEnd;
        if (normalizedEnd <= bStart) normalizedEnd += 1440;
        let sStart = cStart;
        if (sStart < 480 && bStart > 720) sStart += 1440;
        let normalizedBStart = bStart;
        if (normalizedBStart < 480 && sStart > 720) normalizedBStart += 1440;
        return sStart >= normalizedBStart && sStart < normalizedEnd;
      });

      const isBooked = Boolean(matchingBooking) || db.isSlotLocked(salon.id, activeResourceId, queryDate, cs.startTime);
      const available = !isPast && !isBooked;

      // Remove any overlapping auto slots in favor of the custom slot
      const filteredAuto = generatedSlots.filter((s) => {
        const sStart = timeToMinutes(s.startTime);
        const sEnd = timeToMinutes(s.endTime);
        return !(sStart < cEnd && sEnd > cStart);
      });

      generatedSlots.length = 0;
      generatedSlots.push(...filteredAuto);

      generatedSlots.push({
        id: `custom_${activeResourceId}_${cs.startTime}_${cs.endTime}`,
        startTime: cs.startTime,
        endTime: cs.endTime,
        durationMinutes: cDuration,
        price: cs.price,
        isCustom: true,
        label: cs.label,
        periodType: timeToMinutes(cs.startTime) < 1080 && timeToMinutes(cs.startTime) >= 360 ? 'day' : 'night',
        available,
        isBooked,
        status: matchingBooking?.status === 'completed' || matchingBooking?.slotStatus === 'completed'
          ? 'completed'
          : isBooked ? 'booked' : (available ? 'available' : 'disabled'),
        bookingId: matchingBooking?.id,
        customerName: matchingBooking?.customerName,
        customerPhone: matchingBooking?.customerPhone,
        paymentStatus: matchingBooking?.paymentStatus,
        bookingStatus: matchingBooking?.status,
        bookingCreatedAt: matchingBooking?.createdAt,
        resourceId: activeResourceId,
        resourceName: currentResource.name,
      });
    }
  }

  // Sort slots chronologically handling cross-midnight schedule
  generatedSlots.sort((a, b) => {
    let tA = timeToMinutes(a.startTime);
    let tB = timeToMinutes(b.startTime);
    if (effectiveCloseMinutes > 1440 && tA < openMinutes) tA += 1440;
    if (effectiveCloseMinutes > 1440 && tB < openMinutes) tB += 1440;
    return tA - tB;
  });

  return {
    isOpen: true,
    dayName,
    slots: generatedSlots,
    resources,
  };
}

apiRouter.get('/salons/:id/turf-slots', (req: Request, res: Response) => {
  const { id: salonId } = req.params;
  const { date } = req.query;
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: 'Salon/Turf not found' });
  }
  const queryDate = (date as string) || getLocalDateString();
  const targetResourceId = (req.query.resourceId || req.query.resource_id) as string | undefined;
  const turfResult = calculateTurfSlotsForDate(salon, queryDate, targetResourceId);
  return res.json({
    success: true,
    date: queryDate,
    dayName: turfResult.dayName,
    isOpen: turfResult.isOpen,
    message: turfResult.message,
    slots: turfResult.slots,
    resources: turfResult.resources,
    isTurf: true,
  });
});

apiRouter.get('/salons/:id/availability', (req: Request, res: Response) => {
  const { id: salonId } = req.params;
  const { service_id, staff_id, resource_id, date } = req.query;

  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: 'Salon/Turf not found' });
  }

  const queryDate = (date as string) || getLocalDateString();

  // ── TURF / RESOURCE AVAILABILITY ──
  if (isTurfBusiness(salon.category, salon.bookingMode) || salon.turfSchedule?.length || salon.resources?.length) {
    const turfResult = calculateTurfSlotsForDate(salon, queryDate, resource_id as string | undefined);
    return res.json({
      success: true,
      date: queryDate,
      dayName: turfResult.dayName,
      isOpen: turfResult.isOpen,
      message: turfResult.message,
      slots: turfResult.slots,
      resources: turfResult.resources,
      isTurf: true,
    });
  }

  // ── STANDARD SALON / BARBER AVAILABILITY ──
  const service = service_id ? db.services.get(service_id as string) : undefined;
  if (service_id && (!service || service.salonId !== salonId || !service.isActive)) {
    return res.status(400).json({ error: 'Service does not belong to this salon' });
  }
  const selectedStaff = staff_id && staff_id !== 'any' ? db.staff.get(staff_id as string) : undefined;
  if (staff_id && staff_id !== 'any' && (!selectedStaff || selectedStaff.salonId !== salonId || !selectedStaff.isActive)) {
    return res.status(400).json({ error: 'Staff member does not belong to this salon' });
  }
  const duration = service ? service.durationMinutes : 30;

  // Day of week check
  const d = new Date(queryDate + 'T00:00:00Z');
  const dayOfWeek = d.getUTCDay();
  const dayHours = salon.workingHours?.find((h) => h.dayOfWeek === dayOfWeek);

  if (!dayHours || !dayHours.isOpen) {
    return res.json({
      success: true,
      isOpen: false,
      message: 'Business is closed on this day',
      slots: [],
    });
  }

  // Generate 30-min time slots from open to close
  const [openH, openM] = dayHours.openTime.split(':').map(Number);
  const [closeH, closeM] = dayHours.closeTime.split(':').map(Number);

  const startTotalMinutes = openH * 60 + openM;
  const endTotalMinutes = closeH * 60 + closeM;

  // Get active staff for this salon (or specific staff)
  let eligibleStaff = Array.from(db.staff.values()).filter(
    (st) => st.salonId === salonId && st.isActive && st.status !== 'off'
  );

  if (staff_id && staff_id !== 'any') {
    eligibleStaff = eligibleStaff.filter((st) => st.id === staff_id);
  }

  if (service_id) {
    eligibleStaff = eligibleStaff.filter(
      (st) => st.serviceIds.length === 0 || st.serviceIds.includes(service_id as string)
    );
  }

  // Fetch confirmed appointments on this date
  const bookedSlots = Array.from(db.bookings.values()).filter(
    (b) =>
      b.salonId === salonId &&
      b.scheduledDate === queryDate &&
      b.mode === 'appointment' &&
      b.status !== 'cancelled' &&
      b.status !== 'no_show'
  );

  const slots = [];
  const now = new Date();
  const todayStr = getLocalDateString(now);
  const isToday = queryDate === todayStr;
  const currentMinutesToday = getLocalMinutes(now);

  for (let m = startTotalMinutes; m + duration <= endTotalMinutes; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    // Skip past slots if today
    if (isToday && m <= currentMinutesToday + 15) {
      continue;
    }

    // Check staff availability for this slot across full duration [m, m + duration)
    const slotStart = m;
    const slotEnd = m + duration;
    const availableStaffForSlot = eligibleStaff.filter((st) => {
      const hasConflict = bookedSlots.some((b) => {
        if (b.staffId !== st.id) return false;
        const bStart = timeToMinutes(b.scheduledTime || '00:00');
        const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || 30);
        return slotStart < bEnd && slotEnd > bStart;
      });
      return !hasConflict;
    });

    const isAvailable = availableStaffForSlot.length > 0;

    slots.push({
      time: timeStr,
      available: isAvailable,
      availableStaffCount: availableStaffForSlot.length,
      availableStaffIds: availableStaffForSlot.map((s) => s.id),
    });
  }

  return res.json({
    success: true,
    date: queryDate,
    dayName: dayHours.dayName,
    isOpen: true,
    workingHours: `${dayHours.openTime} - ${dayHours.closeTime}`,
    slots,
  });
});

// ----------------------------------------------------
// 4.9 PAYMENTS & GATEWAY INTEGRATION
// ----------------------------------------------------

apiRouter.post('/payments/create-order', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { salonId, amount, currency = 'INR', paymentType = 'FULL' } = req.body || {};
  if (!salonId || typeof salonId !== 'string') {
    return res.status(400).json({ success: false, error: 'salonId is required' });
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Valid positive amount is required' });
  }

  const orderId = `order_qgo_${crypto.randomBytes(8).toString('hex')}`;
  const orderSignature = makeOrderSignature(orderId, numericAmount, salonId);

  const orderRecord = {
    id: orderId,
    salonId,
    customerId: req.auth!.userId,
    amount: numericAmount,
    currency,
    paymentType,
    status: 'created' as const,
    orderSignature,
    createdAt: new Date().toISOString(),
  };

  db.paymentOrders.set(orderId, orderRecord);

  return res.status(201).json({
    success: true,
    orderId,
    amount: numericAmount,
    currency,
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_qgo',
    orderSignature,
  });
});

apiRouter.post('/payments/verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { orderId, paymentId, method = 'upi' } = req.body || {};
  if (!orderId || !paymentId) {
    return res.status(400).json({ success: false, error: 'orderId and paymentId are required' });
  }

  const order = db.paymentOrders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Payment order not found' });
  }

  if (order.customerId && order.customerId !== req.auth!.userId) {
    return res.status(403).json({ success: false, error: 'Unauthorized to verify this payment order' });
  }

  // Prevent replay of already-booked paymentId
  const existingBookingWithPayment = Array.from(db.bookings.values()).find(
    (b: any) => b.paymentId === paymentId
  );
  if (existingBookingWithPayment) {
    return res.status(409).json({ success: false, error: 'This payment transaction has already been applied to another booking' });
  }

  order.status = 'paid';
  order.paymentId = paymentId;
  order.paymentMethod = method;
  order.verifiedAt = new Date().toISOString();
  db.paymentOrders.set(orderId, order);

  const paymentSignature = makePaymentSignature(orderId, paymentId, order.amount);

  return res.json({
    success: true,
    verified: true,
    orderId,
    paymentId,
    amount: order.amount,
    paymentSignature,
  });
});

// ----------------------------------------------------
// 5. BOOKINGS (Appointments, Turf Slots & Live Tokens)
// ----------------------------------------------------

apiRouter.post('/bookings', requireAuth, requireRole('consumer', 'owner'), validateBody(bookingCreationSchema), async (req: AuthenticatedRequest, res: Response) => {
  const {
    salonId,
    customerName,
    customerPhone,
    serviceId,
    staffId,
    resourceId,
    mode = 'appointment', // 'appointment' | 'token'
    scheduledDate,
    scheduledTime,
    slotEndTime,
    price,
    numberOfPlayers,
    notes,
    paymentType,
    advanceAmount,
    manualBooking,
    paymentId,
    orderId,
    paymentSignature,
  } = req.body;

  if (req.auth?.user?.isBlocked) {
    return res.status(403).json({ error: 'Your account has been suspended by the administrator. Creating bookings is disabled.' });
  }

  if (!salonId || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Missing required booking information' });
  }

  const isOwnerManualBooking = req.auth!.role === 'owner' && manualBooking === true;
  if (req.auth!.role === 'owner' && !isOwnerManualBooking) {
    return res.status(403).json({ error: 'Owners can only create bookings through the manual booking flow.' });
  }
  if (req.auth!.role === 'consumer' && manualBooking === true) {
    return res.status(403).json({ error: 'Manual bookings can only be created by the business owner.' });
  }
  if (isOwnerManualBooking && !canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const existingCustomer = isOwnerManualBooking
    ? Array.from(db.users.values()).find((user) => normalizePhone(user.phone) === normalizePhone(customerPhone))
    : undefined;
  const customerId = existingCustomer?.id || (isOwnerManualBooking ? `guest_${crypto.randomUUID()}` : req.auth!.userId);
  const salon = db.salons.get(salonId);
  if (!salon || !salon.isPublished) {
    return res.status(404).json({ error: 'Business not found' });
  }



  const isTurf = isTurfBusiness(salon.category, salon.bookingMode) || Boolean(resourceId) || Boolean(salon.resources?.length);

  // ── TURF / RESOURCE SLOT BOOKING ──
  if (isTurf) {
    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: 'Date and time are required for turf slot bookings' });
    }

    const rawResources = (salon.resources || []).filter((resource) => resource.isActive);
    const resources = rawResources.length > 0
      ? rawResources
      : [{ id: 'turf_main', name: salon.name || 'Main Turf', type: 'turf', isActive: true, pricePerHour: 800 }];
    const selectedResource = resourceId ? resources.find((r) => r.id === resourceId) : resources[0];
    const targetResourceId = selectedResource ? selectedResource.id : 'turf_1';
    const targetResourceName = selectedResource ? selectedResource.name : 'Turf 1';

    // Check advance booking window & minimum notice
    const advanceBookingDays = salon.bookingSettings?.advanceBookingDays || 30;
    const minNoticeMinutes = salon.bookingSettings?.minNoticeMinutes || 0;
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const isToday = scheduledDate === todayStr;
    const currentMinutesToday = getLocalMinutes(now);

    if (isToday && timeToMinutes(scheduledTime) < currentMinutesToday + minNoticeMinutes) {
      return res.status(400).json({ error: `Minimum notice requirement of ${minNoticeMinutes} minutes not met for this slot.` });
    }

    if (scheduledDate < todayStr) {
      return res.status(400).json({ error: 'Cannot book slots in the past' });
    }

    const bookingDateObj = new Date(`${scheduledDate}T00:00:00Z`);
    const todayDateObj = new Date(`${todayStr}T00:00:00Z`);
    const diffDays = Math.ceil((bookingDateObj.getTime() - todayDateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > advanceBookingDays) {
      return res.status(400).json({ error: `This slot is beyond the allowed advance booking window of ${advanceBookingDays} days.` });
    }

        // 1. Read configured slots from the server-side availability engine BEFORE locking
    const allSlots = calculateTurfSlotsForDate(salon, scheduledDate, targetResourceId).slots;
    
    // Support multi-slot bookings (e.g., 08:00 to 10:00 spans two 60-min slots)
    const reqStartM = timeToMinutes(scheduledTime);
    const reqEndM = slotEndTime ? timeToMinutes(slotEndTime) : reqStartM + 60;
    
    const requestedSlots = allSlots.filter((slot) => {
      const sStart = timeToMinutes(slot.startTime);
      const sEnd = timeToMinutes(slot.endTime) <= sStart ? timeToMinutes(slot.endTime) + 1440 : timeToMinutes(slot.endTime);
      const rEnd = reqEndM <= reqStartM ? reqEndM + 1440 : reqEndM;
      return sStart >= reqStartM && sEnd <= rEnd;
    });

    if (requestedSlots.length === 0) {
      return res.status(409).json({ error: 'This turf slot is unavailable. Refresh availability and choose another slot.', slotTaken: true });
    }

    const unavailableSlot = requestedSlots.find(s => !s.available || s.status !== 'available');
    if (unavailableSlot) {
      return res.status(409).json({ error: 'One or more selected slots are unavailable. Refresh availability and choose another time.', slotTaken: true });
    }

    const totalDuration = requestedSlots.reduce((acc, slot) => acc + slot.durationMinutes, 0);
    const expectedDuration = (reqEndM <= reqStartM ? reqEndM + 1440 : reqEndM) - reqStartM;
    if (totalDuration !== expectedDuration) {
      return res.status(400).json({ error: 'The requested slot duration does not perfectly match the configured availability blocks.' });
    }

    const bookingId = `bk_turf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const acquiredSlotTimes: string[] = [];
    const releaseAllAcquiredLocks = () => {
      for (const time of acquiredSlotTimes) {
        db.releaseSlotLock(salonId, targetResourceId, scheduledDate, time, bookingId);
      }
    };

    // 2. STRICT ATOMIC LOCK FOR DOUBLE BOOKING PROTECTION ACROSS ALL REQUESTED SLOTS
    for (const slot of requestedSlots) {
      const lockAcquired = db.tryAcquireSlotLock(
        salonId,
        targetResourceId,
        scheduledDate,
        slot.startTime,
        bookingId
      );
      if (!lockAcquired) {
        releaseAllAcquiredLocks();
        return res.status(409).json({
          error: 'This turf slot was just booked by another customer. Please choose another time or turf.',
          slotTaken: true,
        });
      }
      acquiredSlotTimes.push(slot.startTime);
    }

    // 3. RE-VERIFY NO OVERLAPPING BOOKING EXISTS FOR THIS SPECIFIC TURF
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.salonId !== salonId || b.scheduledDate !== scheduledDate) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      if (b.resourceId && b.resourceId !== targetResourceId) return false;

      const reqStart = timeToMinutes(scheduledTime);
      const reqEnd = slotEndTime ? timeToMinutes(slotEndTime) : reqStart + 60;
      const bStart = timeToMinutes(b.scheduledTime || '00:00');
      const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || 60);

      const rE = reqEnd <= reqStart ? reqEnd + 1440 : reqEnd;
      const bE = bEnd <= bStart ? bEnd + 1440 : bEnd;

      return reqStart < bE && rE > bStart;
    });

    if (existingConflict) {
      releaseAllAcquiredLocks();
      return res.status(409).json({
        error: `This time slot for ${targetResourceName} is already booked. Please choose another slot.`,
        slotTaken: true,
      });
    }

    const startM = timeToMinutes(requestedSlots[0].startTime);
    const endM = timeToMinutes(requestedSlots[requestedSlots.length - 1].endTime);
    const durationMinutes = totalDuration;
    const finalPrice = requestedSlots.reduce((acc, slot) => acc + slot.price, 0);
    const acceptedPaymentType = requestedSlots[0].paymentType || 'BOTH';

    if (!isOwnerManualBooking && paymentType === 'FULL' && acceptedPaymentType === 'ADVANCE') {
      releaseAllAcquiredLocks();
      return res.status(400).json({ error: 'This slot accepts advance payment only.' });
    }
    if (!isOwnerManualBooking && paymentType === 'ADVANCE' && acceptedPaymentType === 'FULL') {
      releaseAllAcquiredLocks();
      return res.status(400).json({ error: 'This slot requires full payment.' });
    }

    const serverConfiguredAdvance = requestedSlots.reduce((acc, slot) => {
      const slotAdv = typeof slot.advanceAmount === 'number' && slot.advanceAmount > 0
        ? slot.advanceAmount
        : Math.floor(slot.price * 0.2);
      return acc + slotAdv;
    }, 0);

    const calculatedAdvance = paymentType === 'ADVANCE' ? serverConfiguredAdvance : 0;

    const tokenNumber = db.getNextTokenNumber(salon);
    const qrCodeId = `QR-${bookingId}-${crypto.randomBytes(6).toString('hex')}`.toUpperCase();
    const qrSignature = makeQrSignature(bookingId, salonId, qrCodeId);

    const qgoFee = 30;
    const gstAmount = 5.40;
    const customerPaidSlotAmount = isOwnerManualBooking ? 0 : (paymentType === 'ADVANCE' ? calculatedAdvance : (paymentType === 'FULL' ? finalPrice : 0));
    const hasOnlinePayment = customerPaidSlotAmount > 0;
    const totalCustomerPaid = hasOnlinePayment ? customerPaidSlotAmount + qgoFee + gstAmount : 0;

    // Enforce server-side payment verification for online paid bookings
    if (!isOwnerManualBooking && (paymentType === 'FULL' || paymentType === 'ADVANCE')) {
      if (!paymentId || !orderId || !paymentSignature) {
        releaseAllAcquiredLocks();
        return res.status(400).json({
          error: 'Online payment verification required. Please complete payment before booking.',
          paymentRequired: true,
        });
      }

      // Check replay attack: ensure paymentId has not been used before
      const existingPaymentBooking = Array.from(db.bookings.values()).find(
        (b: any) => b.paymentId === paymentId
      );
      if (existingPaymentBooking) {
        releaseAllAcquiredLocks();
        return res.status(409).json({
          error: 'This payment transaction has already been used for another booking.',
          paymentReplayed: true,
        });
      }

      // Verify cryptographic signature against expected totalCustomerPaid
      const isSigValid = verifyPaymentSignature(orderId, paymentId, totalCustomerPaid, paymentSignature);
      if (!isSigValid) {
        releaseAllAcquiredLocks();
        return res.status(400).json({
          error: 'Payment verification failed: invalid signature.',
          paymentInvalid: true,
        });
      }

      // Mark order in db.paymentOrders if it exists
      const paymentOrder = db.paymentOrders.get(orderId);
      if (paymentOrder) {
        paymentOrder.status = 'paid';
        paymentOrder.paymentId = paymentId;
        db.paymentOrders.set(orderId, paymentOrder);
      }
    } else if (!isOwnerManualBooking && paymentType === 'pay_at_shop') {
      if (acceptedPaymentType === 'FULL' || acceptedPaymentType === 'ADVANCE') {
        releaseAllAcquiredLocks();
        return res.status(400).json({
          error: `This turf slot does not accept Pay at Venue (${acceptedPaymentType === 'FULL' ? 'requires full payment' : 'requires advance payment'}).`,
        });
      }
    }

    const newBooking: Booking = {
      id: bookingId,
      salonId,
      salonName: salon.name,
      resourceId: targetResourceId,
      resourceName: targetResourceName,
      customerId,
      customerName,
      customerPhone,
      serviceId: serviceId || 'srv_turf_slot',
      serviceName: `${targetResourceName} Slot`,
      serviceDuration: durationMinutes,
      servicePrice: finalPrice,
      numberOfPlayers: Math.max(1, Math.min(50, Number(numberOfPlayers) || 10)),
      mode: 'appointment',
      scheduledDate,
      scheduledTime,
      slotEndTime: requestedSlots[requestedSlots.length - 1].endTime,
      status: 'confirmed',
      qrCodeId,
      qrSignature,
      tokenNumber,
      notes,
      paymentStatus: isOwnerManualBooking ? 'pay_at_shop' : (paymentType === 'ADVANCE' && calculatedAdvance > 0 ? 'partially_paid' : (paymentType === 'FULL' ? 'paid' : 'pay_at_shop')),
      amount: finalPrice,
      totalAmount: finalPrice,
      paidAmount: totalCustomerPaid,
      balanceAmount: isOwnerManualBooking ? finalPrice : (paymentType === 'ADVANCE' ? finalPrice - calculatedAdvance : (paymentType === 'FULL' ? 0 : finalPrice)),
      balanceStatus: isOwnerManualBooking || paymentType === 'ADVANCE' || paymentType === 'pay_at_shop' ? 'PENDING' : 'COLLECTED',
      convenienceFee: isOwnerManualBooking ? 0 : (hasOnlinePayment ? qgoFee : 0),
      gstAmount: isOwnerManualBooking ? 0 : (hasOnlinePayment ? gstAmount : 0),
      paymentId: !isOwnerManualBooking && hasOnlinePayment ? paymentId : undefined,
      orderId: !isOwnerManualBooking && hasOnlinePayment ? orderId : undefined,
      bookingSource: isOwnerManualBooking ? 'owner_manual' : 'customer',
      refundPercentage: salon.bookingSettings?.refundPercentage ?? 70,
      cancellationDeadlineHours: salon.bookingSettings?.cancellationDeadlineHours ?? 2,
      reminderMinutesBefore: salon.bookingSettings?.reminderMinutesBefore ?? 30,
      refundStatus: 'none',
      createdAt: new Date().toISOString(),
    };

    const reservationCreated = await db.createBookingWithSlotReservation(newBooking, targetResourceId);
    if (!reservationCreated) {
      releaseAllAcquiredLocks();
      return res.status(409).json({ error: 'This turf slot was just booked by another customer. Please choose another time or turf.', slotTaken: true });
    }

    return res.status(201).json({
      success: true,
      booking: newBooking,
      qrPayload: {
        bookingId,
        salonId,
        tokenNumber,
        qrCodeId,
        qrSignature,
        scheduledDate,
        scheduledTime,
        resourceName: targetResourceName,
      },
    });
  }

  // ── STANDARD SALON / BARBER BOOKING ──
  if (!serviceId) {
    return res.status(400).json({ error: 'Service is required for appointment booking' });
  }

  const service = db.services.get(serviceId);
  if (!service || service.salonId !== salonId || !service.isActive) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const serverServiceAdvance = Math.floor(service.price * 0.2);
  const calculatedServiceAdvance = paymentType === 'ADVANCE' ? serverServiceAdvance : 0;

  let assignedStaff: Staff | undefined;
  if (staffId && staffId !== 'any') {
    assignedStaff = db.staff.get(staffId);
    if (!assignedStaff || assignedStaff.salonId !== salonId || !assignedStaff.isActive || assignedStaff.status === 'off') {
      return res.status(400).json({ error: 'Staff member does not belong to this salon' });
    }
    if (assignedStaff.serviceIds.length > 0 && !assignedStaff.serviceIds.includes(serviceId)) {
      return res.status(400).json({ error: 'Staff member is not assigned to this service' });
    }
  } else {
    const availableStaff = Array.from(db.staff.values()).filter(
      (st) => st.salonId === salonId && st.isActive && st.status !== 'off' && (st.serviceIds.length === 0 || st.serviceIds.includes(serviceId))
    );
    if (availableStaff.length === 0) {
      return res.status(400).json({ error: 'No staff available for this service at this salon' });
    }

    const todayStr = getLocalDateString(new Date());
    const todayBookings = Array.from(db.bookings.values()).filter(
      (b) => b.salonId === salonId && b.scheduledDate === todayStr && b.status !== 'cancelled' && b.status !== 'no_show'
    );
    const todayQueue = Array.from(db.queueEntries.values()).filter(
      (q) => q.salonId === salonId && q.status !== 'cancelled' && q.status !== 'served' && q.status !== 'no_show'
    );

    assignedStaff = availableStaff.reduce((leastBusy, current) => {
      const leastBusyLoad = 
        todayBookings.filter(b => b.staffId === leastBusy.id).length + 
        todayQueue.filter(q => q.staffId === leastBusy.id).length;
      const currentLoad = 
        todayBookings.filter(b => b.staffId === current.id).length + 
        todayQueue.filter(q => q.staffId === current.id).length;
        
      return currentLoad < leastBusyLoad ? current : leastBusy;
    });
  }

  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (mode === 'appointment') {
    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: 'Date and time are required for appointment booking' });
    }

    const advanceBookingDays = salon.bookingSettings?.advanceBookingDays || 30;
    const minNoticeMinutes = salon.bookingSettings?.minNoticeMinutes || 0;
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const bookingDateObj = new Date(`${scheduledDate}T00:00:00Z`);
    const todayDateObj = new Date(`${todayStr}T00:00:00Z`);
    const diffDays = Math.ceil((bookingDateObj.getTime() - todayDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (!Number.isFinite(bookingDateObj.getTime()) || diffDays < 0) {
      return res.status(400).json({ error: 'Cannot book an appointment in the past' });
    }
    if (diffDays > advanceBookingDays) {
      return res.status(400).json({ error: `This appointment is beyond the allowed advance booking window of ${advanceBookingDays} days.` });
    }
    if (scheduledDate === todayStr) {
      const currentMinutesToday = getLocalMinutes(now);
      if (timeToMinutes(scheduledTime) < currentMinutesToday + minNoticeMinutes) {
        return res.status(400).json({ error: `Minimum notice requirement of ${minNoticeMinutes} minutes not met for this appointment.` });
      }
    }

    const requestedStart = timeToMinutes(scheduledTime);
    const requestedEnd = requestedStart + (service.durationMinutes || 30);

    // 1. Check existing booking overlap [requestedStart, requestedEnd)
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.salonId !== salonId || b.staffId !== assignedStaff!.id || b.scheduledDate !== scheduledDate) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      const existingStart = timeToMinutes(b.scheduledTime || '00:00');
      const existingEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : existingStart + (b.serviceDuration || 30);
      return requestedStart < existingEnd && requestedEnd > existingStart;
    });

    if (existingConflict) {
      return res.status(409).json({
        error: 'This appointment slot is already booked. Please choose another time or stylist.',
        slotTaken: true,
      });
    }

    // 2. Acquire interval-based locks across [requestedStart, requestedEnd)
    const acquiredSalonSlotTimes: string[] = [];
    const releaseAcquiredSalonLocks = () => {
      for (const t of acquiredSalonSlotTimes) {
        db.releaseSlotLock(salonId, assignedStaff!.id, scheduledDate, t, bookingId);
      }
    };

    let lockFailed = false;
    for (let m = requestedStart; m < requestedEnd; m += 15) {
      const timeStr = minutesToTime(m % 1440);
      const lockAcquired = db.tryAcquireSlotLock(
        salonId,
        assignedStaff!.id,
        scheduledDate,
        timeStr,
        bookingId
      );
      if (!lockAcquired) {
        lockFailed = true;
        break;
      }
      acquiredSalonSlotTimes.push(timeStr);
    }

    if (lockFailed) {
      releaseAcquiredSalonLocks();
      return res.status(409).json({
        error: 'This appointment slot was just booked by another customer. Please choose another time or stylist.',
        slotTaken: true,
      });
    }
  }

  const tokenNumber = db.getNextTokenNumber(salon);
  const qrCodeId = `QR-${bookingId}-${crypto.randomBytes(6).toString('hex')}`.toUpperCase();
  const qrSignature = makeQrSignature(bookingId, salonId, qrCodeId);

  let queuePosition = 1;
  let estimatedWaitMinutes = 15;
  let peopleAhead = 0;

  if (mode === 'token') {
    // Single process assumption: lacks atomic lock for queue assignment.
    // Will silently double-assign queue positions if horizontally scaled.
    const currentQueue = Array.from(db.queueEntries.values()).filter(
      (q) => q.salonId === salonId && (q.status === 'waiting' || q.status === 'calling')
    );
    
    if (assignedStaff) {
      const staffQueue = currentQueue.filter(q => q.staffId === assignedStaff!.id);
      queuePosition = staffQueue.length + 1;
      peopleAhead = staffQueue.length;
      const staffWait = staffQueue.reduce((acc, q) => acc + (q.serviceDuration || 30), 0);
      estimatedWaitMinutes = Math.max(5, staffWait);
    } else {
      queuePosition = currentQueue.length + 1;
      peopleAhead = currentQueue.length;
      estimatedWaitMinutes = Math.max(5, currentQueue.length * 15 + 5);
    }
  }

  const totalCustomerPaid = paymentType === 'ADVANCE' ? calculatedServiceAdvance : (paymentType === 'FULL' ? service.price : 0);

  // Enforce server-side payment verification for salon appointments/tokens if online paid
  if (!isOwnerManualBooking && (paymentType === 'FULL' || paymentType === 'ADVANCE')) {
    if (!paymentId || !orderId || !paymentSignature) {
      if (mode === 'appointment' && assignedStaff) {
        db.releaseSlotLock(salonId, assignedStaff.id, scheduledDate!, scheduledTime!, bookingId);
        if (scheduledTime) {
          const reqStart = timeToMinutes(scheduledTime);
          const reqEnd = reqStart + (service.durationMinutes || 30);
          for (let m = reqStart; m < reqEnd; m += 15) {
            db.releaseSlotLock(salonId, assignedStaff.id, scheduledDate!, minutesToTime(m % 1440), bookingId);
          }
        }
      }
      return res.status(400).json({
        error: 'Online payment verification required. Please complete payment before booking.',
        paymentRequired: true,
      });
    }

    const existingPaymentBooking = Array.from(db.bookings.values()).find(
      (b: any) => b.paymentId === paymentId
    );
    if (existingPaymentBooking) {
      if (mode === 'appointment' && assignedStaff && scheduledTime) {
        const reqStart = timeToMinutes(scheduledTime);
        const reqEnd = reqStart + (service.durationMinutes || 30);
        for (let m = reqStart; m < reqEnd; m += 15) {
          db.releaseSlotLock(salonId, assignedStaff.id, scheduledDate!, minutesToTime(m % 1440), bookingId);
        }
      }
      return res.status(409).json({
        error: 'This payment transaction has already been used for another booking.',
        paymentReplayed: true,
      });
    }

    const isSigValid = verifyPaymentSignature(orderId, paymentId, totalCustomerPaid, paymentSignature);
    if (!isSigValid) {
      if (mode === 'appointment' && assignedStaff && scheduledTime) {
        const reqStart = timeToMinutes(scheduledTime);
        const reqEnd = reqStart + (service.durationMinutes || 30);
        for (let m = reqStart; m < reqEnd; m += 15) {
          db.releaseSlotLock(salonId, assignedStaff.id, scheduledDate!, minutesToTime(m % 1440), bookingId);
        }
      }
      return res.status(400).json({
        error: 'Payment verification failed: invalid signature.',
        paymentInvalid: true,
      });
    }

    const paymentOrder = db.paymentOrders.get(orderId);
    if (paymentOrder) {
      paymentOrder.status = 'paid';
      paymentOrder.paymentId = paymentId;
      db.paymentOrders.set(orderId, paymentOrder);
    }
  }

  const newBooking: Booking = {
    id: bookingId,
    salonId,
    salonName: salon.name,
    staffId: assignedStaff?.id,
    staffName: assignedStaff?.name || 'Any Stylist',
    customerId,
    customerName,
    customerPhone,
    serviceId,
    serviceName: service.name,
    serviceDuration: service.durationMinutes,
    servicePrice: service.price,
    numberOfPlayers: Math.max(1, Math.min(50, Number(numberOfPlayers) || 1)),
    mode,
    scheduledDate: mode === 'appointment' ? scheduledDate : undefined,
    scheduledTime: mode === 'appointment' ? scheduledTime : undefined,
    slotEndTime: mode === 'appointment' && scheduledTime ? minutesToTime(timeToMinutes(scheduledTime) + service.durationMinutes) : undefined,
    status: 'confirmed',
    qrCodeId,
    qrSignature,
    tokenNumber,
    queuePosition,
    peopleAhead,
    estimatedWaitMinutes,
    refundPercentage: salon.bookingSettings?.refundPercentage ?? 70,
    cancellationDeadlineHours: salon.bookingSettings?.cancellationDeadlineHours ?? 2,
    reminderMinutesBefore: salon.bookingSettings?.reminderMinutesBefore ?? 30,
    refundStatus: 'none',
    joinedQueueAt: new Date().toISOString(),
    notes,
    paymentStatus: isOwnerManualBooking ? 'pay_at_shop' : (paymentType === 'ADVANCE' && calculatedServiceAdvance > 0 ? 'partially_paid' : (paymentType === 'FULL' ? 'paid' : 'pay_at_shop')),
    amount: service.price,
    totalAmount: service.price,
    paidAmount: isOwnerManualBooking ? 0 : totalCustomerPaid,
    balanceAmount: isOwnerManualBooking ? service.price : (paymentType === 'ADVANCE' ? service.price - calculatedServiceAdvance : (paymentType === 'FULL' ? 0 : service.price)),
    balanceStatus: isOwnerManualBooking || paymentType === 'ADVANCE' || paymentType === 'pay_at_shop' ? 'PENDING' : 'COLLECTED',
    paymentId: !isOwnerManualBooking && (paymentType === 'FULL' || paymentType === 'ADVANCE') ? paymentId : undefined,
    orderId: !isOwnerManualBooking && (paymentType === 'FULL' || paymentType === 'ADVANCE') ? orderId : undefined,
    bookingSource: isOwnerManualBooking ? 'owner_manual' : 'customer',
    createdAt: new Date().toISOString(),
  };

  if (mode === 'appointment') {
    const reservationCreated = await db.createBookingWithSlotReservation(newBooking, assignedStaff!.id);
    if (!reservationCreated) {
      db.releaseSlotLock(salonId, assignedStaff!.id, scheduledDate!, scheduledTime!, bookingId);
      return res.status(409).json({ error: 'This appointment slot was just booked by another customer. Please choose another time or stylist.', slotTaken: true });
    }
  } else {
    db.bookings.set(bookingId, newBooking);
  }

  // Add into unified queue if token or appointment is today
  const today = getLocalDateString(new Date());
  if (mode === 'token' || scheduledDate === today) {
    const qeId = `qe_${bookingId}`;
    db.queueEntries.set(qeId, {
      id: qeId,
      bookingId,
      salonId,
      staffId: assignedStaff?.id,
      staffName: assignedStaff?.name,
      tokenNumber,
      position: queuePosition,
      status: 'waiting',
      joinedAt: new Date().toISOString(),
      customerName,
      customerPhone,
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      servicePrice: service.price,
      isAppointment: mode === 'appointment',
      scheduledTime,
    });

    if (assignedStaff) {
      assignedStaff.waitingCount = (assignedStaff.waitingCount || 0) + 1;
    }
  }

  db.recalculateQueueStats(salonId);

  // Send Push Notification to Customer
  sendNotification(customerId, {
    userId: customerId,
    type: 'booking_confirmed',
    title: mode === 'appointment' ? 'Appointment Confirmed!' : `Token #${tokenNumber.split('-').pop()} Issued`,
    message:
      mode === 'appointment'
        ? `Your appointment at ${salon.name} for ${service.name} is confirmed for ${scheduledDate} at ${scheduledTime}.`
        : `You are in line at ${salon.name}. Est. wait: ~${estimatedWaitMinutes} mins.`,
    bookingId,
  });

  // Notify Owner
  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: 'new_booking',
    title: `New ${mode === 'appointment' ? 'Appointment' : 'Walk-in Token'}`,
    message: `${customerName} booked ${service.name} (${tokenNumber}).`,
    bookingId,
  });

  return res.status(201).json({
    success: true,
    booking: newBooking,
    qrPayload: {
      bookingId,
      salonId,
      tokenNumber,
      qrCodeId,
      qrSignature,
    },
  });
});

apiRouter.get('/bookings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { salonId, date, staffId } = req.query;

  if (staffId) {
    if (!salonId || typeof salonId !== 'string') {
      return res.status(400).json({ error: 'salonId is required when staffId is provided' });
    }
    const staff = typeof staffId === 'string' ? db.staff.get(staffId) : null;
    if (!staff || staff.salonId !== salonId) {
      return forbidden(res);
    }
  }

  let bookingsList = Array.from(db.bookings.values());

  if (salonId && typeof salonId === 'string') {
    if (!canManageSalon(req.auth, salonId)) {
      return forbidden(res);
    }
    bookingsList = bookingsList.filter((b) => b.salonId === salonId);
  } else {
    bookingsList = bookingsList.filter((b) => b.customerId === req.auth!.userId);
  }

  if (date && typeof date === 'string') {
    bookingsList = bookingsList.filter((b) => b.scheduledDate === date || b.createdAt.startsWith(date));
  }

  if (staffId && typeof staffId === 'string') {
    bookingsList = bookingsList.filter((b) => b.staffId === staffId);
  }

  bookingsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ success: true, bookings: bookingsList });
});

apiRouter.get('/bookings/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (!canReadBooking(req.auth, booking)) {
    return forbidden(res);
  }

  // Ensure current queue position is accurate
  db.recalculateQueueStats(booking.salonId);

  if (!booking.qrCodeId || !booking.qrSignature) {
    booking.qrCodeId = booking.qrCodeId || `QR-${booking.id}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
    booking.qrSignature = makeQrSignature(booking.id, booking.salonId, booking.qrCodeId);
    db.bookings.set(booking.id, booking);
  }

  return res.json({
    success: true,
    booking,
    qrPayload: {
      bookingId: booking.id,
      salonId: booking.salonId,
      tokenNumber: booking.tokenNumber,
      qrCodeId: booking.qrCodeId,
      qrSignature: booking.qrSignature,
    },
  });
});

apiRouter.patch('/bookings/:id/status', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isValidBookingStatus(status)) {
    return res.status(400).json({ error: 'Invalid booking status' });
  }

  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  const salon = db.salons.get(booking.salonId);
  if (!salon || salon.ownerId !== req.auth!.userId) {
    return forbidden(res);
  }

  booking.status = status;
  if (status === 'completed') {
    booking.completedAt = new Date().toISOString();
    booking.paymentStatus = 'paid';
  }
  if (status === 'checked_in') {
    booking.checkedInAt = booking.checkedInAt || new Date().toISOString();
  }
  if (status === 'cancelled') {
    releaseBookingSlotLock(booking);
    sendNotification(booking.customerId, {
      userId: booking.customerId,
      type: 'cancelled',
      title: 'Booking Cancelled',
      message: `Your booking at ${salon.name} has been cancelled by the venue.`,
      bookingId: booking.id,
    });
  }
  if (status === 'completed' || status === 'no_show') {
    releaseBookingSlotLock(booking);
  }

  const qe = db.queueEntries.get(`qe_${id}`) || Array.from(db.queueEntries.values()).find((q) => q.bookingId === id);
  if (qe) {
    if (status === 'completed') qe.status = 'served';
    if (status === 'cancelled') qe.status = 'cancelled';
    if (status === 'no_show') qe.status = 'no_show';
    if (status === 'checked_in') qe.isArriving = true;
    db.queueEntries.set(qe.id, qe);
  }

  db.recalculateQueue(booking.salonId);
  db.bookings.set(booking.id, booking);
  return res.json({ success: true, booking });
});


apiRouter.post('/bookings/:id/collect-balance', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const bookingId = req.params.id;
  const booking = db.bookings.get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const salon = db.salons.get(booking.salonId);
  if (!salon || salon.ownerId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Unauthorized to collect balance for this booking' });
  }

  if (booking.balanceAmount && booking.balanceAmount > 0) {
    booking.paidAmount = (booking.paidAmount || 0) + booking.balanceAmount;
    booking.balanceAmount = 0;
    booking.balanceStatus = 'COLLECTED';
    booking.paymentStatus = 'paid';
    booking.updatedAt = new Date().toISOString();
    db.bookings.set(bookingId, booking);
    return res.json({ success: true, booking });
  } else {
    return res.status(400).json({ error: 'No balance to collect' });
  }
});

apiRouter.patch('/bookings/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (!canReadBooking(req.auth, booking)) {
    return forbidden(res);
  }

  const salon = db.salons.get(booking.salonId);
  const isCustomer = req.auth!.userId === booking.customerId;

  // Customer cancellation rules & cutoff verification
  if (isCustomer) {
    if (salon && salon.bookingSettings && salon.bookingSettings.cancellationAllowed === false) {
      return res.status(400).json({ error: 'Player cancellations are not allowed for this business.' });
    }

    if (booking.scheduledDate && booking.scheduledTime) {
      const deadlineHours = booking.cancellationDeadlineHours ?? salon?.bookingSettings?.cancellationDeadlineHours ?? 2;
      const slotInstant = slotInstantMs(booking.scheduledDate, booking.scheduledTime);
      const cutoffTime = slotInstant - (deadlineHours * 60 * 60 * 1000);
      if (Date.now() >= cutoffTime) {
        return res.status(400).json({
          error: `Cancellation deadline passed (${deadlineHours} hours before slot). Cancellation is no longer permitted.`
        });
      }
    }
  }

  // Owner cancellation always gives 100% refund (platform policy).
  // Customer cancellation uses the configured refund percentage.
  const isOwnerCancel = !isCustomer;
  const refundPct = isOwnerCancel
    ? 100 // Owner cancels → full refund always
    : (booking.refundPercentage ?? salon?.bookingSettings?.refundPercentage ?? 70);
    
  let refundAmount = 0;
  let nonRefundableAmount = 0;
  let refundStatus: 'none' | 'pending' | 'completed' | 'rejected' = 'none';

  const normStatus = normalizePaymentStatus(booking.paymentStatus);
  if (normStatus === 'paid' || normStatus === 'partially_paid') {
    const rawNetSlotPaid = Math.max(
      0,
      (booking.paidAmount || 0) - (booking.convenienceFee || 0) - (booking.gstAmount || 0)
    );
    const netSlotPaid = Math.round(rawNetSlotPaid * 100) / 100;
    const refundablePaid = netSlotPaid > 0 ? netSlotPaid : (normStatus === 'paid' ? (booking.amount || 0) : 0);
    refundAmount = Math.round((refundablePaid * refundPct) / 100);
    nonRefundableAmount = Math.max(0, Math.round((refundablePaid - refundAmount) * 100) / 100);
    refundStatus = refundAmount > 0 ? 'completed' : 'none';
    if (refundAmount > 0) {
      booking.paymentStatus = 'refunded';
    }
  } else {
    // If pay_at_shop or pending, no money was collected online
    refundAmount = 0;
    nonRefundableAmount = 0;
    refundStatus = 'none';
  }

  booking.status = 'cancelled';
  booking.cancelledBy = isCustomer ? 'customer' : 'owner';
  booking.cancellationReason = reason || (isCustomer ? 'Customer cancelled' : 'Cancelled by owner');
  booking.cancelledAt = new Date().toISOString();
  booking.refundPercentage = refundPct;
  booking.refundAmount = refundAmount;
  booking.nonRefundableAmount = nonRefundableAmount;
  booking.refundStatus = refundStatus;

  // Release slot lock — slot becomes available again for new bookings
  releaseBookingSlotLock(booking);

  // Remove from queue
  const qe = db.queueEntries.get(`qe_${id}`);
  if (qe) {
    qe.status = 'cancelled';
  }

  db.recalculateQueueStats(booking.salonId);
  db.bookings.set(booking.id, booking);

  // Notify customer
  const cancellerLabel = isOwnerCancel ? 'QGo Business Owner' : 'you';
  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: 'cancelled',
    title: isOwnerCancel ? '⚠️ Booking Cancelled by Owner' : 'Booking Cancelled',
    message: isOwnerCancel
      ? `Your booking at ${booking.salonName} on ${booking.scheduledDate} ${booking.scheduledTime} was cancelled by the owner. Full refund: ₹${refundAmount} (100%).`
      : `Your booking at ${booking.salonName} has been cancelled. Refund: ₹${refundAmount} (${refundPct}%).`,
    bookingId: id,
  });

  // Notify owner (only for customer self-cancels)
  if (isCustomer && salon) {
    sendNotification(salon.ownerId, {
      userId: salon.ownerId,
      type: 'cancelled',
      title: 'Customer Cancelled Booking',
      message: `${booking.customerName} cancelled their booking on ${booking.scheduledDate} at ${booking.scheduledTime}. Refund: ₹${refundAmount}.`,
      bookingId: id,
    });
  }

  return res.json({
    success: true,
    message: isOwnerCancel
      ? `Booking cancelled by owner. Customer will receive full refund of ₹${refundAmount}.`
      : 'Booking cancelled successfully',
    booking,
    cancelledBy: booking.cancelledBy,
    refund: {
      refundPercentage: refundPct,
      refundAmount,
      nonRefundableAmount,
      refundStatus: booking.refundStatus,
    },
  });
});

apiRouter.patch('/bookings/:id/arriving', requireAuth, requireRole('consumer'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.customerId !== req.auth!.userId) {
    return forbidden(res);
  }

  booking.isArriving = true;

  const qe = db.queueEntries.get(`qe_${id}`);
  if (qe) {
    qe.isArriving = true;
  }

  const salon = db.salons.get(booking.salonId);
  if (salon) {
    sendNotification(salon.ownerId, {
      userId: salon.ownerId,
      type: 'queue_update',
      title: 'Customer Arriving!',
      message: `${booking.customerName} (${booking.tokenNumber}) is arriving at the shop.`,
      bookingId: id,
    });
  }

  return res.json({ success: true, message: 'Shop notified you are arriving!', booking });
});

// ----------------------------------------------------
// 6. LIVE QUEUE & OWNER/STAFF ACTIONS
// ----------------------------------------------------

apiRouter.get('/queue/:salonId/live', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const { staffId } = req.query;

  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }

  const includePrivate = canManageSalon(req.auth, salonId);
  if (!includePrivate && !salon.isPublished) {
    return res.status(404).json({ error: 'Salon not found' });
  }

  db.recalculateQueueStats(salonId);

  let entries = Array.from(db.queueEntries.values()).filter(
    (q) => q.salonId === salonId && q.status !== 'cancelled' && q.status !== 'served'
  );

  if (staffId && typeof staffId === 'string' && staffId !== 'all') {
    entries = entries.filter((q) => q.staffId === staffId);
  }

  entries.sort((a, b) => a.position - b.position);

  const staffList = Array.from(db.staff.values()).filter((s) => s.salonId === salonId && s.isActive);

  return res.json({
    success: true,
    salonId,
    queueLength: entries.filter((e) => e.status === 'waiting' || e.status === 'calling').length,
    estimatedWaitMinutes: salon?.estimatedWaitMinutes || 0,
    entries: entries.map((e) => sanitizeQueueEntry(e, includePrivate)),
    staff: staffList.map((s) => sanitizeStaff(s, includePrivate)),
  });
});

// Add Walk-in manually by Owner / Receptionist
apiRouter.post('/queue/:salonId/walk-in', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const { customerName, customerPhone, serviceId, staffId } = req.body;

  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const service = serviceId ? db.services.get(serviceId) : Array.from(db.services.values()).find((s) => s.salonId === salonId);
  if (!service || !service.isActive) {
    return res.status(400).json({ error: 'No service selected' });
  }
  if (service.salonId !== salonId) {
    return res.status(400).json({ error: 'Service does not belong to this salon' });
  }

  const staffMember = staffId ? db.staff.get(staffId) : undefined;
  if (staffMember && staffMember.salonId !== salonId) {
    return res.status(400).json({ error: 'Staff member does not belong to this salon' });
  }
  if (staffMember && staffMember.serviceIds.length > 0 && !staffMember.serviceIds.includes(service.id)) {
    return res.status(400).json({ error: 'Staff member is not assigned to this service' });
  }
  const tokenNumber = db.getNextTokenNumber(salon);
  const bookingId = `bk_walkin_${Date.now()}`;
  const qrCodeId = `QR-${bookingId}-${crypto.randomBytes(6).toString('hex')}`.toUpperCase();

  const currentWaiting = Array.from(db.queueEntries.values()).filter(
    (q) => q.salonId === salonId && (q.status === 'waiting' || q.status === 'calling')
  );

  const queueEntry: QueueEntry = {
    id: `qe_${bookingId}`,
    bookingId,
    salonId,
    staffId: staffMember?.id,
    staffName: staffMember?.name || 'Any Stylist',
    tokenNumber,
    position: currentWaiting.length + 1,
    status: 'waiting',
    joinedAt: new Date().toISOString(),
    customerName: customerName || `Walk-in Guest (${tokenNumber.split('-').pop()})`,
    customerPhone: customerPhone || 'At counter',
    serviceName: service.name,
    serviceDuration: service.durationMinutes,
    servicePrice: service.price,
    isAppointment: false,
  };

  db.queueEntries.set(queueEntry.id, queueEntry);

  const newBooking: Booking = {
    id: bookingId,
    salonId,
    salonName: salon.name,
    staffId: staffMember?.id,
    staffName: staffMember?.name || 'Any Stylist',
    customerId: `usr_walkin_${Date.now()}`,
    customerName: queueEntry.customerName,
    customerPhone: queueEntry.customerPhone,
    serviceId: service.id,
    serviceName: service.name,
    serviceDuration: service.durationMinutes,
    servicePrice: service.price,
    mode: 'token',
    status: 'confirmed',
    qrCodeId,
    qrSignature: makeQrSignature(bookingId, salonId, qrCodeId),
    tokenNumber,
    queuePosition: queueEntry.position,
    estimatedWaitMinutes: (currentWaiting.length + 1) * 15,
    joinedQueueAt: new Date().toISOString(),
    paymentStatus: 'pay_at_shop',
    amount: service.price,
    createdAt: new Date().toISOString(),
  };

  db.bookings.set(bookingId, newBooking);
  db.recalculateQueueStats(salonId);

  return res.status(201).json({
    success: true,
    message: 'Walk-in added to queue',
    queueEntry,
    booking: newBooking,
  });
});

// Call Next Customer
apiRouter.post('/queue/:salonId/call-next', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const { staffId } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  if (staffId) {
    const staff = db.staff.get(staffId);
    if (!staff || staff.salonId !== salonId) {
      return res.status(400).json({ error: 'Staff member does not belong to this salon' });
    }
    if (!canActOnStaff(req.auth, salonId, staffId)) {
      return forbidden(res);
    }
  }

  const entries = Array.from(db.queueEntries.values())
    .filter((q) => q.salonId === salonId && q.status === 'waiting' && (!staffId || q.staffId === staffId || !q.staffId))
    .sort((a, b) => a.position - b.position);

  if (entries.length === 0) {
    return res.status(404).json({ error: 'No customers waiting in queue' });
  }

  const nextEntry = entries[0];
  nextEntry.status = 'calling';

  const booking = db.bookings.get(nextEntry.bookingId);
  if (booking) {
    booking.status = 'in_progress';
    sendNotification(booking.customerId, {
      userId: booking.customerId,
      type: 'next_in_line',
      title: "You're Next! 🎉",
      message: `Please proceed to Chair with ${nextEntry.staffName || 'your stylist'}. Token: ${nextEntry.tokenNumber}.`,
      bookingId: booking.id,
    });
  }

  const staff = staffId ? db.staff.get(staffId) : undefined;
  if (staff) {
    staff.status = 'busy';
    staff.currentServingToken = nextEntry.tokenNumber;
  }

  db.recalculateQueueStats(salonId);

  return res.json({
    success: true,
    message: `Now calling ${nextEntry.customerName} (${nextEntry.tokenNumber})`,
    entry: nextEntry,
  });
});

// Mark Service Complete
apiRouter.post('/queue/:salonId/mark-served', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const { queueEntryId, bookingId, staffId } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  let entry: QueueEntry | undefined;
  if (queueEntryId) {
    entry = db.queueEntries.get(queueEntryId);
  } else if (bookingId) {
    entry = db.queueEntries.get(`qe_${bookingId}`);
  }
  if (entry && entry.salonId !== salonId) {
    return forbidden(res);
  }
  if (!entry) {
    return res.status(404).json({ error: 'Queue entry not found' });
  }
  if (!canActOnStaff(req.auth, salonId, entry.staffId)) {
    return forbidden(res);
  }

  if (entry) {
    entry.status = 'served';
    const booking = db.bookings.get(entry.bookingId);
    if (booking) {
      booking.status = 'completed';
      booking.completedAt = new Date().toISOString();
      booking.paymentStatus = 'paid';

      sendNotification(booking.customerId, {
        userId: booking.customerId,
        type: 'queue_update',
        title: 'Service Completed! ✨',
        message: `Thank you for visiting ${booking.salonName}. Please leave a rating!`,
        bookingId: booking.id,
      });
    }
  }

  if (staffId) {
    const staff = db.staff.get(staffId);
    if (staff && staff.salonId === salonId && canActOnStaff(req.auth, salonId, staff.id)) {
      staff.status = 'available';
      staff.currentServingToken = undefined;
    }
  }

  db.recalculateQueueStats(salonId);

  return res.json({ success: true, message: 'Customer service marked as completed!' });
});

// Mark Customer No-Show
apiRouter.post('/queue/:salonId/mark-no-show', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const { queueEntryId, bookingId } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  let entry: QueueEntry | undefined;
  if (queueEntryId) {
    entry = db.queueEntries.get(queueEntryId);
  } else if (bookingId) {
    entry = db.queueEntries.get(`qe_${bookingId}`);
  }
  if (entry && entry.salonId !== salonId) {
    return forbidden(res);
  }
  if (!entry) {
    return res.status(404).json({ error: 'Queue entry not found' });
  }
  if (!canActOnStaff(req.auth, salonId, entry.staffId)) {
    return forbidden(res);
  }

  if (entry) {
    entry.status = 'no_show';
    const booking = db.bookings.get(entry.bookingId);
    if (booking) {
      booking.status = 'no_show';
      releaseBookingSlotLock(booking);
      sendNotification(booking.customerId, {
        userId: booking.customerId,
        type: 'queue_update',
        title: 'Missed Turn',
        message: `Your turn at ${booking.salonName} was passed due to no-show.`,
        bookingId: booking.id,
      });
    }
  }

  db.recalculateQueueStats(salonId);

  return res.json({ success: true, message: 'Customer marked as no-show' });
});

// Pause / Resume queue
apiRouter.post('/queue/:salonId/pause', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  const { reason = 'Brief queue pause for shift change / break' } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  // Notify all waiting customers
  const waiting = Array.from(db.queueEntries.values()).filter(
    (q) => q.salonId === salonId && q.status === 'waiting'
  );

  waiting.forEach((w) => {
    const b = db.bookings.get(w.bookingId);
    if (b) {
      sendNotification(b.customerId, {
        userId: b.customerId,
        type: 'queue_update',
        title: 'Queue Paused Temporarily',
        message: `${b.salonName} has paused the queue briefly: ${reason}. Your position is reserved.`,
        bookingId: b.id,
      });
    }
  });

  return res.json({ success: true, message: 'Queue paused and waiting customers notified' });
});

apiRouter.post('/queue/:salonId/resume', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { salonId } = req.params;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  return res.json({ success: true, message: 'Queue resumed' });
});

// ----------------------------------------------------
// 7. QR CODE CHECK-IN SCANNER & VALIDATION
// ----------------------------------------------------

function formatTime12(time24?: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr || '00'} ${ampm}`;
}

function resolveBookingFromQrPayload(rawPayload: any, salonId: string): {
  booking: Booking | null;
  parsed: any;
} {
  let parsed: any = null;
  let rawStr = '';

  if (typeof rawPayload === 'object' && rawPayload !== null) {
    parsed = rawPayload;
  } else if (typeof rawPayload === 'string') {
    rawStr = rawPayload.trim();
    if (rawStr.startsWith('{')) {
      try {
        parsed = JSON.parse(rawStr);
      } catch (e) {
        parsed = null;
      }
    }
  }

  let candidateBookingId = parsed?.bookingId || parsed?.id || '';
  let candidateToken = parsed?.token || parsed?.tokenNumber || '';
  let candidateQrCodeId = parsed?.qrCodeId || '';

  if (!candidateBookingId && rawStr) {
    if (rawStr.includes('http://') || rawStr.includes('https://') || rawStr.includes('/ticket')) {
      try {
        const urlObj = new URL(rawStr, 'http://localhost');
        candidateBookingId =
          urlObj.searchParams.get('bookingId') ||
          urlObj.searchParams.get('id') ||
          urlObj.searchParams.get('bId') ||
          '';
        candidateToken = urlObj.searchParams.get('token') || '';
        if (!candidateBookingId) {
          const parts = urlObj.pathname.split('/').filter(Boolean);
          const lastPart = parts[parts.length - 1];
          if (lastPart && (lastPart.startsWith('b_') || lastPart.startsWith('QGO-'))) {
            candidateBookingId = lastPart;
          }
        }
      } catch {
        const match = rawStr.match(/(?:bookingId|id)=([^&]+)/i);
        if (match) candidateBookingId = decodeURIComponent(match[1]);
      }
    }

    if (!candidateBookingId) {
      candidateBookingId = rawStr;
    }
  }

  const cleanInput = (candidateBookingId || candidateToken || candidateQrCodeId || rawStr || '').trim().toUpperCase();
  const allBookings = Array.from(db.bookings.values());

  // Prioritize this salon's bookings first
  const salonBookings = allBookings.filter((b) => b.salonId === salonId);
  const searchPool = [...salonBookings, ...allBookings.filter((b) => b.salonId !== salonId)];

  const stripped = cleanInput
    .replace(/^QGO[-_\s]*/i, '')
    .replace(/^BK_TURF_/i, '')
    .replace(/^B_/i, '')
    .replace(/^QR[-_]/i, '')
    .replace(/^#/, '')
    .trim();

  // 1. Direct ID match or exact ID suffix match
  let found = searchPool.find((b) => {
    const bIdUpper = b.id.toUpperCase();
    if (bIdUpper === cleanInput || (stripped && bIdUpper === stripped)) return true;
    if (stripped && (b.id.split('_').pop() || '').toUpperCase() === stripped) return true;
    return false;
  });

  // 2. Exact Token Number / short token or exact QR Code ID match
  if (!found && stripped) {
    found = searchPool.find((b) => {
      const t = (b.tokenNumber || '').toUpperCase().replace(/^#/, '');
      const q = (b.qrCodeId || '').toUpperCase().replace(/^#/, '');
      const tShort = t.split('-').pop() || '';
      return (
        t === cleanInput ||
        t === stripped ||
        tShort === stripped ||
        q === cleanInput ||
        q === stripped
      );
    });
  }

  // 3. Exact normalized Customer Phone match
  if (!found && cleanInput) {
    const normSearchPhone = normalizePhone(cleanInput);
    if (normSearchPhone && normSearchPhone.length >= 10) {
      found = searchPool.find((b) => {
        if (!b.customerPhone) return false;
        const bNorm = normalizePhone(b.customerPhone);
        return bNorm === normSearchPhone;
      });
    }
  }

  return { booking: found || null, parsed };
}

function verifyTicketBooking(
  booking: Booking | null,
  salonId: string,
  parsed: any,
  requireSignedCustomerTicket = false,
  allowCheckedIn = false,
) {
  if (
    requireSignedCustomerTicket &&
    !booking &&
    (!parsed ||
      typeof parsed.bookingId !== 'string' ||
      typeof parsed.salonId !== 'string' ||
      typeof parsed.qrCodeId !== 'string' ||
      typeof parsed.qrSignature !== 'string')
  ) {
    return {
      status: 400,
      data: {
        valid: false,
        reason: 'INVALID_TICKET_QR',
        message: 'Scan the customer’s QGo ticket QR code. Other QR codes are not accepted.',
      },
    };
  }

  if (requireSignedCustomerTicket && parsed?.salonId && parsed.salonId !== salonId) {
    if (!booking) {
      return {
        status: 403,
        data: {
          valid: false,
          reason: 'WRONG_SALON',
          message: 'This ticket was booked for a different venue.',
        },
      };
    }
  }

  if (!booking) {
    return {
      status: 404,
      data: {
        valid: false,
        reason: 'NOT_FOUND',
        message: 'No matching booking found for this ticket QR or booking ID.',
      },
    };
  }

  if (booking.salonId !== salonId) {
    return {
      status: 403,
      data: {
        valid: false,
        reason: 'WRONG_SALON',
        message: `This ticket is for "${booking.salonName || 'another turf'}". Switch to that venue in the top header to verify.`,
        booking,
      },
    };
  }

  if (booking.status === 'cancelled') {
    return {
      status: 400,
      data: {
        valid: false,
        reason: 'CANCELLED',
        message: 'This booking has been cancelled.',
        booking,
      },
    };
  }

  if (booking.status === 'completed') {
    const timeUsed = booking.completedAt
      ? new Date(booking.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return {
      status: 400,
      data: {
        valid: false,
        reason: 'ALREADY_COMPLETED',
        message: `This ticket was already completed${timeUsed ? ` at ${timeUsed}` : ''}.`,
        completedAt: booking.completedAt,
        booking,
      },
    };
  }

  if (booking.status === 'checked_in') {
    if (!allowCheckedIn) {
      const timeUsed = booking.checkedInAt
        ? new Date(booking.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      return {
        status: 400,
        data: {
          valid: false,
          reason: 'ALREADY_CHECKED_IN',
          message: `This ticket was already checked in${timeUsed ? ` at ${timeUsed}` : ''}.`,
          checkedInAt: booking.checkedInAt,
          booking,
        },
      };
    }
  }

  if (booking.status === 'no_show') {
    return {
      status: 400,
      data: {
        valid: false,
        reason: 'NO_SHOW',
        message: 'This booking was marked as no-show.',
        booking,
      },
    };
  }

  if (booking.status !== 'confirmed' && !(allowCheckedIn && booking.status === 'checked_in')) {
    return {
      status: 400,
      data: {
        valid: false,
        reason: 'NOT_CONFIRMED',
        message: `Booking status is ${booking.status}. Only active bookings can be verified.`,
        booking,
      },
    };
  }

  // Slot date matching with Indian/local timezone tolerance
  const now = new Date();
  const todayStr = businessToday();
  let istTodayStr = todayStr;
  try {
    istTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  } catch {}
  let localTodayStr = todayStr;
  try {
    localTodayStr = new Intl.DateTimeFormat('en-CA').format(now);
  } catch {}

  const bDate = booking.scheduledDate || (booking.createdAt ? booking.createdAt.split('T')[0] : '');
  const isDateDifferent = bDate && bDate !== todayStr && bDate !== istTodayStr && bDate !== localTodayStr;

  let timeAdvisory = '';
  if (booking.scheduledTime) {
    const [sh, sm] = booking.scheduledTime.split(':').map(Number);
    if (!isNaN(sh) && !isNaN(sm)) {
      const slotStartMinutes = sh * 60 + sm;
      let slotEndMinutes = slotStartMinutes + (booking.serviceDuration || 60);
      if (booking.slotEndTime) {
        const [eh, em] = booking.slotEndTime.split(':').map(Number);
        if (!isNaN(eh) && !isNaN(em)) {
          slotEndMinutes = eh * 60 + em;
          if (slotEndMinutes < slotStartMinutes) slotEndMinutes += 24 * 60;
        }
      }
      const nowMinutes = getLocalMinutes(now);

      if (nowMinutes < slotStartMinutes - 30) {
        timeAdvisory = ` (Early Arrival: Slot starts at ${formatTime12(booking.scheduledTime)})`;
      } else if (nowMinutes > slotEndMinutes + 30) {
        timeAdvisory = ` (Slot ended at ${formatTime12(booking.slotEndTime || booking.scheduledTime)})`;
      }
    }
  }

  // Strict timing-safe HMAC Signature check
  if (parsed?.qrSignature) {
    const expectedSig = makeQrSignature(booking.id, booking.salonId, booking.qrCodeId || '');
    const sigBuffer = Buffer.from(String(parsed.qrSignature), 'utf8');
    const expectedBuffer = Buffer.from(String(expectedSig), 'utf8');
    const storedBuffer = Buffer.from(String(booking.qrSignature || ''), 'utf8');

    const matchesExpected = sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    const matchesStored = storedBuffer.length > 0 && sigBuffer.length === storedBuffer.length && crypto.timingSafeEqual(sigBuffer, storedBuffer);

    if (!matchesExpected && !matchesStored) {
      return {
        status: 403,
        data: {
          valid: false,
          reason: 'INVALID_SIGNATURE',
          message: 'QR signature could not be verified.',
          booking,
        },
      };
    }
  }

  return {
    status: 200,
    data: {
      valid: true,
      needsAcceptance: true,
      message: `Ticket verified for ${booking.customerName}.`,
      booking,
    },
  };
}

// Vendor Verify Ticket endpoint
apiRouter.post('/vendor/bookings/verify-ticket', requireAuth, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const payload = req.body.payload ?? req.body.qrData ?? req.body.code;
  const salonId = req.body.salonId;
  const source = req.body.source;
  const allowCheckedIn = req.body.allowCheckedIn === true || req.body.action === 'complete';
  if (!payload || !salonId) {
    return res.status(400).json({ error: 'payload and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const { booking, parsed } = resolveBookingFromQrPayload(payload, salonId);
  const result = verifyTicketBooking(booking, salonId, parsed, source === 'camera', allowCheckedIn);
  return res.status(result.status).json(result.data);
});

// Vendor Check-In endpoint
apiRouter.post('/vendor/bookings/:id/check-in', requireAuth, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const bookingId = req.params.id;
  const { salonId, markAsPaid } = req.body;
  if (!bookingId || !salonId) {
    return res.status(400).json({ error: 'bookingId and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const booking = db.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ valid: false, error: 'Booking not found' });
  }

  const result = verifyTicketBooking(booking, salonId, null);
  if (!result.data.valid) {
    return res.status(result.status).json(result.data);
  }

  // Atomically check-in
  booking.status = 'checked_in';
  booking.checkedInAt = new Date().toISOString();
  booking.checkedInBy = req.auth?.userId || 'owner';

  if (markAsPaid) {
    booking.paymentStatus = 'paid';
    booking.paidAmount = booking.totalAmount || booking.amount;
    booking.balanceAmount = 0;
    booking.balanceStatus = 'COLLECTED';
  }

  db.bookings.set(booking.id, booking);

  const qe = db.queueEntries.get(`qe_${booking.id}`);
  if (qe) {
    qe.isArriving = true;
  }

  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: 'checked_in',
    title: 'Booking Checked In',
    message: `You are checked in at ${booking.salonName}. Enjoy your game!`,
    bookingId: booking.id,
  });

  return res.json({
    success: true,
    valid: true,
    message: `Checked in: ${booking.customerName} is checked in successfully.`,
    booking,
  });
});

// Vendor Complete Slot endpoint — marks booking AND linked slot as completed atomically
apiRouter.post('/vendor/bookings/:id/complete-slot', requireAuth, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const bookingId = req.params.id;
  if (!bookingId || typeof bookingId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(bookingId)) {
    return res.status(400).json({ success: false, valid: false, error: 'Invalid booking ID format' });
  }

  const { salonId } = req.body;
  if (!salonId || typeof salonId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(salonId)) {
    return res.status(400).json({ success: false, valid: false, error: 'salonId is required' });
  }

  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const booking = db.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, valid: false, reason: 'NOT_FOUND', message: 'Booking not found' });
  }

  // Ownership check: must belong to the salon managed by this owner
  if (booking.salonId !== salonId) {
    return res.status(403).json({
      success: false,
      valid: false,
      reason: 'WRONG_SALON',
      message: `This ticket belongs to "${booking.salonName || 'another venue'}". Access denied.`,
    });
  }

  // Idempotency: If already completed, return 200 with alreadyCompleted: true
  if (booking.status === 'completed') {
    const timeCompleted = booking.completedAt
      ? new Date(booking.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return res.json({
      success: true,
      valid: true,
      alreadyCompleted: true,
      message: `This slot was already completed${timeCompleted ? ` at ${timeCompleted}` : ''}.`,
      completedAt: booking.completedAt,
      booking,
    });
  }

  // Reject cancelled or no-show
  if (booking.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      valid: false,
      reason: 'CANCELLED',
      message: 'This booking has been cancelled and cannot be completed.',
      booking,
    });
  }
  if (booking.status === 'no_show') {
    return res.status(400).json({
      success: false,
      valid: false,
      reason: 'NO_SHOW',
      message: 'This booking was marked as no-show and cannot be completed.',
      booking,
    });
  }

  // Atomic update: mark booking and slot completed
  const now = new Date().toISOString();
  booking.status = 'completed';
  booking.completedAt = now;
  booking.completedBy = req.auth?.userId || 'owner';
  db.bookings.set(booking.id, booking);

  const qe = db.queueEntries.get(`qe_${booking.id}`);
  if (qe) {
    qe.status = 'served';
  }

  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: 'checked_in',
    title: 'Slot Completed',
    message: `Your slot at ${booking.salonName} has been marked as Completed. Thanks for visiting!`,
    bookingId: booking.id,
  });

  return res.json({
    success: true,
    valid: true,
    alreadyCompleted: false,
    message: `Slot completed: ${booking.customerName} marked as completed.`,
    completedAt: now,
    booking,
  });
});

// Dedicated Owner Ticket Verification & Completion Endpoints
interface OwnerTicketDetails {
  ticketId: string;
  customerName: string;
  venueName: string;
  slotId: string;
  slotDate: string;
  slotTime: string;
  currentStatus: Booking['status'];
  completedAt?: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  paymentType?: string;
  paymentStatus?: string;
  balanceCollected?: boolean;
}

interface OwnerRecentScan extends OwnerTicketDetails {
  scannedAt: string;
  completedBy: string;
}

function ticketTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date) return date.toISOString();
  }
  return undefined;
}

function ticketDetails(booking: Booking): OwnerTicketDetails {
  const completedAt = ticketTimestamp(booking.completedAt);
  const totalAmount = Number(booking.totalAmount || (booking as any).amount || (booking as any).price || 0);
  const rawPaid = Number(booking.paidAmount ?? (booking.paymentType === 'ADVANCE' ? booking.advanceAmount : 0) ?? 0);
  const isPaid = booking.paymentStatus === 'PAID' || Boolean(booking.balanceCollected) || (rawPaid > 0 && rawPaid >= totalAmount);
  const paidAmount = isPaid ? totalAmount : rawPaid;
  const balanceDue = isPaid ? 0 : Math.max(0, Number(booking.balanceAmount ?? (totalAmount - paidAmount)));

  return {
    ticketId: booking.id,
    customerName: booking.customerName,
    venueName: booking.salonName,
    slotId: getBookingSlotId(booking),
    slotDate: booking.scheduledDate || '',
    slotTime: booking.scheduledTime || '',
    currentStatus: booking.status,
    totalAmount,
    paidAmount,
    balanceDue,
    paymentType: booking.paymentType || (balanceDue > 0 ? 'ADVANCE' : 'FULL'),
    paymentStatus: isPaid ? 'PAID' : (booking.paymentStatus || 'PARTIALLY_PAID'),
    balanceCollected: Boolean(booking.balanceCollected || isPaid),
    ...(completedAt ? { completedAt } : {}),
  };
}

apiRouter.post('/owner/tickets/verify', requireAuth, requireTicketOwner, checkinLimiter, (req: AuthenticatedRequest, res: Response) => {
  const ticketId = extractOwnerTicketId(req.body?.ticketId);
  if (!ticketId) {
    return res.status(400).json({ success: false, code: 'INVALID_TICKET_ID', message: 'Enter a valid ticket ID or scan the ticket QR.' });
  }

  const booking = findOwnerTicketBooking(ticketId, db.bookings.values());
  if (!booking) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Ticket not found. Check the ID or scan the QR again.' });
  }

  const salon = db.salons.get(booking.salonId);
  if (!salon || salon.ownerId !== req.auth!.userId) {
    return res.status(403).json({ success: false, code: 'WRONG_OWNER', message: 'This ticket belongs to a different venue owner.' });
  }

  const details = ticketDetails(booking);
  if (booking.status === 'completed') {
    return res.status(409).json({
      success: false,
      code: 'ALREADY_COMPLETED',
      message: 'This ticket has already been completed.',
      ...details,
    });
  }

  const eligibilityError = getOwnerTicketEligibilityError(booking, isBookingExpired(booking));
  if (eligibilityError) {
    return res.status(400).json({
      success: false,
      code: eligibilityError.code,
      message: eligibilityError.message,
      ...details,
    });
  }

  return res.json({ success: true, ...details });
});

apiRouter.post('/owner/tickets/complete', requireAuth, requireTicketOwner, checkinLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = extractOwnerTicketId(req.body?.ticketId);
  if (!ticketId) {
    return res.status(400).json({ success: false, code: 'INVALID_TICKET_ID', message: 'Enter a valid ticket ID or scan the ticket QR.' });
  }

  const cachedBooking = findOwnerTicketBooking(ticketId, db.bookings.values());
  if (!cachedBooking) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Ticket not found. Check the ID or scan the QR again.' });
  }
  const cachedSalon = db.salons.get(cachedBooking.salonId);
  if (!cachedSalon || cachedSalon.ownerId !== req.auth!.userId) {
    return res.status(403).json({ success: false, code: 'WRONG_OWNER', message: 'This ticket belongs to a different venue owner.' });
  }

  const now = new Date().toISOString();
  const bookingRef = adminDb.collection('bookings').doc(cachedBooking.id);
  const salonRef = adminDb.collection('salons').doc(cachedBooking.salonId);
  const recentScansRef = adminDb.collection('ownerRecentScans').doc(req.auth!.userId);

  try {
    const outcome = await adminDb.runTransaction(async (transaction) => {
      const [bookingSnapshot, salonSnapshot, recentScansSnapshot] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(salonRef),
        transaction.get(recentScansRef),
      ]);
      if (!bookingSnapshot.exists) return { kind: 'not_found' as const };

      const currentBooking = bookingSnapshot.data() as Booking;
      const currentSalon = salonSnapshot.data() as Salon | undefined;
      if (!salonSnapshot.exists || currentSalon?.ownerId !== req.auth!.userId) {
        return { kind: 'wrong_owner' as const };
      }

      if (currentBooking.status === 'completed') {
        return { kind: 'already_completed' as const, booking: currentBooking };
      }
      const eligibilityError = getOwnerTicketEligibilityError(currentBooking, isBookingExpired(currentBooking));
      if (eligibilityError) {
        return { kind: 'ineligible' as const, booking: currentBooking, error: eligibilityError };
      }

      const collectBalance = Boolean(req.body?.collectBalance);
      const totalAmount = Number(currentBooking.totalAmount || (currentBooking as any).amount || (currentBooking as any).price || 0);

      const completedDetails: OwnerTicketDetails = {
        ...ticketDetails(currentBooking),
        currentStatus: 'completed',
        completedAt: now,
      };

      if (collectBalance) {
        completedDetails.balanceDue = 0;
        completedDetails.paidAmount = totalAmount;
        completedDetails.paymentStatus = 'PAID';
        completedDetails.balanceCollected = true;
      }

      const scan: OwnerRecentScan = {
        ...completedDetails,
        scannedAt: now,
        completedBy: req.auth!.userId,
      };
      const recentData = recentScansSnapshot.data();
      const existingScans: OwnerRecentScan[] = Array.isArray(recentData?.scans)
        ? recentData.scans.filter((entry: unknown): entry is OwnerRecentScan => (
          typeof entry === 'object' && entry !== null && 'ticketId' in entry && 'scannedAt' in entry
        ))
        : [];
      const scans = [scan, ...existingScans.filter((entry) => entry.ticketId !== currentBooking.id)].slice(0, 20);

      const bookingUpdates: any = {
        status: 'completed',
        slotStatus: 'completed',
        slotId: completedDetails.slotId,
        completedAt: FieldValue.serverTimestamp(),
        completedBy: req.auth!.userId,
      };

      if (collectBalance) {
        bookingUpdates.paymentStatus = 'PAID';
        bookingUpdates.balanceAmount = 0;
        bookingUpdates.balanceCollected = true;
        bookingUpdates.paidAmount = totalAmount;
      }

      transaction.update(bookingRef, bookingUpdates);
      transaction.set(recentScansRef, {
        scans,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { kind: 'completed' as const, booking: currentBooking, details: completedDetails };
    });

    if (outcome.kind === 'not_found') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Ticket not found. Check the ID or scan the QR again.' });
    }
    if (outcome.kind === 'wrong_owner') {
      return res.status(403).json({ success: false, code: 'WRONG_OWNER', message: 'This ticket belongs to a different venue owner.' });
    }
    if (outcome.kind === 'ineligible') {
      return res.status(400).json({
        success: false,
        code: outcome.error.code,
        message: outcome.error.message,
        ...ticketDetails(outcome.booking),
      });
    }
    if (outcome.kind === 'already_completed') {
      return res.json({
        success: false,
        code: 'ALREADY_COMPLETED',
        message: 'This ticket has already been completed.',
        ...ticketDetails(outcome.booking),
      });
    }

    const completedBooking: Booking = {
      ...outcome.booking,
      slotId: outcome.details.slotId,
      slotStatus: 'completed',
      status: 'completed',
      completedAt: now,
      completedBy: req.auth!.userId,
      ...(req.body?.collectBalance ? {
        paymentStatus: 'PAID' as const,
        balanceAmount: 0,
        balanceCollected: true,
        paidAmount: Number(outcome.booking.totalAmount || (outcome.booking as any).amount || (outcome.booking as any).price || 0),
      } : {}),
    };
    db.bookings.cache(completedBooking.id, completedBooking);

    // Sync any linked queue entry to completed and recalculate queue
    const linkedQe = db.queueEntries.get(`qe_${completedBooking.id}`) ||
      Array.from(db.queueEntries.values()).find((q) => q.bookingId === completedBooking.id);
    if (linkedQe) {
      linkedQe.status = 'served';
      db.queueEntries.set(linkedQe.id, linkedQe);
    }
    db.recalculateQueue(completedBooking.salonId);

    sendNotification(completedBooking.customerId, {
      userId: completedBooking.customerId,
      type: 'checked_in',
      title: 'Slot Completed',
      message: `Your slot at ${completedBooking.salonName} has been marked as Completed.`,
      bookingId: completedBooking.id,
    });

    return res.json({
      success: true,
      message: 'Ticket and its slot are marked completed.',
      ...outcome.details,
    });
  } catch (error) {
    console.error('[Owner ticket completion] Firestore transaction failed:', error);
    return res.status(500).json({ success: false, code: 'COMPLETION_FAILED', message: 'Could not complete the ticket. Please retry.' });
  }
});

apiRouter.post('/checkin/scan', requireAuth, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { qrData, salonId } = req.body;
  if (!qrData || !salonId) {
    return res.status(400).json({ error: 'QR data and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const { booking, parsed } = resolveBookingFromQrPayload(qrData, salonId);
  const result = verifyTicketBooking(booking, salonId, parsed);
  return res.status(result.status).json(result.data);
});

apiRouter.post('/checkin/accept', requireAuth, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, salonId, markAsPaid } = req.body;
  if (!bookingId || !salonId) {
    return res.status(400).json({ error: 'bookingId and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const booking = db.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ valid: false, reason: 'NOT_FOUND', message: 'Booking not found' });
  }

  const result = verifyTicketBooking(booking, salonId, null);
  if (!result.data.valid) {
    return res.status(result.status).json(result.data);
  }

  booking.status = 'checked_in';
  booking.checkedInAt = new Date().toISOString();
  booking.checkedInBy = req.auth?.userId || 'owner';

  if (markAsPaid) {
    booking.paymentStatus = 'paid';
    booking.paidAmount = booking.totalAmount || booking.amount;
    booking.balanceAmount = 0;
    booking.balanceStatus = 'COLLECTED';
  }

  db.bookings.set(booking.id, booking);

  const qe = db.queueEntries.get(`qe_${booking.id}`);
  if (qe) {
    qe.isArriving = true;
  }

  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: 'checked_in',
    title: 'Booking Accepted',
    message: `You are checked in at ${booking.salonName}. Enjoy your slot.`,
    bookingId: booking.id,
  });

  return res.json({
    valid: true,
    message: `Accepted: ${booking.customerName} is checked in.`,
    booking,
  });
});

// Manual 6-character Join Code Fallback
apiRouter.post('/checkin/manual-code', requireAuth, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { code, salonId } = req.body;
  if (!code || !salonId) {
    return res.status(400).json({ error: 'Code and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const { booking, parsed } = resolveBookingFromQrPayload(code, salonId);
  const result = verifyTicketBooking(booking, salonId, parsed);
  return res.status(result.status).json(result.data);
});

// ----------------------------------------------------
// 8. REVIEWS & RATINGS
// ----------------------------------------------------

apiRouter.get('/salons/:id/reviews', (req: Request, res: Response) => {
  const { id } = req.params;
  const includePrivate = false;
  const reviews = Array.from(db.reviews.values())
    .filter((r) => r.salonId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ success: true, reviews: reviews.map((r) => sanitizeReview(r, includePrivate)) });
});

apiRouter.post('/reviews', requireAuth, requireRole('consumer'), validateBody(reviewCreationSchema), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, salonId, staffId, rating, comment } = req.body;

  if (!bookingId || !salonId || !rating) {
    return res.status(400).json({ error: 'Booking, salon, and rating (1-5) are required' });
  }
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }

  const booking = db.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.customerId !== req.auth!.userId || booking.salonId !== salonId) {
    return forbidden(res);
  }
  // Allow reviews on confirmed or completed bookings
  if (booking.status !== 'completed' && booking.status !== 'confirmed') {
    return res.status(403).json({ error: 'Only confirmed or completed bookings can be reviewed' });
  }

  const staff = staffId ? db.staff.get(staffId) : undefined;
  if (staffId && !staff) {
    return res.status(404).json({ error: 'Staff member not found' });
  }
  if (staff && staff.salonId !== salonId) {
    return res.status(400).json({ error: 'Staff member does not belong to this salon' });
  }
  if (staffId && booking.staffId && staffId !== booking.staffId) {
    return forbidden(res);
  }

  const existingReview = Array.from(db.reviews.values()).find(
    (r) => r.bookingId === bookingId && r.customerId === req.auth!.userId
  );
  if (existingReview) {
    existingReview.rating = numericRating;
    existingReview.comment = typeof comment === 'string' ? comment.trim() : existingReview.comment;
    existingReview.createdAt = new Date().toISOString();

    const allReviews = Array.from(db.reviews.values()).filter((r) => r.salonId === salonId);
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    salon.rating = Math.round(avg * 10) / 10;
    salon.reviewCount = allReviews.length;

    return res.status(200).json({ success: true, review: existingReview, updated: true });
  }

  const revId = `rev_${Date.now()}`;
  const review: Review = {
    id: revId,
    bookingId,
    customerId: req.auth!.userId,
    customerName: req.auth!.user.name || 'Verified Customer',
    salonId,
    staffId: staff?.id || booking.staffId,
    staffName: staff?.name || booking.staffName,
    rating: numericRating,
    comment: typeof comment === 'string' ? comment.trim() : '',
    createdAt: new Date().toISOString(),
  };

  db.reviews.set(revId, review);

  // Recalculate average rating for salon
  const allReviews = Array.from(db.reviews.values()).filter((r) => r.salonId === salonId);
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  salon.rating = Math.round(avg * 10) / 10;
  salon.reviewCount = allReviews.length;

  return res.status(201).json({ success: true, review });
});

apiRouter.post('/reviews/:id/response', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { response } = req.body;

  const review = db.reviews.get(id);
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }
  if (!canManageSalon(req.auth, review.salonId)) {
    return forbidden(res);
  }

  review.ownerResponse = response;
  return res.json({ success: true, review });
});

// ----------------------------------------------------
// 9. OWNER ANALYTICS & CSV EXPORT
// ----------------------------------------------------

apiRouter.get('/salons/:id/analytics', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const analytics = db.getAnalytics(id);
  return res.json({ success: true, analytics });
});

apiRouter.get('/salons/:id/analytics/export-csv', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const bookings = Array.from(db.bookings.values()).filter((b) => b.salonId === id);

  const safe = (value: unknown) => {
    const text = String(value ?? '').replaceAll('"', '""');
    return `"${/^[=+\-@\t\r]/.test(text) ? `'${text}` : text}"`;
  };
  let csv = 'BookingID,TokenNumber,CustomerName,Phone,Service,Price,Status,Mode,Date,Created\n';
  bookings.forEach((b) => {
    csv += `${safe(b.id)},${safe(b.tokenNumber || '')},${safe(b.customerName)},${safe(b.customerPhone)},${safe(b.serviceName)},${Number(b.amount) || 0},${safe(b.status)},${safe(b.mode)},${safe(b.scheduledDate || '')},${safe(b.createdAt)}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=qgo_report_${id}.csv`);
  return res.send(csv);
});

// ----------------------------------------------------
// 9.5 OWNER DASHBOARD, REVENUE, CUSTOMERS & SLOTS API
// ----------------------------------------------------

// Simulate approval for dev/testing (owner-only; keeps real /approve admin-only)
apiRouter.post('/salons/:id/simulate-approve', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Disabled in production' });
  const { id } = req.params;
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }

  // Approve the salon
  salon.status = 'approved';
  salon.isPublished = true;
  salon.verified = true;
  salon.setupStep = 8;

  // Ensure the owner user record has salonId set
  const ownerUser = db.users.get(req.auth!.userId);
  if (ownerUser && !ownerUser.salonId) {
    ownerUser.salonId = id;
    ownerUser.role = 'owner';
  }

  // Ensure a userRoles entry exists for this owner/salon pair
  const existingRole = Array.from(db.userRoles.values()).find(
    (r) => r.userId === req.auth!.userId && r.role === 'owner'
  );
  if (existingRole && !existingRole.businessId) {
    existingRole.businessId = id;
  } else if (!existingRole) {
    const roleId = `role_${req.auth!.userId}_${id}`;
    db.userRoles.set(roleId, {
      id: roleId,
      userId: req.auth!.userId,
      role: 'owner',
      status: 'active',
      businessId: id,
    });
  }

  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: 'business_approved',
    title: 'Business Approved 🎉',
    message: 'Your business has been approved. Your QGo business is now live.',
  });

  const builtUser = ownerUser ? buildAuthenticatedUser(ownerUser, 'owner', req.auth!.claims) : undefined;
  return res.json({
    success: true,
    message: 'Business approved successfully',
    salon,
    user: builtUser,
  });
});

apiRouter.post('/salons/:id/approve', requireAuth, requireAdmin, approveBusinessUnified);

apiRouter.get('/salons/:id/dashboard-overview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const now = new Date();
  const todayStr = getLocalDateString(now);
  const todayDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayFormatted = `${todayDayNames[now.getDay()]}, ${now.getDate()} ${now.toLocaleString('default', { month: 'short' })}`;

  const allSalonBookings = Array.from(db.bookings.values()).filter((b) => b.salonId === id);

  // Today's bookings count & revenue
  const todayBookings = allSalonBookings.filter(
    (b) => (b.scheduledDate === todayStr || (b.createdAt.startsWith(todayStr) && b.mode === 'token')) && b.status !== 'cancelled'
  );
  const todayBookingsCount = todayBookings.length;
  const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Upcoming bookings
  const upcomingBookingsCount = allSalonBookings.filter(
    (b) => b.status === 'confirmed' && b.scheduledDate && b.scheduledDate >= todayStr
  ).length;

  // Completed & Cancelled total counts
  const completedBookingsCount = allSalonBookings.filter((b) => b.status === 'completed').length;
  const cancelledBookingsCount = allSalonBookings.filter((b) => b.status === 'cancelled').length;

  // Calculate Today's Slots
  const turfSlotsResult = calculateTurfSlotsForDate(salon, todayStr);
  const todaySlots = turfSlotsResult.slots;
  const availableSlotsCount = todaySlots.filter((s) => s.available && !s.isBooked && !s.isBlocked).length;

  return res.json({
    success: true,
    data: {
      todayBookingsCount,
      todayRevenue,
      upcomingBookingsCount,
      availableSlotsCount,
      completedBookingsCount,
      cancelledBookingsCount,
      todayDateStr: todayStr,
      todayFormatted,
      todaySlots,
    },
  });
});

apiRouter.get('/salons/:id/customers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const allBookings = Array.from(db.bookings.values()).filter((b) => b.salonId === id);
  const customerMap = new Map<string, OwnerCustomerSummary>();

  for (const b of allBookings) {
    const custId = b.customerId || b.customerPhone;
    if (!customerMap.has(custId)) {
      customerMap.set(custId, {
        customerId: custId,
        name: b.customerName,
        phone: b.customerPhone,
        totalBookings: 0,
        totalSpent: 0,
        cancellationCount: 0,
      });
    }

    const c = customerMap.get(custId)!;
    c.totalBookings += 1;
    if (b.status !== 'cancelled') {
      c.totalSpent += b.amount || 0;
    }
    if (b.status === 'cancelled') {
      c.cancellationCount += 1;
    }

    const bDate = b.scheduledDate || b.createdAt.split('T')[0];
    if (!c.lastBookingDate || bDate > c.lastBookingDate) {
      c.lastBookingDate = bDate;
    }
    if (b.status === 'confirmed' && b.scheduledDate && b.scheduledDate >= getLocalDateString(new Date())) {
      if (!c.upcomingBookingDate || b.scheduledDate < c.upcomingBookingDate) {
        c.upcomingBookingDate = b.scheduledDate;
      }
    }
  }

  const customers = Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  return res.json({ success: true, customers });
});

apiRouter.get('/salons/:id/revenue-stats', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { period = 'month', startDate, endDate } = req.query;

  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const now = new Date();
  const todayStr = getLocalDateString(now);
  let filterStart = '1970-01-01';
  let filterEnd = '2099-12-31';

  if (period === 'today') {
    filterStart = todayStr;
    filterEnd = todayStr;
  } else if (period === 'week') {
    filterStart = shiftBusinessDate(todayStr, -7);
  } else if (period === 'month') {
    filterStart = shiftBusinessDate(todayStr, -30);
  } else if (startDate && typeof startDate === 'string') {
    filterStart = startDate;
    if (endDate && typeof endDate === 'string') filterEnd = endDate;
  }

  const bookings = Array.from(db.bookings.values()).filter((b) => {
    if (b.salonId !== id) return false;
    const bDate = b.scheduledDate || b.createdAt.split('T')[0];
    return bDate >= filterStart && bDate <= filterEnd;
  });

  let grossRevenue = 0;
  let completedRevenue = 0;
  let completedBookingsCount = 0;
  let cancelledBookingsCount = 0;
  let totalRefunds = 0;

  const transactions = bookings.map((b) => {
    if (b.status === 'completed') {
      completedBookingsCount += 1;
      completedRevenue += b.amount || 0;
      grossRevenue += b.amount || 0;
    } else if (b.status === 'cancelled') {
      cancelledBookingsCount += 1;
      totalRefunds += b.refundAmount || 0;
      // nonRefundable retained is part of net revenue
      grossRevenue += b.amount || 0;
    } else if (b.status === 'confirmed' || b.status === 'checked_in') {
      grossRevenue += b.amount || 0;
    }

    return {
      bookingId: b.id,
      tokenNumber: b.tokenNumber,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      serviceName: b.serviceName,
      amount: b.amount || 0,
      refundAmount: b.refundAmount,
      status: b.status,
      paymentStatus: b.paymentStatus,
      scheduledDate: b.scheduledDate,
      scheduledTime: b.scheduledTime,
      createdAt: b.createdAt,
    };
  });

  const netRevenue = Math.max(0, grossRevenue - totalRefunds);

  return res.json({
    success: true,
    data: {
      grossRevenue,
      completedBookingsCount,
      completedRevenue,
      cancelledBookingsCount,
      totalRefunds,
      netRevenue,
      period: period as any,
      transactions: transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    },
  });
});

apiRouter.post('/salons/:id/block-slot', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, startTime, endTime, resourceId, reason } = req.body;

  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  // Find any existing active booking for this slot
  const affectedBookings = Array.from(db.bookings.values()).filter(
    (b) =>
      b.salonId === id &&
      b.scheduledDate === date &&
      b.scheduledTime === startTime &&
      b.status !== 'cancelled' &&
      (!resourceId || b.resourceId === resourceId)
  );

  // Add slot override to salon.turfSchedule
  const schedules = salon.turfSchedule || [];
  const matchingSchedules = resourceId ? schedules.filter((s) => s.resourceId === resourceId) : schedules;
  const targetSchedules = matchingSchedules.length > 0 ? matchingSchedules : (schedules.length > 0 ? [schedules[0]] : []);

  for (const schedule of targetSchedules) {
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const dayConfig = schedule.days?.find((d) => d.dayOfWeek === dayOfWeek);
    if (dayConfig) {
      dayConfig.disabledSlots = dayConfig.disabledSlots || [];
      if (!dayConfig.disabledSlots.includes(startTime)) {
        dayConfig.disabledSlots.push(startTime);
      }
      if (dayConfig.slots) {
        const slotItem = dayConfig.slots.find((s) => s.startTime === startTime);
        if (slotItem) slotItem.status = 'blocked';
      }
    }
  }

  db.salons.set(id, salon);

  return res.json({
    success: true,
    message: `Slot ${startTime} on ${date} blocked successfully.`,
    affectedBookings,
  });
});

apiRouter.post('/salons/:id/unblock-slot', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, startTime, resourceId } = req.body;

  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const schedules = salon.turfSchedule || [];
  const matchingSchedules = resourceId ? schedules.filter((s) => s.resourceId === resourceId) : schedules;
  const targetSchedules = matchingSchedules.length > 0 ? matchingSchedules : (schedules.length > 0 ? [schedules[0]] : []);

  for (const schedule of targetSchedules) {
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const dayConfig = schedule.days?.find((d) => d.dayOfWeek === dayOfWeek);
    if (dayConfig) {
      if (dayConfig.disabledSlots) {
        dayConfig.disabledSlots = dayConfig.disabledSlots.filter((t) => t !== startTime);
      }
      if (dayConfig.slots) {
        const slotItem = dayConfig.slots.find((s) => s.startTime === startTime);
        if (slotItem && slotItem.status === 'blocked') slotItem.status = 'active';
      }
    }
  }

  db.salons.set(id, salon);

  return res.json({
    success: true,
    message: `Slot ${startTime} on ${date} unblocked.`,
  });
});

apiRouter.post('/salons/:id/block-date', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, dates, reason = 'Personal Holiday / Private Event', forceCancelBookings } = req.body;
  const targetDates = dates && Array.isArray(dates) && dates.length > 0 ? dates : (date ? [date] : []);
  if (targetDates.length === 0) return res.status(400).json({ error: 'No dates provided to block' });

  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const affectedBookings = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === id && b.scheduledDate && targetDates.includes(b.scheduledDate) && b.status !== 'cancelled'
  );

  if (affectedBookings.length > 0 && !forceCancelBookings) {
    return res.status(409).json({
      error: `There are ${affectedBookings.length} existing booking(s) on the selected dates.`,
      hasConflicts: true,
      affectedBookings,
    });
  }

  // Cancel affected bookings if forced
  if (forceCancelBookings && affectedBookings.length > 0) {
    for (const b of affectedBookings) {
      b.status = 'cancelled';
      b.cancellationReason = `Date blocked by owner: ${reason}`;
      b.refundAmount = b.amount;
      b.refundPercentage = 100;
      b.refundStatus = 'pending';
      releaseBookingSlotLock(b);
      db.bookings.set(b.id, b);

      sendNotification(b.customerId, {
        userId: b.customerId,
        type: 'cancelled',
        title: 'Booking Cancelled (Full Refund)',
        message: `Your booking on ${b.scheduledDate} at ${salon.name} was cancelled due to: ${reason}. Full refund of ₹${b.amount} has been initiated.`,
        bookingId: b.id,
      });
    }
  }

  // Add to specialDates across all schedules in salon.turfSchedule
  salon.holidays = salon.holidays || [];
  const schedules = salon.turfSchedule || [];
  for (const schedule of schedules) {
    schedule.specialDates = schedule.specialDates || [];
  }

  for (const d of targetDates) {
    if (!salon.holidays.some((h) => h.date === d)) {
      salon.holidays.push({ date: d, reason });
    }
    for (const schedule of schedules) {
      if (!schedule.specialDates.some((sd) => sd.date === d)) {
        schedule.specialDates.push({ date: d, reason, isClosed: true });
      }
    }
  }

  db.salons.set(id, salon);

  return res.json({
    success: true,
    message: `${targetDates.length} date(s) blocked successfully.`,
    affectedBookings,
  });
});

// ----------------------------------------------------
// 10. NOTIFICATIONS
// ----------------------------------------------------

apiRouter.post('/salons/:id/unblock-date', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { dates } = req.body;
  if (!canManageSalon(req.auth, id)) return forbidden(res);
  if (!dates || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'No dates' });
  const salon = db.salons.get(id);
  if (!salon) return res.status(404).json({ error: 'Not found' });
  if (salon.holidays) salon.holidays = salon.holidays.filter(h => !dates.includes(h.date));
  if (salon.turfSchedule) {
    for (const schedule of salon.turfSchedule) {
      if (schedule.specialDates) {
        schedule.specialDates = schedule.specialDates.filter(sd => !dates.includes(sd.date));
      }
    }
  }
  db.salons.set(id, salon);
  return res.json({ success: true, message: 'unblocked' });
});

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifs = db.notifications.get(req.auth!.userId) || [];
  return res.json({ success: true, notifications: notifs });
});

apiRouter.patch('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifs = db.notifications.get(req.auth!.userId) || [];
  notifs.forEach((n) => (n.read = true));
  db.notifications.set(req.auth!.userId, notifs);

  return res.json({ success: true, message: 'All notifications marked as read' });
});

// ----------------------------------------------------
// 11. AUTOMATIC BACKGROUND REMINDER & RECURRING SCHEDULER
// ----------------------------------------------------

export function startNotificationAndSlotScheduler(): void {
  // Check reminders every 30 seconds
  setInterval(() => {
    try {
      const now = new Date();
      const todayStr = getLocalDateString(now);
      const nowMinutes = getLocalMinutes(now);

      const istDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const istDayOfWeek = istDateObj.getDay(); // 0: Sun, 1: Mon
      const istDayOfMonth = istDateObj.getDate(); // 1 to 31

      // ─── A. CUSTOM TIME ADMIN REMINDERS (e.g. 12:40 PM IST) ───
      for (const reminder of db.adminReminders.values()) {
        if (!reminder.triggered && !reminder.acknowledged) {
          const reminderDate = reminder.scheduledDate || reminder.targetDate || todayStr;
          if (
            reminderDate === todayStr &&
            nowMinutes >= reminder.targetMinutesOfDay &&
            nowMinutes <= reminder.targetMinutesOfDay + 30
          ) {
            reminder.triggered = true;
            reminder.triggeredAt = now.toISOString();
            db.adminReminders.set(reminder.id, reminder);

            // Audit log
            const logId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            db.adminAuditLogs.set(logId, {
              id: logId,
              adminId: reminder.adminId || 'system',
              action: 'ADMIN_REMINDER_TRIGGERED',
              targetType: 'reminder',
              targetId: reminder.id,
              details: {
                title: reminder.title,
                targetTime: reminder.targetTime,
                scheduledDate: reminder.scheduledDate,
                notifyPhone: reminder.notifyPhone,
              },
              timestamp: now.toISOString(),
            });

            // 1. Real Twilio Outbound Cellular SIM Voice Call
            placeTwilioCellularCall(
              reminder.notifyPhone || '9600971886',
              `${reminder.title}. ${reminder.note || 'Scheduled executive call reminder from Qbe.'}`
            ).catch(() => {});

            // 2. Optional WhatsApp Cloud API Dispatch
            if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
              const waText = `🚨 *Qbe Reminder Call Alert*\n*Title:* ${reminder.title}\n*Time:* ${reminder.targetTime}\n*Date:* ${reminderDate}\n*Note:* ${reminder.note || 'No notes'}`;
              fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: `91${reminder.notifyPhone || '9600971886'}`,
                  type: 'text',
                  text: { body: waText },
                }),
              }).catch(() => {});
            }
          }
        }
      }

      // ─── B. DAILY 9:00 PM IST EXECUTIVE BRIEFING RUN ───
      if (nowMinutes >= 21 * 60 && nowMinutes <= 21 * 60 + 30) {
        const dailyBriefingKey = `qgo.autoBriefing.daily.${todayStr}`;
        if (!db.adminAuditLogs.has(dailyBriefingKey)) {
          let todayGmv = 0;
          let todayBookings = 0;
          for (const b of db.bookings.values()) {
            if (b.scheduledDate === todayStr && b.status !== 'cancelled') {
              todayGmv += (b.amount || 0);
              todayBookings++;
            }
          }
          const qgoEarnings = todayBookings * 35.40;

          db.adminAuditLogs.set(dailyBriefingKey, {
            id: dailyBriefingKey,
            adminId: 'system',
            action: 'DAILY_9PM_EXECUTIVE_BRIEFING',
            targetType: 'telemetry',
            targetId: todayStr,
            details: { todayGmv, todayBookings, qgoEarnings },
            timestamp: now.toISOString(),
          });
        }
      }

      // ─── C. WEEKLY MONDAY 9:00 AM IST OWNER PAYOUT RUN ───
      if (istDayOfWeek === 1 && nowMinutes >= 9 * 60 && nowMinutes <= 9 * 60 + 30) {
        const weeklyKey = `qgo.autoBriefing.weekly.${todayStr}`;
        if (!db.adminAuditLogs.has(weeklyKey)) {
          let totalDue = 0;
          let dueCount = 0;
          for (const salon of db.salons.values()) {
            const calc = computeSalonSettlement(salon);
            if (calc.isPayoutDue && calc.netOwnerPayable > 0) {
              totalDue += calc.netOwnerPayable;
              dueCount++;
            }
          }

          db.adminAuditLogs.set(weeklyKey, {
            id: weeklyKey,
            adminId: 'system',
            action: 'WEEKLY_MONDAY_PAYOUT_ALARM',
            targetType: 'settlement',
            targetId: todayStr,
            details: { totalDue, dueCount },
            timestamp: now.toISOString(),
          });
        }
      }

      // ─── D. MONTHLY 1ST 9:00 AM IST OWNER PAYOUT RUN ───
      if (istDayOfMonth === 1 && nowMinutes >= 9 * 60 && nowMinutes <= 9 * 60 + 30) {
        const monthlyKey = `qgo.autoBriefing.monthly.${todayStr}`;
        if (!db.adminAuditLogs.has(monthlyKey)) {
          let totalDue = 0;
          let dueCount = 0;
          for (const salon of db.salons.values()) {
            const calc = computeSalonSettlement(salon);
            if (calc.isPayoutDue && calc.netOwnerPayable > 0) {
              totalDue += calc.netOwnerPayable;
              dueCount++;
            }
          }

          db.adminAuditLogs.set(monthlyKey, {
            id: monthlyKey,
            adminId: 'system',
            action: 'MONTHLY_FIRST_PAYOUT_ALARM',
            targetType: 'settlement',
            targetId: todayStr,
            details: { totalDue, dueCount },
            timestamp: now.toISOString(),
          });
        }
      }

      // ─── E. 24/7 ANOMALY & FRAUD WATCHDOG ───
      const cancelCountsBySalon = new Map<string, number>();
      for (const b of db.bookings.values()) {
        if (b.status === 'cancelled' && b.scheduledDate === todayStr) {
          cancelCountsBySalon.set(b.salonId, (cancelCountsBySalon.get(b.salonId) || 0) + 1);
        }
      }
      for (const [salonId, count] of cancelCountsBySalon.entries()) {
        if (count >= 3) {
          const anomalyKey = `qgo.anomaly.cancelSurge.${salonId}.${todayStr}`;
          if (!db.adminAuditLogs.has(anomalyKey)) {
            const salon = db.salons.get(salonId);
            db.adminAuditLogs.set(anomalyKey, {
              id: anomalyKey,
              adminId: 'system',
              action: 'ANOMALY_CANCELLATION_SURGE',
              targetType: 'salon',
              targetId: salonId,
              details: { salonName: salon?.name || salonId, cancellationCount: count },
              timestamp: now.toISOString(),
            });
          }
        }
      }

      // ─── F. CUSTOMER & OWNER BOOKING REMINDERS ───
      for (const booking of db.bookings.values()) {
        if (
          (booking.status === 'confirmed' || booking.status === 'pending') &&
          booking.scheduledDate === todayStr &&
          booking.scheduledTime &&
          !booking.reminderSent
        ) {
          const salon = db.salons.get(booking.salonId);
          const reminderMins = booking.reminderMinutesBefore ?? salon?.bookingSettings?.reminderMinutesBefore ?? 30;
          const startM = timeToMinutes(booking.scheduledTime);
          const diff = startM - nowMinutes;

          if (diff <= reminderMins && diff >= -15) {
            booking.reminderSent = true;
            sendNotification(booking.customerId, {
              userId: booking.customerId,
              type: 'reminder',
              title: 'Slot Starting Soon!',
              message: `Your booking at ${booking.salonName} (${booking.resourceName || 'Turf'}) starts in ${reminderMins} minutes at ${format12Hour(booking.scheduledTime)}. Please arrive on time!`,
              bookingId: booking.id,
            });
          }
        }

        // Owner Balance Reminder
        if (
          booking.status === 'confirmed' &&
          booking.balanceAmount && booking.balanceAmount > 0 &&
          booking.scheduledDate === todayStr &&
          booking.slotEndTime &&
          !(booking).balanceReminderSent
        ) {
          const endM = timeToMinutes(booking.slotEndTime);
          if (endM - nowMinutes <= 15 && endM - nowMinutes >= -60) {
            booking.balanceReminderSent = true;
            db.bookings.set(booking.id, booking);
            const salon = db.salons.get(booking.salonId);
            if (salon) {
              sendNotification(salon.ownerId, {
                userId: salon.ownerId,
                title: 'Collect Balance Amount',
                message: `Balance ₹${booking.balanceAmount} pending for ${booking.customerName || 'Customer'} — Slot ${format12Hour(booking.scheduledTime)} to ${format12Hour(booking.slotEndTime)}. Please collect the balance.`,
                type: 'reminder',
                bookingId: booking.id,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in background reminder scheduler:', err);
    }
  }, 30000);
}
