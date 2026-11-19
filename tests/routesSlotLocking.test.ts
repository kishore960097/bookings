import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../server/db';
import type { Booking } from '../src/types';
import { minutesToTime, timeToMinutes } from '../packages/shared/src/time';

describe('multi-slot locking and 15-minute interval unlocking', () => {
  const salonId = 'salon_test_slots';
  const resourceId = 'turf_pitch_1';
  const scheduledDate = '2026-11-20';

  beforeEach(() => {
    // Clear slot locks
    for (let m = 0; m < 1440; m += 15) {
      db.releaseSlotLock(salonId, resourceId, scheduledDate, minutesToTime(m), undefined);
    }
  });

  it('acquires locks for all requested slots and prevents double booking', () => {
    const requestedSlots = [
      { startTime: '18:00', endTime: '19:00', durationMinutes: 60, price: 1000 },
      { startTime: '19:00', endTime: '20:00', durationMinutes: 60, price: 1000 },
    ];

    const bookingId1 = 'bk_1';
    for (const slot of requestedSlots) {
      const ok = db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, slot.startTime, bookingId1);
      expect(ok).toBe(true);
    }

    // Second booking attempting to lock overlapping slot 18:00 fails
    const bookingId2 = 'bk_2';
    const overlapOk = db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:00', bookingId2);
    expect(overlapOk).toBe(false);
  });

  it('releases locks across all 15-minute intervals when booking ends', () => {
    const booking: Booking = {
      id: 'bk_multi_slot',
      salonId,
      salonName: 'Test Arena',
      resourceId,
      customerId: 'usr_test_1',
      customerName: 'Test Customer',
      customerPhone: '9876543210',
      serviceId: 'srv_1',
      serviceName: 'Pitch 1',
      serviceDuration: 60,
      servicePrice: 1000,
      mode: 'appointment',
      scheduledDate,
      scheduledTime: '18:00',
      slotEndTime: '19:00',
      status: 'confirmed',
      paymentStatus: 'pay_at_shop',
      amount: 1000,
      qrCodeId: 'QR-TEST',
      qrSignature: 'SIG-TEST',
      createdAt: '2026-11-20T10:00:00.000Z',
    };

    // Lock intervals
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:00', booking.id)).toBe(true);
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:15', booking.id)).toBe(true);
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:30', booking.id)).toBe(true);
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:45', booking.id)).toBe(true);

    // Release across 15-min increments
    const startM = timeToMinutes(booking.scheduledTime!);
    let endM = timeToMinutes(booking.slotEndTime!);
    if (endM <= startM) endM += 1440;
    for (let m = startM; m < endM; m += 15) {
      const timeStr = minutesToTime(m % 1440);
      db.releaseSlotLock(booking.salonId, resourceId, booking.scheduledDate!, timeStr, undefined);
    }

    // Now all intervals should be acquirable by a new booking
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:00', 'new_bk')).toBe(true);
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:15', 'new_bk')).toBe(true);
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:30', 'new_bk')).toBe(true);
    expect(db.tryAcquireSlotLock(salonId, resourceId, scheduledDate, '18:45', 'new_bk')).toBe(true);
  });
});
