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
} from '../src/types';
import { adminDb } from './firebaseAdmin';
import { buildQueueKey, buildSlotKey } from './keys';
import crypto from 'crypto';

// Write-through cache map that persists to Firestore
class FirestoreBackedMap<K extends string, V> extends Map<K, V> {
  public collectionName: string;
  private readonly proxies = new Map<K, V>();

  constructor(collectionName: string) {
    super();
    this.collectionName = collectionName;
  }

  async initialize() {
    try {
      const snap = await adminDb.collection(this.collectionName).get();
      for (const doc of snap.docs) {
        super.set(doc.id as K, doc.data() as V);
      }
      console.log(`[DB] Loaded ${snap.size} items from ${this.collectionName}`);
    } catch (err) {
      console.error(`[DB Error] Failed to load ${this.collectionName}:`, err);
      throw err;
    }
  }

  set(key: K, value: V): this {
    super.set(key, value);
    this.proxies.delete(key);
    adminDb.collection(this.collectionName).doc(key).set(value).catch(err => {
      console.error(`[Firestore Error] Failed to save ${this.collectionName}/${key}:`, err);
    });
    return this;
  }

  delete(key: K): boolean {
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
      adminDb.collection(this.collectionName).doc(key).set(value).catch(err => {
        console.error(`[Firestore Error] Failed to save ${this.collectionName}/${key}:`, err);
      });
    };
    const wrap = (target: any): any => {
      if (!target || typeof target !== 'object') return target;
      const cached = seen.get(target);
      if (cached) return cached;
      const proxy = new Proxy(target, {
        get(object, property, receiver) {
          return wrap(Reflect.get(object, property, receiver));
        },
        set(object, property, nextValue, receiver) {
          const result = Reflect.set(object, property, nextValue, receiver);
          persist();
          return result;
        },
        deleteProperty(object, property) {
          const result = Reflect.deleteProperty(object, property);
          persist();
          return result;
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

  // Concurrency Slot Lock Map (key: salonId:staffId:date:time)
  private slotLocks: Map<string, string> = new Map(); // Ephemeral, memory only

  // Queue sequence tracker (key: salonId:date -> counter)
  private queueSequence: Map<string, number> = new Map(); // Ephemeral, memory only

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
    ]);
    console.log('[DB] Initialization complete!');
  }

  // --- Transactions & Advanced Queries ---
  public getNextQueueNumber(salonId: string, date: string): number {
    const key = buildQueueKey(salonId, date);
    const next = (this.queueSequence.get(key) || 0) + 1;
    this.queueSequence.set(key, next);
    return next;
  }

  public getQueueCount(salonId: string, date: string): number {
    return Array.from(this.queueEntries.values()).filter(q => q.salonId === salonId && q.date === date).length;
  }

  public getWaitTimeEstimate(salonId: string, date: string): number {
    const queue = Array.from(this.queueEntries.values()).filter(q => q.salonId === salonId && q.date === date && q.status === 'waiting');
    return queue.length * 15; // 15 mins per person
  }

  public getLiveQueueState(salonId: string, date: string) {
    const queue = Array.from(this.queueEntries.values()).filter(q => q.salonId === salonId && q.date === date);
    const waiting = queue.filter(q => q.status === 'waiting');
    const serving = queue.filter(q => q.status === 'in_chair')[0];
    
    return {
      servingNow: serving ? serving.tokenNumber : null,
      totalWaiting: waiting.length,
      estimatedWaitTime: waiting.length * 15
    };
  }

  // --- Slot Locks ---

  public recalculateQueueStats(salonId: string): void {
    // No-op for now, frontend reads live state
  }

  public recalculateQueue(salonId: string): void {}



  public isSlotLocked(
    salonId: string,
    staffOrResourceId: string,
    date: string,
    time: string
  ): boolean {
    const key = buildSlotKey(salonId, staffOrResourceId, date, time);
    return this.slotLocks.has(key);
  }

  public getNextTokenNumber(salonOrId: any): string {
    const id = typeof salonOrId === 'string' ? salonOrId : salonOrId.id;
    const date = new Date().toISOString().split('T')[0];
    const next = this.getNextQueueNumber(id, date);
    return `T${next.toString().padStart(3, '0')}`;
  }

  public getAnalytics(salonId: string): AnalyticsSummary {
    const bookingsList = Array.from(this.bookings.values()).filter(
      (b) => b.salonId === salonId
    );
    const today = new Date().toISOString().split('T')[0];

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
    if (this.slotLocks.has(key)) {
      return false; // Already locked
    }
    this.slotLocks.set(key, customerId);
    // Auto-release lock after 5 minutes if booking fails
    setTimeout(() => {
      if (this.slotLocks.get(key) === customerId) {
        this.slotLocks.delete(key);
      }
    }, 5 * 60 * 1000);
    return true;
  }

  public releaseSlotLock(salonId: string, staffId: string, date: string, time: string, customerId?: string): void {
    const key = buildSlotKey(salonId, staffId, date, time);
    if (!customerId || this.slotLocks.get(key) === customerId) {
      this.slotLocks.delete(key);
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
    const reservationRefs = slotStarts.map((minute) => {
      const reservationKey = `${booking.salonId}:${staffOrResourceId}:${booking.scheduledDate}:${minute}`;
      const reservationId = crypto.createHash('sha256').update(reservationKey).digest('hex');
      return adminDb.collection('slotReservations').doc(reservationId);
    });

    const created = await adminDb.runTransaction(async (transaction) => {
      const existingReservations = await Promise.all(reservationRefs.map((reference) => transaction.get(reference)));
      if (existingReservations.some((reservation) => reservation.exists)) return false;

      transaction.set(adminDb.collection('bookings').doc(booking.id), booking);
      reservationRefs.forEach((reference, index) => {
        transaction.set(reference, {
          bookingId: booking.id,
          salonId: booking.salonId,
          staffOrResourceId,
          date: booking.scheduledDate,
          minute: slotStarts[index],
          createdAt: booking.createdAt,
        });
      });
      return true;
    });

    if (created) {
      this.bookings.cache(booking.id, booking);
    }
    return created;
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

    void adminDb.runTransaction(async (transaction) => {
      const references = slotStarts.map((minute) => {
        const reservationKey = `${booking.salonId}:${staffOrResourceId}:${booking.scheduledDate}:${minute}`;
        return adminDb.collection('slotReservations').doc(crypto.createHash('sha256').update(reservationKey).digest('hex'));
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
  }
}

export const db = new QGoDatabase();
