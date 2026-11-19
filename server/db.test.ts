import { describe, it, expect } from 'vitest';
import { buildQueueKey, buildSlotKey } from './keys';

describe('db key builders', () => {
  describe('buildQueueKey', () => {
    it('generates a consistent key for same inputs', () => {
      const key1 = buildQueueKey('salon1', '2023-10-09');
      const key2 = buildQueueKey('salon1', '2023-10-09');
      
      // Explicitly compare the two generated keys
      expect(key1).toBe(key2);
      expect(key1).toBe('salon1:2023-10-09');
    });

    it('generates different keys for different inputs', () => {
      const key1 = buildQueueKey('salon1', '2023-10-09');
      const key2 = buildQueueKey('salon2', '2023-10-09');
      const key3 = buildQueueKey('salon1', '2023-10-10');
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('throws error on missing inputs', () => {
      expect(() => buildQueueKey('', '2023-10-09')).toThrow();
      expect(() => buildQueueKey('salon1', '')).toThrow();
    });
  });

  describe('buildSlotKey', () => {
    it('generates a consistent key for same inputs', () => {
      const key1 = buildSlotKey('salon1', 'staffA', '2023-10-09', '10:00');
      const key2 = buildSlotKey('salon1', 'staffA', '2023-10-09', '10:00');
      
      // Explicitly compare the two generated keys
      expect(key1).toBe(key2);
      expect(key1).toBe('salon1:staffA:2023-10-09:10:00');
    });

    it('generates different keys for different inputs', () => {
      const key1 = buildSlotKey('salon1', 'staffA', '2023-10-09', '10:00');
      const key2 = buildSlotKey('salon2', 'staffA', '2023-10-09', '10:00');
      const key3 = buildSlotKey('salon1', 'staffB', '2023-10-09', '10:00');
      const key4 = buildSlotKey('salon1', 'staffA', '2023-10-10', '10:00');
      const key5 = buildSlotKey('salon1', 'staffA', '2023-10-09', '11:00');
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
      expect(key1).not.toBe(key5);
    });

    it('throws error on missing inputs', () => {
      expect(() => buildSlotKey('', 'staffA', '2023-10-09', '10:00')).toThrow();
      expect(() => buildSlotKey('salon1', '', '2023-10-09', '10:00')).toThrow();
      expect(() => buildSlotKey('salon1', 'staffA', '', '10:00')).toThrow();
      expect(() => buildSlotKey('salon1', 'staffA', '2023-10-09', '')).toThrow();
    });
  });

  describe('db slot reservations & business time', () => {
    it('allows different stylists to have overlapping booking times without in-memory conflict', async () => {
      const { db } = await import('./db');
      db.clearAll();

      const booking1 = {
        id: 'booking_stylist_1',
        salonId: 'salon_test',
        salonName: 'Test Salon',
        customerId: 'cust_1',
        customerName: 'Customer 1',
        customerPhone: '1234567890',
        serviceId: 'srv_1',
        serviceName: 'Haircut',
        serviceDuration: 60,
        servicePrice: 500,
        staffId: 'stylist_A',
        scheduledDate: '2026-11-20',
        scheduledTime: '10:00',
        slotEndTime: '11:00',
        amount: 500,
        status: 'confirmed' as const,
        paymentStatus: 'paid' as const,
        mode: 'appointment' as const,
        qrCodeId: 'qr1',
        qrSignature: 'sig1',
        createdAt: new Date().toISOString(),
      };

      const booking2 = {
        id: 'booking_stylist_2',
        salonId: 'salon_test',
        salonName: 'Test Salon',
        customerId: 'cust_2',
        customerName: 'Customer 2',
        customerPhone: '9876543210',
        serviceId: 'srv_1',
        serviceName: 'Haircut',
        serviceDuration: 60,
        servicePrice: 500,
        staffId: 'stylist_B',
        scheduledDate: '2026-11-20',
        scheduledTime: '10:00',
        slotEndTime: '11:00',
        amount: 500,
        status: 'confirmed' as const,
        paymentStatus: 'paid' as const,
        mode: 'appointment' as const,
        qrCodeId: 'qr2',
        qrSignature: 'sig2',
        createdAt: new Date().toISOString(),
      };

      const res1 = await db.createBookingWithSlotReservation(booking1, 'stylist_A');
      expect(res1).toBe(true);

      // Stylist B at the same time must not be blocked by Stylist A
      const res2 = await db.createBookingWithSlotReservation(booking2, 'stylist_B');
      expect(res2).toBe(true);

      // Same stylist (Stylist A) at the same time MUST be blocked
      const booking1Duplicate = { ...booking1, id: 'booking_stylist_1_dup', customerId: 'cust_3' };
      const resDuplicate = await db.createBookingWithSlotReservation(booking1Duplicate, 'stylist_A');
      expect(resDuplicate).toBe(false);
    });

    it('generates next token number using businessToday', async () => {
      const { db } = await import('./db');
      const token = db.getNextTokenNumber('salon_test');
      expect(token).toMatch(/^T\d{3}$/);
    });

    it('rolls over date and normalizes minutes across midnight in buildSlotReservationKey', async () => {
      const { buildSlotReservationKey } = await import('./db');
      // 23:00 on Nov 20 (minute 1380)
      const res1 = buildSlotReservationKey('salon1', 'turfA', '2026-11-20', 1380);
      expect(res1.date).toBe('2026-11-20');
      expect(res1.minute).toBe(1380);
      expect(res1.key).toBe('salon1:turfA:2026-11-20:1380');

      // 00:00 next day (minute 1440) -> rolls over to Nov 21, minute 0
      const res2 = buildSlotReservationKey('salon1', 'turfA', '2026-11-20', 1440);
      expect(res2.date).toBe('2026-11-21');
      expect(res2.minute).toBe(0);
      expect(res2.key).toBe('salon1:turfA:2026-11-21:0');

      // 00:30 next day (minute 1470) -> rolls over to Nov 21, minute 30
      const res3 = buildSlotReservationKey('salon1', 'turfA', '2026-11-20', 1470);
      expect(res3.date).toBe('2026-11-21');
      expect(res3.minute).toBe(30);
      expect(res3.key).toBe('salon1:turfA:2026-11-21:30');
    });
  });
});
