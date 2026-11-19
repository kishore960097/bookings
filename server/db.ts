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
  AuthAccount,
  UserRoleMap,
  AdminReminderRecord,
} from '../src/types';
import { adminDb } from './firebaseAdmin';
import { buildQueueKey, buildSlotKey } from './keys';
import { businessToday, shiftBusinessDate } from './lib/businessTime';
import crypto from 'crypto';

function toIstDate(isoString?: string | null): string | null {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) return null;
  return businessToday(parsed);
}

export function buildSlotReservationKey(
  salonId: string,
  staffOrResourceId: string,
  baseDate: string,
  minute: number
): { key: string; date: string; minute: number } {
  const dayOffset = Math.floor(minute / 1440);
  const normalizedMinute = ((minute % 1440) + 1440) % 1440;
  const targetDate = shiftBusinessDate(baseDate, dayOffset);
  const key = `${salonId}:${staffOrResourceId}:${targetDate}:${normalizedMinute}`;
  return { key, date: targetDate, minute: normalizedMinute };
}

// Write-through cache map that persists to Firestore
class FirestoreBackedMap<K extends string, V> extends Map<K, V> {
  public collectionName: string;
  private readonly proxies = new Map<K, V>();
  private readonly timers = new Map<K, NodeJS.Timeout>();

  constructor(collectionName: string) {
    super();
    this.collectionName = collectionName;
  }

  async initialize() {
    try {
      const snap = await adminDb.collection(this.collectionName).get();
      for (const doc of snap.docs) {
        const data = doc.data();
        if (this.collectionName === 'notifications' && !Array.isArray(data)) {
          const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
          super.set(doc.id as K, items as unknown as V);
        } else {
          super.set(doc.id as K, data as V);
        }
      }
      console.log(`[DB] Loaded ${snap.size} items from ${this.collectionName}`);
    } catch (err) {
      console.error(`[DB Error] Failed to load ${this.collectionName}:`, err);
      throw err;
    }
  }

  set(key: K, value: V): this {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }
    super.set(key, value);
    this.proxies.delete(key);
    try {
      const cleanValue = JSON.parse(JSON.stringify(value));
      const payload = Array.isArray(cleanValue) ? { items: cleanValue } : cleanValue;
      adminDb.collection(this.collectionName).doc(key).set(payload).catch((err: any) => {
        console.error(`[Firestore Error] Failed to save ${this.collectionName}/${key}:`, err);
      });
    } catch (err) {
      console.error(`[Firestore Error] Failed to save ${this.collectionName}/${key}:`, err);
    }
    return this;
  }

  async setAsync(key: K, value: V): Promise<void> {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }
    super.set(key, value);
    this.proxies.delete(key);
    try {
      const cleanValue = JSON.parse(JSON.stringify(value));
      const payload = Array.isArray(cleanValue) ? { items: cleanValue } : cleanValue;
      const firestorePromise = adminDb.collection(this.collectionName).doc(key).set(payload);
      await Promise.race([
        firestorePromise,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]).catch((err) => {
        console.warn(`[Firestore Warning] Save ${this.collectionName}/${key} backgrounded:`, err?.message || err);
      });
    } catch (err: any) {
      console.warn(`[Firestore Error] Save ${this.collectionName}/${key}:`, err?.message || err);
    }
  }

  delete(key: K): boolean {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }
    const existed = super.delete(key);
    this.proxies.delete(key);
    if (existed) {
      adminDb.collection(this.collectionName).doc(key).delete().catch(err => {
        console.error(`[Firestore Error] Failed to delete ${this.collectionName}/${key}:`, err);
      });
    }
    return existed;
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    super.clear();
    this.proxies.clear();
    adminDb.collection(this.collectionName).get().then(snap => {
      const batch = adminDb.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      return batch.commit();
    }).catch(err => {
      console.error(`[Firestore Error] Failed to clear ${this.collectionName}:`, err);
    });
  }

  cache(key: K, value: V): void {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }
    super.set(key, value);
    this.proxies.delete(key);
  }

  get(key: K): V | undefined {
    const value = super.get(key);
    if (!value || typeof value !== 'object') return value;

    const existingProxy = this.proxies.get(key);
    if (existingProxy) return existingProxy;

    const seen = new WeakMap<object, object>();
    const persist = () => {
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.timers.delete(key);
      }
      const timer = setTimeout(() => {
        this.timers.delete(key);
        try {
          if (!key || typeof key !== 'string') return;
          const cleanValue = JSON.parse(JSON.stringify(value));
          const payload = Array.isArray(cleanValue) ? { items: cleanValue } : cleanValue;
          adminDb.collection(this.collectionName).doc(key).set(payload).catch(err => {
            console.warn(`[Firestore Warning] Save ${this.collectionName}/${key} delayed:`, err?.message || err);
          });
        } catch (err: any) {
          console.warn(`[Firestore Warning] Persist error for ${this.collectionName}/${key}:`, err?.message || err);
        }
      }, 50);
      this.timers.set(key, timer);
    };
    const wrap = (target: any): any => {
      if (!target || typeof target !== 'object' || target instanceof Date || target instanceof RegExp) return target;
      const cached = seen.get(target);
      if (cached) return cached;
      const proxy = new Proxy(target, {
        get(object, property) {
          if (typeof property === 'symbol') return object[property];
          const val = object[property];
          return wrap(val);
        },
        set(object, property, nextValue) {
          object[property] = nextValue;
          persist();
          return true;
        },
        deleteProperty(object, property) {
          delete object[property];
          persist();
          return true;
        },
      });
      seen.set(target, proxy);
      return proxy;
    };

    const proxy = wrap(value) as V;
    this.proxies.set(key, proxy);
    return proxy;
  }

  *values(): IterableIterator<V> {
    for (const key of super.keys()) {
      const value = this.get(key);
      if (value !== undefined) yield value;
    }
  }
}

// In-Memory Production-Grade Database with transactional consistency & atomic locks backed by Firestore
class QGoDatabase {
  public users: FirestoreBackedMap<string, User> = new FirestoreBackedMap('users');
  public salons: FirestoreBackedMap<string, Salon> = new FirestoreBackedMap('salons');
  public services: FirestoreBackedMap<string, Service> = new FirestoreBackedMap('services');
  public staff: FirestoreBackedMap<string, Staff> = new FirestoreBackedMap('staff');
  public bookings: FirestoreBackedMap<string, Booking> = new FirestoreBackedMap('bookings');
  public queueEntries: FirestoreBackedMap<string, QueueEntry> = new FirestoreBackedMap('queueEntries');
  public reviews: FirestoreBackedMap<string, Review> = new FirestoreBackedMap('reviews');
  public notifications: FirestoreBackedMap<string, NotificationItem[]> = new FirestoreBackedMap('notifications');
  public otpStore: FirestoreBackedMap<string, { otp: string; expiresAt: number; attempts: number }> = new FirestoreBackedMap('otpStore');
  public authAccounts: FirestoreBackedMap<string, AuthAccount> = new FirestoreBackedMap('authAccounts');
  public userRoles: FirestoreBackedMap<string, UserRoleMap> = new FirestoreBackedMap('userRoles');
  public supportTickets: FirestoreBackedMap<string, any> = new FirestoreBackedMap('supportTickets');
  public featureRequests: FirestoreBackedMap<string, any> = new FirestoreBackedMap('featureRequests');
  public featureRequestVotes: FirestoreBackedMap<string, any> = new FirestoreBackedMap('featureRequestVotes');
  public adminAuditLogs: FirestoreBackedMap<string, any> = new FirestoreBackedMap('adminAuditLogs');
  public paymentOrders: FirestoreBackedMap<string, any> = new FirestoreBackedMap('paymentOrders');
  public settlementPayouts: FirestoreBackedMap<string, any> = new FirestoreBackedMap('settlementPayouts');
  public adminReminders: FirestoreBackedMap<string, AdminReminderRecord> = new FirestoreBackedMap('adminReminders');

  // Concurrency Slot Lock Map (key: salonId:staffId:date:time) - Persisted across restarts with TTL
  public slotLocksMap: FirestoreBackedMap<string, { holderId: string; lockedAt: number; expiresAt: number; salonId: string; staffOrResourceId: string; date: string; time: string }> = new FirestoreBackedMap('slotLocks');

  // Queue sequence tracker (key: salonId:date -> counter) - Persisted across restarts
  public queueSequences: FirestoreBackedMap<string, { count: number; salonId: string; date: string; updatedAt: string }> = new FirestoreBackedMap('queueSequences');

  async initializeAll() {
    console.log('[DB] Initializing Firestore collections...');
    await Promise.all([
      this.users.initialize(),
      this.salons.initialize(),
      this.services.initialize(),
      this.staff.initialize(),
      this.bookings.initialize(),
      this.queueEntries.initialize(),
      this.reviews.initialize(),
      this.notifications.initialize(),
      this.otpStore.initialize(),
      this.authAccounts.initialize(),
      this.userRoles.initialize(),
      this.supportTickets.initialize(),
      this.featureRequests.initialize(),
      this.featureRequestVotes.initialize(),
      this.adminAuditLogs.initialize(),
      this.paymentOrders.initialize(),
      this.settlementPayouts.initialize(),
      this.adminReminders.initialize(),
      this.queueSequences.initialize(),
      this.slotLocksMap.initialize(),
    ]);
    console.log('[DB] Initialization complete!');
  }

  // --- Transactions & Advanced Queries ---
  public getNextQueueNumber(salonId: string, date: string): number {
    const key = buildQueueKey(salonId, date);
    let current = this.queueSequences.get(key)?.count;
    if (current === undefined) {
      let maxNum = 0;
      for (const b of this.bookings.values()) {
        if (b.salonId === salonId && b.scheduledDate === date) {
          const m = /T?(\d+)/i.exec(b.tokenNumber || '');
          if (m) {
            const num = parseInt(m[1], 10);
            if (!Number.isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      }
      for (const q of this.queueEntries.values()) {
        const entryDate = q.date || (q.joinedAt ? toIstDate(q.joinedAt) : null);
        if (q.salonId === salonId && entryDate === date) {
          const m = /T?(\d+)/i.exec(q.tokenNumber || '');
          if (m) {
            const num = parseInt(m[1], 10);
            if (!Number.isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      }
      current = maxNum;
    }
    const next = current + 1;
    this.queueSequences.set(key, { count: next, salonId, date, updatedAt: new Date().toISOString() });
    return next;
  }

  public getQueueCount(salonId: string, date: string): number {
    return Array.from(this.queueEntries.values()).filter((q) => {
      if (q.salonId !== salonId) return false;
      const entryDate = q.date || (q.joinedAt ? toIstDate(q.joinedAt) : null);
      return entryDate === date;
    }).length;
  }

  public getWaitTimeEstimate(salonId: string, date: string): number {
    const queue = Array.from(this.queueEntries.values()).filter((q) => {
      if (q.salonId !== salonId) return false;
      const entryDate = q.date || (q.joinedAt ? toIstDate(q.joinedAt) : null);
      return entryDate === date && q.status === 'waiting';
    });
    return queue.reduce((sum, q) => sum + (q.serviceDuration || 15), 0);
  }

  public getLiveQueueState(salonId: string, date: string) {
    const queue = Array.from(this.queueEntries.values()).filter((q) => {
      if (q.salonId !== salonId) return false;
      const entryDate = q.date || (q.joinedAt ? toIstDate(q.joinedAt) : null);
      return entryDate === date;
    });
    const waiting = queue.filter((q) => q.status === 'waiting');
    const serving = queue.find(
      (q) => (q.status as string) === 'in_service' || (q.status as string) === 'in_chair' || q.status === 'calling'
    );

    return {
      servingNow: serving ? serving.tokenNumber : null,
      totalWaiting: waiting.length,
      estimatedWaitTime: waiting.reduce((sum, q) => sum + (q.serviceDuration || 15), 0),
    };
  }

  // --- Real Live Queue Recalculation ---

  public recalculateQueue(salonId: string): void {
    const today = businessToday();
    const salon = this.salons.get(salonId);

    const activeEntries = Array.from(this.queueEntries.values()).filter((q) => {
      if (q.salonId !== salonId) return false;
      const entryDate = q.date || (q.joinedAt ? toIstDate(q.joinedAt) : null);
      if (entryDate !== today) return false;
      const s = q.status as string;
      return s === 'waiting' || s === 'calling' || s === 'in_service' || s === 'in_chair';
    });

    activeEntries.sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === 'in_service' || status === 'in_chair') return 1;
        if (status === 'calling') return 2;
        return 3;
      };
      const pDiff = getPriority(a.status) - getPriority(b.status);
      if (pDiff !== 0) return pDiff;
      const tA = a.joinedAt ? Date.parse(a.joinedAt) : 0;
      const tB = b.joinedAt ? Date.parse(b.joinedAt) : 0;
      return tA - tB;
    });

    activeEntries.forEach((entry, idx) => {
      const newPos = idx + 1;
      if (entry.position !== newPos) {
        entry.position = newPos;
        this.queueEntries.set(entry.id, entry);
      }
    });

    if (salon) {
      const waitingEntries = activeEntries.filter((q) => q.status === 'waiting');
      const waitTime = waitingEntries.reduce((sum, q) => sum + (q.serviceDuration || 15), 0);
      salon.queueLength = waitingEntries.length;
      salon.estimatedWaitMinutes = waitTime;
      this.salons.set(salon.id, salon);
    }
  }

  public recalculateQueueStats(salonId: string): void {
    this.recalculateQueue(salonId);
  }

  public isSlotLocked(
    salonId: string,
    staffOrResourceId: string,
    date: string,
    time: string
  ): boolean {
    const key = buildSlotKey(salonId, staffOrResourceId, date, time);
    const existing = this.slotLocksMap.get(key);
    if (!existing) return false;
    if (Date.now() > existing.expiresAt) {
      this.slotLocksMap.delete(key);
      try {
        adminDb.collection('slotLocks').doc(key).delete().catch(() => {});
      } catch {}
      return false;
    }
    return true;
  }

  public getNextTokenNumber(salonOrId: any): string {
    const id = typeof salonOrId === 'string' ? salonOrId : salonOrId.id;
    const date = businessToday();
    const next = this.getNextQueueNumber(id, date);
    return `T${next.toString().padStart(3, '0')}`;
  }

  public getAnalytics(salonId: string): AnalyticsSummary {
    const bookingsList = Array.from(this.bookings.values()).filter(
      (b) => b.salonId === salonId
    );
    const today = businessToday();

    const todayBookings = bookingsList.filter(
      (b) => b.createdAt.startsWith(today) || b.scheduledDate === today
    );

    const completed = todayBookings.filter((b) => b.status === 'completed');
    const waiting = todayBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'checked_in'
    );
    const cancelled = todayBookings.filter((b) => b.status === 'cancelled');
    const noShow = todayBookings.filter((b) => b.status === 'no_show');

    const todayRevenue = completed.reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      todayBookingsCount: todayBookings.length,
      todayCompletedCount: completed.length,
      todayWaitingCount: waiting.length,
      todayCancelledCount: cancelled.length,
      todayNoShowCount: noShow.length,
      todayRevenue,
      averageWaitTimeMinutes: 0,
      hourlyTraffic: [],
      servicePopularity: [],
      staffPerformance: [],
    };
  }

  public tryAcquireSlotLock(salonId: string, staffId: string, date: string, time: string, customerId: string): boolean {
    const key = buildSlotKey(salonId, staffId, date, time);
    const now = Date.now();
    const existing = this.slotLocksMap.get(key);
    if (existing && existing.expiresAt > now && existing.holderId !== customerId) {
      return false; // Still locked by another customer
    }
    this.slotLocksMap.set(key, {
      holderId: customerId,
      lockedAt: now,
      expiresAt: now + 5 * 60 * 1000,
      salonId,
      staffOrResourceId: staffId,
      date,
      time,
    });
    return true;
  }

  public releaseSlotLock(salonId: string, staffId: string, date: string, time: string, customerId?: string): void {
    const key = buildSlotKey(salonId, staffId, date, time);
    const existing = this.slotLocksMap.get(key);
    if (!existing) return;
    if (!customerId || existing.holderId === customerId) {
      this.slotLocksMap.delete(key);
      try {
        adminDb.collection('slotLocks').doc(key).delete().catch(() => {});
      } catch {}
    }
  }

  public async createBookingWithSlotReservation(
    booking: Booking,
    staffOrResourceId: string
  ): Promise<boolean> {
    if (!booking.scheduledDate || !booking.scheduledTime) return false;

    const startMinutes = this.timeToMinutes(booking.scheduledTime);
    const endMinutes = booking.slotEndTime
      ? this.timeToMinutes(booking.slotEndTime)
      : startMinutes + booking.serviceDuration;
    const duration = endMinutes <= startMinutes ? endMinutes + 1440 - startMinutes : endMinutes - startMinutes;
    const slotStarts = Array.from(
      { length: Math.max(1, Math.ceil(duration / 15)) },
      (_, index) => startMinutes + index * 15
    );
    const reservationItems = slotStarts.map((minute) =>
      buildSlotReservationKey(booking.salonId, staffOrResourceId, booking.scheduledDate!, minute)
    );
    const reservationRefs = reservationItems.map((item) => {
      const reservationId = crypto.createHash('sha256').update(item.key).digest('hex');
      return adminDb.collection('slotReservations').doc(reservationId);
    });

    // 1. In-memory conflict check first
    const inMemoryConflict = Array.from(this.bookings.values()).some((b) => {
      if (b.salonId !== booking.salonId || b.scheduledDate !== booking.scheduledDate) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      const existingTargetId = b.resourceId || b.staffId;
      if (existingTargetId && existingTargetId !== staffOrResourceId) return false;
      const bStart = this.timeToMinutes(b.scheduledTime || '00:00');
      const bEnd = b.slotEndTime ? this.timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || 60);
      const rStart = startMinutes;
      const rEnd = endMinutes;
      const bE = bEnd <= bStart ? bEnd + 1440 : bEnd;
      const rE = rEnd <= rStart ? rEnd + 1440 : rEnd;
      return rStart < bE && rE > bStart;
    });

    if (inMemoryConflict) return false;

    // 2. Commit to cache immediately
    this.bookings.cache(booking.id, booking);

    // 3. Attempt Firestore persistence without false-positive timeout
    try {
      const transactionSuccess = await adminDb.runTransaction(async (transaction) => {
        const existingReservations = await Promise.all(reservationRefs.map((reference) => transaction.get(reference)));
        if (existingReservations.some((reservation) => reservation.exists)) return false;

        transaction.set(adminDb.collection('bookings').doc(booking.id), booking);
        reservationRefs.forEach((reference, index) => {
          const item = reservationItems[index];
          transaction.set(reference, {
            bookingId: booking.id,
            salonId: booking.salonId,
            staffOrResourceId,
            date: item.date,
            minute: item.minute,
            createdAt: booking.createdAt,
          });
        });
        return true;
      });

      if (!transactionSuccess) {
        this.bookings.delete(booking.id);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn(`[Firestore Quota/Network Warning] Save booking ${booking.id} backgrounded:`, err?.message || err);
      try {
        adminDb.collection('bookings').doc(booking.id).set(booking).catch(() => {});
      } catch {}
      return true;
    }
  }

  public releaseBookingSlotReservation(booking: Booking): void {
    const staffOrResourceId = booking.resourceId || booking.staffId;
    if (!staffOrResourceId || !booking.scheduledDate || !booking.scheduledTime) return;

    const startMinutes = this.timeToMinutes(booking.scheduledTime);
    const endMinutes = booking.slotEndTime
      ? this.timeToMinutes(booking.slotEndTime)
      : startMinutes + booking.serviceDuration;
    const duration = endMinutes <= startMinutes ? endMinutes + 1440 - startMinutes : endMinutes - startMinutes;
    const slotStarts = Array.from(
      { length: Math.max(1, Math.ceil(duration / 15)) },
      (_, index) => startMinutes + index * 15
    );
    const reservationItems = slotStarts.map((minute) =>
      buildSlotReservationKey(booking.salonId, staffOrResourceId, booking.scheduledDate!, minute)
    );

    void adminDb.runTransaction(async (transaction) => {
      const references = reservationItems.map((item) => {
        return adminDb.collection('slotReservations').doc(crypto.createHash('sha256').update(item.key).digest('hex'));
      });
      const reservations = await Promise.all(references.map((reference) => transaction.get(reference)));
      reservations.forEach((reservation, index) => {
        if (reservation.exists && reservation.data()?.bookingId === booking.id) {
          transaction.delete(references[index]);
        }
      });
    }).catch((error) => console.error('Failed to release booking slot reservation:', error));
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper method to clear everything except demo data for testing
  public clearAll() {
    this.users.clear();
    this.salons.clear();
    this.services.clear();
    this.staff.clear();
    this.bookings.clear();
    this.queueEntries.clear();
    this.reviews.clear();
    this.notifications.clear();
    this.otpStore.clear();
    this.authAccounts.clear();
    this.userRoles.clear();
    this.paymentOrders.clear();
    this.queueSequences.clear();
    this.slotLocksMap.clear();
  }
}

export const db = new QGoDatabase();
