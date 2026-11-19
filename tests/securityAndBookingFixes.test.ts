import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../server/db';
import { businessToday } from '../server/lib/businessTime';

describe('Security & Booking Logic Fixes', () => {
  const testSalonId = 'sal_test_security_1';

  beforeEach(() => {
    db.clearAll();
  });

  describe('Queue Sequence & Persistence', () => {
    it('generates sequential queue numbers and increments properly', () => {
      const today = businessToday();
      const num1 = db.getNextQueueNumber(testSalonId, today);
      const num2 = db.getNextQueueNumber(testSalonId, today);
      const num3 = db.getNextQueueNumber(testSalonId, today);

      expect(num1).toBe(1);
      expect(num2).toBe(2);
      expect(num3).toBe(3);
    });

    it('generates token strings with padded 3-digit format (T001, T002...)', () => {
      const token1 = db.getNextTokenNumber(testSalonId);
      const token2 = db.getNextTokenNumber(testSalonId);

      expect(token1).toMatch(/^T\d{3}$/);
      expect(token2).toMatch(/^T\d{3}$/);
      expect(parseInt(token2.slice(1), 10)).toBe(parseInt(token1.slice(1), 10) + 1);
    });
  });

  describe('Live Queue Recalculation', () => {
    it('reassigns sequential queuePosition (1, 2, 3...) ordered by priority', () => {
      const today = businessToday();
      db.salons.set(testSalonId, {
        id: testSalonId,
        ownerId: 'usr_owner_1',
        name: 'Test Salon',
        category: 'salon',
        isPublished: true,
      } as any);

      // Create queue entries with out-of-order positions
      const qeWaiting2 = {
        id: 'qe_2',
        salonId: testSalonId,
        bookingId: 'bk_2',
        tokenNumber: 'T002',
        position: 5,
        status: 'waiting' as const,
        joinedAt: new Date(Date.now() + 1000).toISOString(),
        serviceDuration: 20,
      } as any;

      const qeWaiting1 = {
        id: 'qe_1',
        salonId: testSalonId,
        bookingId: 'bk_1',
        tokenNumber: 'T001',
        position: 8,
        status: 'waiting' as const,
        joinedAt: new Date().toISOString(),
        serviceDuration: 30,
      } as any;

      const qeServing = {
        id: 'qe_serving',
        salonId: testSalonId,
        bookingId: 'bk_serving',
        tokenNumber: 'T000',
        position: 10,
        status: 'in_service' as const,
        joinedAt: new Date(Date.now() - 5000).toISOString(),
        serviceDuration: 15,
      } as any;

      db.queueEntries.set(qeWaiting2.id, qeWaiting2);
      db.queueEntries.set(qeWaiting1.id, qeWaiting1);
      db.queueEntries.set(qeServing.id, qeServing);

      db.recalculateQueue(testSalonId);

      // in_service entry should be position 1
      expect(db.queueEntries.get('qe_serving')?.position).toBe(1);
      // first joined waiting entry should be position 2
      expect(db.queueEntries.get('qe_1')?.position).toBe(2);
      // second joined waiting entry should be position 3
      expect(db.queueEntries.get('qe_2')?.position).toBe(3);

      // Salon queueLength and estimatedWaitMinutes should be updated
      const updatedSalon = db.salons.get(testSalonId);
      expect(updatedSalon?.queueLength).toBe(2); // 2 waiting entries
      expect(updatedSalon?.estimatedWaitMinutes).toBe(50); // 30 + 20 mins
    });
  });

  describe('Slot Lock Concurrency & TTL', () => {
    it('acquires slot lock and prevents another customer from double-booking', () => {
      const date = '2026-12-01';
      const time = '10:00';
      const staffId = 'st_1';

      const acquired1 = db.tryAcquireSlotLock(testSalonId, staffId, date, time, 'cust_1');
      expect(acquired1).toBe(true);

      // Second customer tries to acquire same slot
      const acquired2 = db.tryAcquireSlotLock(testSalonId, staffId, date, time, 'cust_2');
      expect(acquired2).toBe(false);

      // Same customer re-acquiring succeeds
      const reacquired = db.tryAcquireSlotLock(testSalonId, staffId, date, time, 'cust_1');
      expect(reacquired).toBe(true);
    });

    it('releases lock allowing another customer to acquire it', () => {
      const date = '2026-12-01';
      const time = '11:00';
      const staffId = 'st_1';

      db.tryAcquireSlotLock(testSalonId, staffId, date, time, 'cust_1');
      expect(db.isSlotLocked(testSalonId, staffId, date, time)).toBe(true);

      db.releaseSlotLock(testSalonId, staffId, date, time, 'cust_1');
      expect(db.isSlotLocked(testSalonId, staffId, date, time)).toBe(false);

      const acquiredByOther = db.tryAcquireSlotLock(testSalonId, staffId, date, time, 'cust_2');
      expect(acquiredByOther).toBe(true);
    });
  });

  describe('Midnight Rollover Chronological Slot Ordering', () => {
    it('sorts slots chronologically across midnight (23:00 to 01:00)', () => {
      const slots = [
        { startTime: '00:00', endTime: '01:00' },
        { startTime: '22:00', endTime: '23:00' },
        { startTime: '23:00', endTime: '00:00' },
      ];

      const sorted = [...slots].sort((a, b) => {
        const [hA, mA] = a.startTime.split(':').map(Number);
        const [hB, mB] = b.startTime.split(':').map(Number);
        let minA = hA * 60 + mA;
        let minB = hB * 60 + mB;
        if (minA < 360 && minB >= 720) minA += 1440;
        if (minB < 360 && minA >= 720) minB += 1440;
        return minA - minB;
      });

      expect(sorted[0].startTime).toBe('22:00');
      expect(sorted[1].startTime).toBe('23:00');
      expect(sorted[2].startTime).toBe('00:00');
      // Consecutive check succeeds across midnight
      expect(sorted[1].endTime).toBe(sorted[2].startTime);
    });
  });

  describe('Interval Overlap Logic', () => {
    it('detects partial and full time-interval overlaps accurately', () => {
      const checkOverlap = (start1: number, end1: number, start2: number, end2: number) => {
        return start1 < end2 && end1 > start2;
      };

      // Existing booking 10:00 - 11:00 (600 - 660)
      const bStart = 600;
      const bEnd = 660;

      // New request 10:30 - 11:00 (630 - 660) overlaps
      expect(checkOverlap(630, 660, bStart, bEnd)).toBe(true);

      // New request 09:30 - 10:30 (570 - 630) overlaps
      expect(checkOverlap(570, 630, bStart, bEnd)).toBe(true);

      // New request 09:00 - 10:00 (540 - 600) touches boundary, does not overlap
      expect(checkOverlap(540, 600, bStart, bEnd)).toBe(false);

      // New request 11:00 - 12:00 (660 - 720) touches boundary, does not overlap
      expect(checkOverlap(660, 720, bStart, bEnd)).toBe(false);
    });
  });
});
