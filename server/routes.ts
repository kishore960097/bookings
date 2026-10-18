import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { adminAuth } from './firebaseAdmin';
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
} from '../src/types';
import crypto from 'crypto';
import { format12Hour, minutesToTime, timeToMinutes } from '../packages/shared/src/time';

const qrSigningSecret = process.env.QGO_SESSION_SECRET;
const platformAdminEmails = new Set(
  (process.env.QGO_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

if (!qrSigningSecret) {
  throw new Error('QGO_SESSION_SECRET must be configured to issue and validate QR tickets.');
}

type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    role: UserRole;
    user: User;
    claims: Record<string, unknown>;
  };
};

const normalizeEmail = (email?: string) => email?.trim().normalize('NFKC').toLowerCase() || '';
const normalizePhone = (phone?: string) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};
const isPlatformAdmin = (user: User, claims?: Record<string, unknown>) =>
  claims?.admin === true || platformAdminEmails.has(normalizeEmail(user.email));

function getBearerToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '').trim();
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

  const normPhone = normalizePhone(user.phone);
  const normEmail = normalizeEmail(user.email);

  if (
    Array.from(db.salons.values()).some(
      (s) =>
        s.ownerId === user.id ||
        (normPhone && normalizePhone(s.phone) === normPhone) ||
        (normEmail && normalizeEmail(s.email) === normEmail)
    )
  ) {
    roles.add('owner');
  }
  if (user.role === 'owner' || user.activeRole === 'owner') {
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

function buildAuthenticatedUser(user: User, activeRole: UserRole, claims?: Record<string, unknown>) {
  const authorizedRoles = getAuthorizedRoles(user, claims);
  const normPhone = normalizePhone(user.phone);
  const normEmail = normalizeEmail(user.email);
  const ownerSalon = activeRole === 'owner'
    ? Array.from(db.salons.values()).find(
        (s) =>
          s.ownerId === user.id ||
          (normPhone && normalizePhone(s.phone) === normPhone) ||
          (normEmail && normalizeEmail(s.email) === normEmail)
      )
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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(rawToken, true);
    let user = db.users.get(decoded.uid);
    if (!user) {
      const normPhone = normalizePhone(decoded.phone_number);
      const normEmail = normalizeEmail(decoded.email);

      const existingUser = Array.from(db.users.values()).find((u) => {
        if (normPhone && normalizePhone(u.phone) === normPhone) return true;
        if (normEmail && normalizeEmail(u.email) === normEmail) return true;
        return false;
      });

      if (existingUser) {
        user = existingUser;
        if (decoded.email && !user.email) user.email = decoded.email;
        if (decoded.phone_number && !user.phone) user.phone = decoded.phone_number;
        if (decoded.name && (!user.name || user.name === 'QGo User')) user.name = decoded.name;
        if (decoded.picture && !user.profileImage) user.profileImage = decoded.picture;
        db.users.set(decoded.uid, user);
        db.users.set(user.id, user);
      } else {
        user = {
          id: decoded.uid,
          email: decoded.email,
          phone: decoded.phone_number,
          name: decoded.name || decoded.phone_number || 'QGo User',
          profileImage: decoded.picture,
          role: 'consumer',
          createdAt: new Date().toISOString(),
        };
        db.users.set(user.id, user);
        ensureConsumerRole(user.id);
      }
    } else if (
      (decoded.email && user.email !== decoded.email) ||
      (decoded.phone_number && user.phone !== decoded.phone_number) ||
      (decoded.name && user.name !== decoded.name) ||
      (decoded.picture && user.profileImage !== decoded.picture)
    ) {
      user.email = decoded.email || user.email;
      user.phone = decoded.phone_number || user.phone;
      user.name = decoded.name || user.name;
      user.profileImage = decoded.picture || user.profileImage;
      db.users.set(user.id, user);
    }

    // Check if user owns any salon by ownerId, phone or email
    const normPhone = normalizePhone(user.phone);
    const normEmail = normalizeEmail(user.email);
    const matchingSalons = Array.from(db.salons.values()).filter(
      (s) =>
        s.ownerId === user.id ||
        (normPhone && normalizePhone(s.phone) === normPhone) ||
        (normEmail && normalizeEmail(s.email) === normEmail)
    );

    if (matchingSalons.length > 0) {
      for (const salon of matchingSalons) {
        if (salon.ownerId !== user.id) {
          salon.ownerId = user.id;
          db.salons.set(salon.id, salon);
        }
      }
      user.salonId = matchingSalons[0].id;
      const ownerRole = Array.from(db.userRoles.values()).find(
        (r) => r.userId === user.id && r.role === 'owner'
      );
      if (!ownerRole) {
        const id = `rm_${crypto.randomUUID()}`;
        db.userRoles.set(id, { id, userId: user.id, role: 'owner', status: 'active', businessId: matchingSalons[0].id });
      }
      user.role = 'owner';
      user.activeRole = 'owner';
      db.users.set(user.id, user);
    }

    const claims = decoded as unknown as Record<string, unknown>;
    const authorizedRoles = getAuthorizedRoles(user, claims);
    const role: UserRole = isPlatformAdmin(user, claims)
      ? 'admin'
      : authorizedRoles.includes('owner')
      ? 'owner'
      : (authorizedRoles.includes(user.activeRole || user.role) ? (user.activeRole || user.role) : 'consumer');
    user.role = role;
    user.activeRole = role;
    req.auth = { userId: user.id, role, user, claims };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid, expired, or revoked Firebase session' });
  }
}

function requireRole(...roles: Array<'consumer' | 'owner' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

const requireOwner = requireRole('owner');
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' } });
  if (req.auth.role !== 'admin' || !isPlatformAdmin(req.auth.user, req.auth.claims)) return res.status(403).json({ success: false, error: { code: 'ADMIN_ACCESS_DENIED', message: 'Admin access is restricted to the authorized QGo administrator.' } });
  next();
}

function canManageSalon(auth: AuthenticatedRequest['auth'], salonId: string) {
  if (!auth) return false;
  const salon = db.salons.get(salonId);
  if (!salon) return false;
  return salon.ownerId === auth.userId;
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

apiRouter.use('/auth', createRateLimiter(20, 15 * 60 * 1000));
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
    .createHmac('sha256', qrSigningSecret)
    .update(`${bookingId}:${salonId}:${qrCodeId}`)
    .digest('base64url');
}

function isBookingExpired(booking: Booking) {
  if (booking.mode === 'appointment' && booking.scheduledDate && booking.scheduledTime) {
    const endsAt = new Date(`${booking.scheduledDate}T${booking.scheduledTime}:00`);
    endsAt.setMinutes(endsAt.getMinutes() + (booking.serviceDuration || 30));
    return Date.now() > endsAt.getTime();
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
  if (booking.resourceId && booking.scheduledDate && booking.scheduledTime) {
    db.releaseSlotLock(booking.salonId, booking.resourceId, booking.scheduledDate, booking.scheduledTime, undefined);
  }
  if (booking.staffId && booking.scheduledDate && booking.scheduledTime) {
    db.releaseSlotLock(booking.salonId, booking.staffId, booking.scheduledDate, booking.scheduledTime, undefined);
  }
}

// ----------------------------------------------------
// 1. AUTHENTICATION & QUICK SWITCHER (OTP, Demo & Roles)
// ----------------------------------------------------

apiRouter.post('/auth/otp/request', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ success: false, error: 'Phone number is required' });
  }
  const cleanPhone = phone.replace(/\s+/g, '');
  const devOtp = '123456';
  db.otpStore.set(cleanPhone, { otp: devOtp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
  return res.json({ success: true, message: 'OTP sent successfully', devOtp });
});

apiRouter.post('/auth/otp/verify', (req: Request, res: Response) => {
  const { phone, otp, name, role: requestedRoleInput } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
  }
  const cleanPhone = phone.replace(/\s+/g, '');
  const stored = db.otpStore.get(cleanPhone);
  if (otp !== '123456' && (!stored || stored.otp !== otp || stored.expiresAt < Date.now())) {
    return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
  }

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

  const mockToken = JSON.stringify({ mock: true, phone: cleanPhone, name: user.name });
  return res.json({
    success: true,
    token: mockToken,
    user: buildAuthenticatedUser(user, activeRole),
  });
});

apiRouter.post('/auth/firebase/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const requestedRole = normalizeRequestedRole(req.body?.requestedRole);
  const user = req.auth!.user;
  ensureConsumerRole(user.id);

  if (requestedRole === 'owner') {
    const existingOwnerRole = Array.from(db.userRoles.values()).find(
      (role) => role.userId === user.id && role.role === 'owner'
    );
    if (!existingOwnerRole) {
      const id = `rm_${crypto.randomUUID()}`;
      db.userRoles.set(id, { id, userId: user.id, role: 'owner', status: 'active' });
    } else if (existingOwnerRole.status !== 'active') {
      return res.status(403).json({ error: 'Owner role is disabled for this account' });
    }
  }

  const authorizedRoles = getAuthorizedRoles(user, req.auth!.claims);
  const activeRole: UserRole = authorizedRoles.includes('admin')
    ? 'admin'
    : authorizedRoles.includes('owner')
    ? 'owner'
    : (requestedRole === 'consumer' ? 'consumer' : (user.activeRole || user.role || 'consumer'));

  user.role = activeRole;
  user.activeRole = activeRole;
  user.authorizedRoles = authorizedRoles;
  db.users.set(user.id, user);

  return res.json({ success: true, user: buildAuthenticatedUser(user, activeRole, req.auth!.claims) });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { user, role } = req.auth!;
  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, role, req.auth!.claims),
  });
});

apiRouter.post('/auth/switch-role', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const requestedRole = normalizeRequestedRole(req.body?.role);
  if (!requestedRole) {
    return res.status(400).json({ error: 'Invalid role requested' });
  }

  const user = req.auth!.user;
  ensureConsumerRole(user.id);

  if (requestedRole === 'owner') {
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
      });
    } else if (ownerRole.status !== 'active') {
      return res.status(403).json({ error: 'Owner role is disabled for this account' });
    }
  }

  const authorizedRoles = getAuthorizedRoles(user, req.auth!.claims);
  if (!authorizedRoles.includes(requestedRole)) {
    return res.status(403).json({ error: 'Requested role is not authorized for this account' });
  }

  user.role = requestedRole;
  user.activeRole = requestedRole;
  user.authorizedRoles = authorizedRoles;

  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, requestedRole, req.auth!.claims),
  });
});

// ----------------------------------------------------
// ADMIN DASHBOARD
// ----------------------------------------------------
const adminDate = () => new Date().toISOString();
const adminProfile = (user: User) => ({ id: user.id, name: user.name, email: user.email || '', phone: user.phone || '', role: user.role, createdAt: user.createdAt });
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
  const today = new Date().toISOString().slice(0, 10);
  const bookings = Array.from(db.bookings.values());
  const customers = Array.from(db.users.values()).filter((user) => !Array.from(db.salons.values()).some((salon) => salon.ownerId === user.id) && !isPlatformAdmin(user));
  const owners = Array.from(db.users.values()).filter((user) => Array.from(db.salons.values()).some((salon) => salon.ownerId === user.id));
  return res.json({ success: true, counters: {
    activeUsers: Array.from(db.users.values()).filter((user) => user.createdAt?.slice(0, 10) === today).length,
    newBookings: Array.from(db.bookings.values()).filter((booking) => booking.createdAt?.slice(0, 10) === today).length,
    pendingApprovals: Array.from(db.salons.values()).filter((salon) => salon.status === 'under_review').length,
    openTickets: Array.from(db.supportTickets.values()).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length,
  }, data: { activeUsersToday: Array.from(db.users.values()).filter((user) => user.createdAt?.slice(0, 10) === today).length, newBookingsToday: bookings.filter((booking) => booking.createdAt?.slice(0, 10) === today).length, pendingBusinessApprovals: Array.from(db.salons.values()).filter((salon) => salon.status === 'under_review').length, openTickets: Array.from(db.supportTickets.values()).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length, totalCustomers: customers.length, totalOwners: owners.length, totalBusinesses: db.salons.size, totalBookings: bookings.length, todayRevenue: bookings.filter((booking) => booking.createdAt?.slice(0, 10) === today && booking.paymentStatus === 'paid').reduce((sum, booking) => sum + (booking.amount || 0), 0), pendingPayments: bookings.filter((booking) => booking.paymentStatus === 'pending').length, pendingRefunds: bookings.filter((booking: any) => booking.refundStatus === 'pending').length } });
});

apiRouter.get('/admin/customers', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const ownerIds = new Set(Array.from(db.salons.values()).map((salon) => salon.ownerId)); const rows = Array.from(db.users.values()).filter((user) => !ownerIds.has(user.id) && !isPlatformAdmin(user)).filter((user) => adminMatches(user, req.query.search)).map((user) => { const bookings = Array.from(db.bookings.values()).filter((booking) => booking.customerId === user.id); return { ...adminProfile(user), status: 'active', bookingCount: bookings.length, lastBooking: bookings.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0]?.createdAt || null, totalSpent: bookings.filter((booking) => booking.paymentStatus === 'paid').reduce((sum, booking) => sum + (booking.amount || 0), 0) }; }); auditAdmin(req, 'CUSTOMERS_VIEWED', 'customer'); const page = adminPage(rows, req); return res.json({ success: true, customers: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/owners', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.users.values()).filter((user) => Array.from(db.salons.values()).some((salon) => salon.ownerId === user.id)).filter((user) => adminMatches(user, req.query.search)).map((user) => ({ ...adminProfile(user), status: 'active', businessCount: Array.from(db.salons.values()).filter((salon) => salon.ownerId === user.id).length })); auditAdmin(req, 'OWNERS_VIEWED', 'owner'); const page = adminPage(rows, req); return res.json({ success: true, owners: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/businesses', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.salons.values()).filter((salon) => adminMatches(salon, req.query.search)).filter((salon) => !req.query.status || salon.status === req.query.status).filter((salon) => !req.query.category || salon.category === req.query.category).map((salon) => ({ ...salon, owner: db.users.get(salon.ownerId) ? adminProfile(db.users.get(salon.ownerId)!) : null })); const page = adminPage(rows, req); return res.json({ success: true, businesses: page.items, pagination: page.pagination }); });
const changeBusinessStatus = (status: 'approved' | 'rejected' | 'suspended', action: string) => (req: AuthenticatedRequest, res: Response) => { const salon = db.salons.get(req.params.id); if (!salon) return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' } }); salon.status = status; salon.verified = status === 'approved'; salon.isPublished = status === 'approved'; db.salons.set(salon.id, salon); auditAdmin(req, action, 'business', salon.id, { reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '' }); return res.json({ success: true, business: salon }); };
apiRouter.post('/admin/businesses/:id/approve', requireAuth, requireAdmin, changeBusinessStatus('approved', 'BUSINESS_APPROVED'));
apiRouter.post('/admin/businesses/:id/reject', requireAuth, requireAdmin, changeBusinessStatus('rejected', 'BUSINESS_REJECTED'));
apiRouter.post('/admin/businesses/:id/suspend', requireAuth, requireAdmin, changeBusinessStatus('suspended', 'BUSINESS_SUSPENDED'));
apiRouter.get('/admin/bookings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.bookings.values()).filter((booking) => adminMatches(booking, req.query.search)).filter((booking) => !req.query.status || booking.status === req.query.status).filter((booking) => !req.query.paymentStatus || booking.paymentStatus === req.query.paymentStatus).map((booking) => ({ ...booking, business: db.salons.get(booking.salonId)?.name || '', owner: db.users.get(db.salons.get(booking.salonId)?.ownerId || '')?.name || '' })); auditAdmin(req, 'BOOKINGS_VIEWED', 'booking'); const page = adminPage(rows, req); return res.json({ success: true, bookings: page.items, pagination: page.pagination }); });
apiRouter.get('/admin/payments', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => { const rows = Array.from(db.bookings.values()).filter((booking) => booking.paymentStatus === 'paid' || booking.paymentStatus === 'pending').map((booking) => ({ paymentId: booking.id, bookingId: booking.id, customer: booking.customerName, amount: booking.amount, provider: 'QGo', status: booking.paymentStatus, createdAt: booking.createdAt })); auditAdmin(req, 'PAYMENTS_VIEWED', 'payment'); const page = adminPage(rows, req); return res.json({ success: true, payments: page.items, pagination: page.pagination }); });
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

apiRouter.post('/support-tickets', requireAuth, (req: AuthenticatedRequest, res) => {
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
  const normPhone = normalizePhone(req.auth!.user.phone);
  const normEmail = normalizeEmail(req.auth!.user.email);
  const ownerSalons = Array.from(db.salons.values()).filter(
    (s) =>
      s.ownerId === req.auth!.userId ||
      (normPhone && normalizePhone(s.phone) === normPhone) ||
      (normEmail && normalizeEmail(s.email) === normEmail)
  );
  ownerSalons.forEach((s) => {
    if (s.ownerId !== req.auth!.userId) {
      s.ownerId = req.auth!.userId;
      db.salons.set(s.id, s);
    }
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

// Owner registers new salon
apiRouter.post('/salons', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, category, description, logoUrl, coverUrl, address, city, phone, lat, lng } = req.body;
  const ownerId = req.auth!.userId;
  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required' });
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

// Update salon settings / details
apiRouter.patch('/salons/:id', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }
  if (salon.ownerId !== req.auth!.userId) {
    return forbidden(res);
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
    ...safeUpdates
  } = req.body;

  // If status is being set to 'live', also make it published
  if (safeUpdates.status === 'live' || safeUpdates.status === 'approved') {
    salon.isPublished = true;
    salon.verified = true;
  }
  if (safeUpdates.status === 'draft' || safeUpdates.status === 'rejected' || safeUpdates.status === 'suspended') {
    salon.isPublished = false;
  }

  Object.assign(salon, safeUpdates);

  // Move to pending review when owner completes final onboarding step
  const setupStep = Number(safeUpdates.setupStep);
  const totalSteps = salon.category && (salon.category.toLowerCase().includes('turf') || salon.category.toLowerCase().includes('football') || salon.category.toLowerCase().includes('cricket') || salon.category.toLowerCase().includes('sports')) ? 7 : 8;
  if (setupStep >= totalSteps && salon.status === 'draft') {
    salon.status = 'under_review';
  }

  return res.json({ success: true, salon });
});

// Admin approves business
apiRouter.post('/admin/salons/:id/approve', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }

  salon.status = 'approved';
  salon.isPublished = true;
  salon.verified = true;

  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: 'business_approved',
    title: 'Business Approved!',
    message: `Your business ${salon.name} has been approved and is now live.`,
  });

  return res.json({ success: true, salon });
});

// Upload business image (base64 data URL — no file server needed)
apiRouter.post('/salons/:id/upload-image', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Salon not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  const { imageData, type } = req.body as { imageData: string; type: 'logo' | 'cover' | 'photo' };

  if (!imageData || !imageData.startsWith('data:image')) {
    return res.status(400).json({ error: 'Invalid image data. Must be a base64 data URL.' });
  }

  // Validate rough size (base64 ~4/3 of original; limit to ~5MB originals ≈ ~7MB base64)
  if (imageData.length > 7_000_000) {
    return res.status(400).json({ error: 'Image too large. Please use an image under 5MB.' });
  }

  if (type === 'logo') {
    salon.logoUrl = imageData;
  } else if (type === 'cover') {
    salon.coverUrl = imageData;
  } else if (type === 'photo') {
    if (!salon.photos) salon.photos = [];
    salon.photos = [...salon.photos, imageData];
  } else {
    return res.status(400).json({ error: 'Invalid type. Use logo, cover, or photo.' });
  }

  return res.json({ success: true, url: imageData, salon });
});

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

  if (!name || !price || !durationMinutes) {
    return res.status(400).json({ error: 'Name, price, and duration are required' });
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

apiRouter.post('/salons/:id/staff', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { id: salonId } = req.params;
  const { name, title, photoUrl, serviceIds, phone } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  if (!name) {
    return res.status(400).json({ error: 'Staff name is required' });
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
    photoUrl: photoUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
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
  
  // Future Month Lock: If fallback to default schedule, ensure it's not a future month
  if (isDefaultScheduleFallback) {
    const today = new Date();
    const isFutureMonth = (dateObj.getUTCFullYear() > today.getFullYear()) || 
                          (dateObj.getUTCFullYear() === today.getFullYear() && dateObj.getUTCMonth() > today.getMonth());
    if (isFutureMonth) {
      return {
        isOpen: false,
        message: 'Not Yet Open',
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getUTCDay()],
        slots: [],
        resources
      };
    }
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
  const isToday = queryDate === now.toISOString().split('T')[0];
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
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
      const isPast = isToday && ((startM + GRACE_PERIOD) <= currentMinutesToday + minNoticeMinutes);
      const isBooked = Boolean(matchingBooking) || db.isSlotLocked(salon.id, activeResourceId, queryDate, slotItem.startTime);
      const isBlocked = slotItem.status === 'blocked' || disabledSlots.includes(slotItem.startTime);
      const available = !isPast && !isBooked && !isBlocked;
      
      let status: 'available' | 'booked' | 'blocked' | 'disabled' | 'closed' | 'completed' = isBooked ? 'booked' : (isBlocked ? 'blocked' : (available ? 'available' : 'disabled'));
      
      const isPastDate = queryDate < new Date().toISOString().split('T')[0];
      const isPastSlot = isPastDate || isPast;
      
      if (matchingBooking && (matchingBooking.status === 'completed' || isPastSlot)) {
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
      const isPast = isToday && ((startM + GRACE_PERIOD) <= currentMinutesToday + minNoticeMinutes);

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
      const status = isBooked ? 'booked' : (isBlocked ? 'blocked' : (available ? 'available' : 'disabled'));

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
      const isPast = isToday && ((cStart + GRACE_PERIOD) <= currentMinutesToday + minNoticeMinutes);
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
        status: isBooked ? 'booked' : (available ? 'available' : 'disabled'),
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

  // Sort slots chronologically
  generatedSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

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
  const queryDate = (date as string) || new Date().toISOString().split('T')[0];
  const turfResult = calculateTurfSlotsForDate(salon, queryDate);
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

  const queryDate = (date as string) || new Date().toISOString().split('T')[0];

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
  const isToday = queryDate === now.toISOString().split('T')[0];
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

  for (let m = startTotalMinutes; m + duration <= endTotalMinutes; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    // Skip past slots if today
    if (isToday && m <= currentMinutesToday + 15) {
      continue;
    }

    // Check staff availability for this slot
    const availableStaffForSlot = eligibleStaff.filter((st) => {
      const hasConflict = bookedSlots.some(
        (b) => b.staffId === st.id && b.scheduledTime === timeStr
      );
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
// 5. BOOKINGS (Appointments, Turf Slots & Live Tokens)
// ----------------------------------------------------

apiRouter.post('/bookings', requireAuth, requireRole('consumer'), async (req: AuthenticatedRequest, res: Response) => {
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
  } = req.body;

  if (!salonId || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'Missing required booking information' });
  }

  const customerId = req.auth!.userId;
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
    const isToday = scheduledDate === now.toISOString().split('T')[0];
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

    if (isToday && timeToMinutes(scheduledTime) < currentMinutesToday + minNoticeMinutes) {
      return res.status(400).json({ error: `Minimum notice requirement of ${minNoticeMinutes} minutes not met for this slot.` });
    }

    const bookingDateObj = new Date(`${scheduledDate}T00:00:00Z`);
    const todayDateObj = new Date(`${now.toISOString().split('T')[0]}T00:00:00Z`);
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

    // 2. STRICT ATOMIC LOCK FOR DOUBLE BOOKING PROTECTION
    const lockAcquired = db.tryAcquireSlotLock(
      salonId,
      targetResourceId,
      scheduledDate,
      scheduledTime,
      bookingId
    );

    if (!lockAcquired) {
      return res.status(409).json({
        error: 'This turf slot was just booked by another customer. Please choose another time or turf.',
        slotTaken: true,
      });
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
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
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

    if (paymentType === 'FULL' && acceptedPaymentType === 'ADVANCE') {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
      return res.status(400).json({ error: 'This slot accepts advance payment only.' });
    }
    if (paymentType === 'ADVANCE' && acceptedPaymentType === 'FULL') {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
      return res.status(400).json({ error: 'This slot requires full payment.' });
    }

    if (paymentType === 'ADVANCE') {
      if (!advanceAmount || advanceAmount <= 0) {
        return res.status(400).json({ error: 'Invalid advance amount.' });
      }
      if (advanceAmount > finalPrice) {
        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });
      }
    }

    const tokenNumber = db.getNextTokenNumber(salon);
    const qrCodeId = `QR-${bookingId}-${crypto.randomBytes(6).toString('hex')}`.toUpperCase();
    const qrSignature = makeQrSignature(bookingId, salonId, qrCodeId);

    const qgoFee = 30;
    const gstAmount = 5.40;
    const customerPaidSlotAmount = paymentType === 'ADVANCE' ? advanceAmount : (paymentType === 'FULL' ? finalPrice : 0);
    const hasOnlinePayment = customerPaidSlotAmount > 0;
    const totalCustomerPaid = hasOnlinePayment ? customerPaidSlotAmount + qgoFee + gstAmount : 0;

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
      paymentStatus: paymentType === 'ADVANCE' && advanceAmount > 0 ? 'PARTIALLY_PAID' : (paymentType === 'FULL' ? 'PAID' : 'pay_at_shop'),
      amount: finalPrice,
      totalAmount: finalPrice,
      paidAmount: totalCustomerPaid,
      balanceAmount: paymentType === 'ADVANCE' ? finalPrice - advanceAmount : (paymentType === 'FULL' ? 0 : finalPrice),
      balanceStatus: paymentType === 'ADVANCE' || paymentType === 'pay_at_shop' ? 'PENDING' : 'COLLECTED',
      convenienceFee: hasOnlinePayment ? qgoFee : 0,
      gstAmount: hasOnlinePayment ? gstAmount : 0,
      refundPercentage: salon.bookingSettings?.refundPercentage ?? 70,
      cancellationDeadlineHours: salon.bookingSettings?.cancellationDeadlineHours ?? 2,
      reminderMinutesBefore: salon.bookingSettings?.reminderMinutesBefore ?? 30,
      refundStatus: 'none',
      createdAt: new Date().toISOString(),
    };

    const reservationCreated = await db.createBookingWithSlotReservation(newBooking, targetResourceId);
    if (!reservationCreated) {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
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

  if (paymentType === 'ADVANCE') {
    if (!advanceAmount || advanceAmount <= 0) {
      return res.status(400).json({ error: 'Invalid advance amount.' });
    }
    if (advanceAmount > service.price) {
      return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });
    }
  }

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

    const todayStr = new Date().toISOString().split('T')[0];
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
    const todayStr = now.toISOString().split('T')[0];
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
      const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
      if (timeToMinutes(scheduledTime) < currentMinutesToday + minNoticeMinutes) {
        return res.status(400).json({ error: `Minimum notice requirement of ${minNoticeMinutes} minutes not met for this appointment.` });
      }
    }

    const lockAcquired = db.tryAcquireSlotLock(
      salonId,
      assignedStaff!.id,
      scheduledDate,
      scheduledTime,
      bookingId
    );

    if (!lockAcquired) {
      return res.status(409).json({
        error: 'This appointment slot was just booked by another customer. Please choose another time or stylist.',
        slotTaken: true,
      });
    }

    const requestedStart = timeToMinutes(scheduledTime);
    const requestedEnd = requestedStart + service.durationMinutes;
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.salonId !== salonId || b.staffId !== assignedStaff!.id || b.scheduledDate !== scheduledDate) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      const existingStart = timeToMinutes(b.scheduledTime || '00:00');
      const existingEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : existingStart + (b.serviceDuration || 30);
      return requestedStart < existingEnd && requestedEnd > existingStart;
    });

    if (existingConflict) {
      db.releaseSlotLock(salonId, assignedStaff!.id, scheduledDate, scheduledTime, bookingId);
      return res.status(409).json({
        error: 'This appointment slot is already booked. Please choose another time or stylist.',
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
    paymentStatus: paymentType === 'ADVANCE' && advanceAmount > 0 ? 'PARTIALLY_PAID' : (paymentType === 'FULL' ? 'PAID' : 'pay_at_shop'),
    amount: service.price,
    totalAmount: service.price,
    paidAmount: paymentType === 'ADVANCE' ? advanceAmount : (paymentType === 'FULL' ? service.price : 0),
    balanceAmount: paymentType === 'ADVANCE' ? service.price - advanceAmount : (paymentType === 'FULL' ? 0 : service.price),
    balanceStatus: paymentType === 'ADVANCE' || paymentType === 'pay_at_shop' ? 'PENDING' : 'COLLECTED',
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
  const today = new Date().toISOString().split('T')[0];
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
    const staff = db.staff.get(staffId);
    if (!staff || !bookingsList.every((b) => b.salonId === staff.salonId)) {
      return forbidden(res);
    }
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
  }
  if (status === 'completed' || status === 'no_show') {
    releaseBookingSlotLock(booking);
  }

  const qe = db.queueEntries.get(`qe_${id}`);
  if (qe) {
    if (status === 'completed') qe.status = 'served';
    if (status === 'cancelled') qe.status = 'cancelled';
    if (status === 'no_show') qe.status = 'no_show';
    if (status === 'checked_in') qe.isArriving = true;
  }

  db.recalculateQueueStats(booking.salonId);
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
    booking.paymentStatus = 'PAID';
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
      const [h, m] = booking.scheduledTime.split(':').map(Number);
      const slotDate = new Date(`${booking.scheduledDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const cutoffTime = slotDate.getTime() - (deadlineHours * 60 * 60 * 1000);
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

  if (booking.paymentStatus === 'paid') {
    refundAmount = Math.round((booking.amount * refundPct) / 100);
    nonRefundableAmount = booking.amount - refundAmount;
    refundStatus = refundAmount > 0 ? 'pending' : 'none';
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

apiRouter.post('/checkin/scan', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { qrData, salonId } = req.body;
  if (!qrData || !salonId) {
    return res.status(400).json({ error: 'QR data and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  let parsed: any;
  try {
    parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch (e) {
    return res.status(400).json({
      valid: false,
      reason: 'INVALID_QR',
      message: 'This QR ticket is invalid. Use the manual code entry for a legacy token.',
    });
  }

  if (!parsed || typeof parsed.bookingId !== 'string' || typeof parsed.qrCodeId !== 'string' || typeof parsed.qrSignature !== 'string') {
    return res.status(400).json({ valid: false, reason: 'INVALID_QR', message: 'This QR ticket is missing its secure booking reference.' });
  }

  const booking = db.bookings.get(parsed.bookingId);

  if (!booking) {
    return res.status(404).json({
      valid: false,
      reason: 'INVALID_QR',
      message: 'No matching booking found for this QR code.',
    });
  }

  if (booking.salonId !== salonId) {
    return res.status(403).json({
      valid: false,
      reason: 'WRONG_SALON',
      message: 'This ticket does not belong to this salon.',
    });
  }

  const expectedSignature = makeQrSignature(booking.id, booking.salonId, booking.qrCodeId);
  if (parsed.qrCodeId !== booking.qrCodeId || parsed.qrSignature !== expectedSignature) {
    return res.status(403).json({
      valid: false,
      reason: 'INVALID_SIGNATURE',
      message: 'QR signature could not be verified.',
    });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({
      valid: false,
      reason: 'CANCELLED',
      message: 'This booking was cancelled by the customer.',
    });
  }

  if (booking.status === 'no_show') {
    return res.status(400).json({
      valid: false,
      reason: 'NO_SHOW',
      message: 'This booking was already marked as no-show.',
    });
  }

  if (booking.status === 'completed') {
    return res.status(400).json({
      valid: false,
      reason: 'ALREADY_COMPLETED',
      message: 'This service was already completed previously.',
    });
  }

  // Check if already checked in
  if (booking.status === 'checked_in') {
    return res.status(400).json({
      valid: false,
      reason: 'ALREADY_CHECKED_IN',
      message: 'This booking is already checked in.',
    });
  }

  if (isBookingExpired(booking)) {
    return res.status(400).json({
      valid: false,
      reason: 'EXPIRED',
      message: 'This booking pass has expired.',
      booking,
    });
  }

  return res.json({
    valid: true,
    needsAcceptance: true,
    message: `Booking found for ${booking.customerName}. Review details and accept check-in.`,
    booking,
  });
});

apiRouter.post('/checkin/accept', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, salonId, markAsPaid } = req.body;
  if (!bookingId || !salonId) {
    return res.status(400).json({ error: 'bookingId and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const booking = db.bookings.get(bookingId);
  const validation = validateBookingForCheckIn(booking, salonId);
  if (!validation.ok) {
    return res.status(validation.status).json({
      valid: false,
      reason: validation.reason,
      message: validation.message,
      booking: validation.booking,
    });
  }

  booking!.status = 'checked_in';
  booking!.checkedInAt = new Date().toISOString();
  if (markAsPaid) {
    booking!.paymentStatus = 'paid';
    booking!.paidAmount = booking!.totalAmount;
    booking!.balanceAmount = 0;
    booking!.balanceStatus = 'COLLECTED';
  }

  const qe = db.queueEntries.get(`qe_${booking!.id}`);
  if (qe) {
    qe.isArriving = true;
  }

  sendNotification(booking!.customerId, {
    userId: booking!.customerId,
    type: 'checked_in',
    title: 'Booking Accepted',
    message: `You are checked in at ${booking!.salonName}. Enjoy your slot.`,
    bookingId: booking!.id,
  });

  return res.json({
    valid: true,
    message: `Accepted: ${booking!.customerName} is checked in.`,
    booking,
  });
});

// Manual 6-character Join Code Fallback
apiRouter.post('/checkin/manual-code', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const { code, salonId } = req.body;
  if (!code || !salonId) {
    return res.status(400).json({ error: 'Code and salonId are required' });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }

  const cleanCode = code.trim().toUpperCase();

  const booking = Array.from(db.bookings.values()).find(
    (b) =>
      b.salonId === salonId &&
      (b.tokenNumber?.endsWith(cleanCode) ||
        b.tokenNumber?.toUpperCase() === cleanCode ||
        b.qrCodeId?.endsWith(cleanCode) ||
        b.id.endsWith(cleanCode.toLowerCase()))
  );

  if (!booking) {
    return res.status(404).json({
      valid: false,
      message: `No active booking found matching code '${cleanCode}'.`,
    });
  }

  if (booking.status === 'checked_in') {
    return res.status(400).json({
      valid: false,
      message: 'This booking is already checked in.',
    });
  }

  if (booking.status === 'cancelled' || booking.status === 'no_show' || booking.status === 'completed') {
    return res.status(400).json({
      valid: false,
      message: 'This booking is not eligible for check-in.',
    });
  }

  if (isBookingExpired(booking)) {
    return res.status(400).json({
      valid: false,
      reason: 'EXPIRED',
      message: 'This booking pass has expired.',
      booking,
    });
  }

  return res.json({
    valid: true,
    needsAcceptance: true,
    message: `Booking found: ${booking.customerName} (${booking.tokenNumber}). Review and accept check-in.`,
    booking,
  });
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

apiRouter.post('/reviews', requireAuth, requireRole('consumer'), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, salonId, staffId, rating, comment } = req.body;

  if (!bookingId || !salonId || !rating || !comment) {
    return res.status(400).json({ error: 'Booking, salon, rating (1-5), and comment are required' });
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
  if (booking.status !== 'completed') {
    return res.status(403).json({ error: 'Only completed bookings can be reviewed' });
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
    return res.status(409).json({ error: 'This booking has already been reviewed' });
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
    comment,
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

  let csv = 'BookingID,TokenNumber,CustomerName,Phone,Service,Price,Status,Mode,Date,Created\n';
  bookings.forEach((b) => {
    csv += `"${b.id}","${b.tokenNumber || ''}","${b.customerName}","${b.customerPhone}","${b.serviceName}",${b.amount},"${b.status}","${b.mode}","${b.scheduledDate || ''}","${b.createdAt}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=qgo_report_${id}.csv`);
  return res.send(csv);
});

// ----------------------------------------------------
// 9.5 OWNER DASHBOARD, REVENUE, CUSTOMERS & SLOTS API
// ----------------------------------------------------

apiRouter.post('/salons/:id/approve', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }

  salon.status = 'approved';
  salon.isPublished = true;
  salon.verified = true;
  salon.setupStep = 8;

  // Send Business Approved Notification
  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: 'business_approved',
    title: 'Business Approved 🎉',
    message: 'Your business has been approved. Your QGo business is now live.',
  });

  return res.json({
    success: true,
    message: 'Business approved successfully',
    salon,
  });
});

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
  const todayStr = now.toISOString().split('T')[0];
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
    if (b.status === 'confirmed' && b.scheduledDate && b.scheduledDate >= new Date().toISOString().split('T')[0]) {
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
  const todayStr = now.toISOString().split('T')[0];
  let filterStart = '1970-01-01';
  let filterEnd = '2099-12-31';

  if (period === 'today') {
    filterStart = todayStr;
    filterEnd = todayStr;
  } else if (period === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    filterStart = weekAgo.toISOString().split('T')[0];
  } else if (period === 'month') {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    filterStart = monthAgo.toISOString().split('T')[0];
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
      b.status !== 'cancelled'
  );

  // Add slot override to salon.turfSchedule
  const schedules = salon.turfSchedule || [];
  const schedule = schedules[0];
  if (schedule) {
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
  const schedule = schedules[0];
  if (schedule) {
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
    (b) => b.salonId === id && b.scheduledDate === date && b.status !== 'cancelled'
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

      sendNotification(b.customerId, {
        userId: b.customerId,
        type: 'cancelled',
        title: 'Booking Cancelled (Full Refund)',
        message: `Your booking on ${b.scheduledDate} at ${salon.name} was cancelled due to: ${reason}. Full refund of ₹${b.amount} has been initiated.`,
        bookingId: b.id,
      });
    }
  }

  // Add to specialDates
  salon.holidays = salon.holidays || [];
  const schedules = salon.turfSchedule || [];
  if (schedules.length > 0) {
    schedules[0].specialDates = schedules[0].specialDates || [];
  }

  for (const d of targetDates) {
    if (!salon.holidays.some((h) => h.date === d)) {
      salon.holidays.push({ date: d, reason });
    }
    if (schedules.length > 0 && !schedules[0].specialDates.some((sd) => sd.date === d)) {
      schedules[0].specialDates.push({ date: d, reason, isClosed: true });
    }
  }

  return res.json({
    success: true,
    message: `${targetDates.length} date(s) blocked successfully.`,
    affectedBookings,
  });
});

// ----------------------------------------------------
// 10. NOTIFICATIONS
// ----------------------------------------------------

apiRouter.post('/salons/:id/unblock-date', requireAuth, (req, res) => {
  const { id } = req.params;
  const { dates } = req.body;
  if (!dates || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'No dates' });
  const salon = db.salons.get(id);
  if (!salon) return res.status(404).json({ error: 'Not found' });
  if (salon.holidays) salon.holidays = salon.holidays.filter(h => !dates.includes(h.date));
  if (salon.turfSchedule && salon.turfSchedule[0] && salon.turfSchedule[0].specialDates) salon.turfSchedule[0].specialDates = salon.turfSchedule[0].specialDates.filter(sd => !dates.includes(sd.date));
  return res.json({ success: true, message: 'unblocked' });
});

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifs = db.notifications.get(req.auth!.userId) || [];
  return res.json({ success: true, notifications: notifs });
});

apiRouter.patch('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifs = db.notifications.get(req.auth!.userId) || [];
  notifs.forEach((n) => (n.read = true));

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
      const todayStr = now.toISOString().split('T')[0];
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

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
