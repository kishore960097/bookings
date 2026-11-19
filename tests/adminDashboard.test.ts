import { describe, it, expect, beforeAll } from 'vitest';
import { isSuperAdminEmail, DEFAULT_SUPER_ADMIN_EMAIL } from '../server/config';
import { sanitizeCellValue, sanitizeRow } from '../src/utils/adminExport';
import { isUserOnline, toIstDateString } from '../server/routes';

process.env.QGO_SESSION_SECRET = 'secure-production-random-token-secret-for-qgo-tests-12345';

describe('Super Admin Monitoring & Access Control', () => {
  beforeAll(() => {
    process.env.QGO_SESSION_SECRET = 'secure-production-random-token-secret-for-qgo-tests-12345';
  });
  describe('Allowlist Verification & Promotion', () => {
    it('accurately verifies the verified super admin email cjkishore35@gmail.com', () => {
      expect(isSuperAdminEmail('cjkishore35@gmail.com')).toBe(true);
      expect(isSuperAdminEmail('CJKISHORE35@GMAIL.COM')).toBe(true);
      expect(isSuperAdminEmail('  cjkishore35@gmail.com  ')).toBe(true);
      expect(DEFAULT_SUPER_ADMIN_EMAIL).toBe('cjkishore35@gmail.com');
    });

    it('rejects unauthorized or arbitrary emails from gaining super admin access', () => {
      expect(isSuperAdminEmail('attacker@example.com')).toBe(false);
      expect(isSuperAdminEmail('cjkishore35@otherdomain.com')).toBe(false);
      expect(isSuperAdminEmail('customer@qgo.in')).toBe(false);
      expect(isSuperAdminEmail(undefined)).toBe(false);
      expect(isSuperAdminEmail(null)).toBe(false);
      expect(isSuperAdminEmail('')).toBe(false);
    });
  });

  describe('User Online Presence & IST Date Helpers', () => {
    it('returns true if lastActiveAt was within 5 minutes', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      expect(isUserOnline({ lastActiveAt: twoMinutesAgo })).toBe(true);
      expect(isUserOnline({ lastActiveAt: new Date().toISOString() })).toBe(true);
    });

    it('returns false if lastActiveAt was more than 5 minutes ago', () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      expect(isUserOnline({ lastActiveAt: sixMinutesAgo })).toBe(false);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(isUserOnline({ lastActiveAt: oneDayAgo })).toBe(false);
    });

    it('returns false for missing, null, or invalid lastActiveAt', () => {
      expect(isUserOnline(null)).toBe(false);
      expect(isUserOnline(undefined)).toBe(false);
      expect(isUserOnline({ lastActiveAt: null })).toBe(false);
      expect(isUserOnline({ lastActiveAt: undefined })).toBe(false);
      expect(isUserOnline({ lastActiveAt: 'not-a-date' })).toBe(false);
    });

    it('converts UTC timestamps correctly to IST date string (YYYY-MM-DD)', () => {
      // 2026-11-18 20:00:00 UTC is 2026-11-19 01:30:00 IST (+5.5h)
      const lateUtc = '2026-11-18T20:00:00.000Z';
      expect(toIstDateString(lateUtc)).toBe('2026-11-19');

      // 2026-11-18 01:00:00 UTC is 2026-11-18 06:30:00 IST
      const earlyUtc = '2026-11-18T01:00:00.000Z';
      expect(toIstDateString(earlyUtc)).toBe('2026-11-18');

      expect(toIstDateString(null)).toBe(null);
      expect(toIstDateString(undefined)).toBe(null);
      expect(toIstDateString('invalid')).toBe(null);
    });
  });

  describe('Customer & Owner Metrics Aggregation', () => {
    it('correctly aggregates customer online and active today counts', () => {
      const now = Date.now();
      const todayIst = toIstDateString(new Date(now).toISOString());

      const sampleUsers = [
        { id: 'u1', lastActiveAt: new Date(now - 1 * 60 * 1000).toISOString() }, // online & today
        { id: 'u2', lastActiveAt: new Date(now - 30 * 60 * 1000).toISOString() }, // offline & today
        { id: 'u3', lastActiveAt: new Date(now - 48 * 60 * 60 * 1000).toISOString() }, // offline & past
        { id: 'u4', lastActiveAt: null }, // offline & never
      ];

      const totalCustomers = sampleUsers.length;
      const onlineCustomers = sampleUsers.filter((u) => isUserOnline(u)).length;
      const activeTodayCustomers = sampleUsers.filter((u) => {
        if (isUserOnline(u)) return true;
        return toIstDateString(u.lastActiveAt) === todayIst;
      }).length;

      expect(totalCustomers).toBe(4);
      expect(onlineCustomers).toBe(1);
      expect(activeTodayCustomers).toBe(2);
    });

    it('correctly aggregates owner categories across turfs and salons', () => {
      const sampleOwners = [
        {
          id: 'o1',
          venues: [{ id: 'v1', category: 'Turf', bookingMode: 'slot' }],
        },
        {
          id: 'o2',
          venues: [{ id: 'v2', category: 'Salon', bookingMode: 'queue' }],
        },
        {
          id: 'o3',
          venues: [
            { id: 'v3', category: 'Turf', bookingMode: 'slot' },
            { id: 'v4', category: 'Salon', bookingMode: 'queue' },
          ],
        },
        {
          id: 'o4',
          venues: [],
        },
      ];

      let turfCount = 0;
      let salonCount = 0;
      let otherCount = 0;

      for (const o of sampleOwners) {
        const hasTurf = o.venues.some((v) => (v.category || '').toLowerCase().includes('turf'));
        const hasSalon = o.venues.some((v) => (v.category || '').toLowerCase().includes('salon'));
        if (hasTurf) turfCount++;
        else if (hasSalon) salonCount++;
        else otherCount++;
      }

      expect(turfCount).toBe(2); // o1 and o3
      expect(salonCount).toBe(1); // o2
      expect(otherCount).toBe(1); // o4
    });
  });

  describe('Spreadsheet Export Formula-Injection Sanitization', () => {
    it('neutralizes malicious formula injection characters (=, +, -, @, tab, cr)', () => {
      expect(sanitizeCellValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeCellValue('+1234567890')).toBe("'+1234567890");
      expect(sanitizeCellValue('-1000')).toBe("'-1000");
      expect(sanitizeCellValue('@cmd|/C calc.exe')).toBe("'@cmd|/C calc.exe");
      expect(sanitizeCellValue('\tTabbedText')).toBe("'\tTabbedText");
      expect(sanitizeCellValue('\rReturnText')).toBe("'\rReturnText");
    });

    it('leaves standard strings, numbers, booleans, and null untouched', () => {
      expect(sanitizeCellValue('Valid Business Name')).toBe('Valid Business Name');
      expect(sanitizeCellValue('12345')).toBe('12345');
      expect(sanitizeCellValue(450.5)).toBe(450.5);
      expect(sanitizeCellValue(true)).toBe(true);
      expect(sanitizeCellValue(null)).toBe(null);
    });

    it('correctly sanitizes entire row objects and nested structures', () => {
      const maliciousRow = {
        bookingId: 'BK12345',
        customerName: '=cmd|"/C calc.exe"!A0',
        amount: 500,
        notes: '+special discount applied',
        metadata: { source: '@mobile_app' },
      };

      const sanitized = sanitizeRow(maliciousRow);
      expect(sanitized.bookingId).toBe('BK12345');
      expect(sanitized.customerName).toBe('\'=cmd|"/C calc.exe"!A0');
      expect(sanitized.amount).toBe(500);
      expect(sanitized.notes).toBe('\'+special discount applied');
      expect(typeof sanitized.metadata).toBe('string');
      expect(sanitized.metadata).toContain('mobile_app');
    });
  });

  describe('Customer Reliability Score Math', () => {
    const calculateReliability = (total: number, noShows: number, cancelled: number) => {
      if (total === 0) return 100;
      const penalty = Math.round(((noShows * 2.0 + cancelled * 0.5) / total) * 100);
      return Math.max(0, Math.min(100, 100 - penalty));
    };

    it('returns 100% for pristine history or no bookings', () => {
      expect(calculateReliability(0, 0, 0)).toBe(100);
      expect(calculateReliability(10, 0, 0)).toBe(100);
    });

    it('penalizes chronic no-shows severely', () => {
      // 10 bookings, 2 no-shows: ((2 * 2.0) / 10) * 100 = 40% penalty -> 60% reliability
      const score = calculateReliability(10, 2, 0);
      expect(score).toBe(60);
    });

    it('caps score at minimum 0% and maximum 100%', () => {
      expect(calculateReliability(5, 5, 5)).toBe(0);
      expect(calculateReliability(10, 0, 0)).toBe(100);
    });
  });

  describe('Admin Notification Dropdown & Dark Mode Contrast Semantics', () => {
    it('accurately computes unread notification counts and supports batch marking as read', () => {
      const initialNotifications = [
        { id: '1', title: 'KYC Verification', read: false },
        { id: '2', title: 'Booking Surge', read: false },
        { id: '3', title: 'Settlement Escrow', read: false },
        { id: '4', title: 'System Health', read: true },
      ];

      const getUnread = (items: typeof initialNotifications) => items.filter((n) => !n.read).length;
      expect(getUnread(initialNotifications)).toBe(3);

      const allRead = initialNotifications.map((n) => ({ ...n, read: true }));
      expect(getUnread(allRead)).toBe(0);
    });

    it('ensures admin dashboard source file contains no washed-out light gray cards in dark mode', () => {
      const fs = require('fs');
      const dashboardSrc = fs.readFileSync('src/components/admin/SuperAdminDashboard.tsx', 'utf8');

      // Zero uncontrasted washed-out bg-white/70 cards
      expect(dashboardSrc).not.toContain('bg-white/70');
      // Zero uncontrasted washed-out bg-white/80 cards
      expect(dashboardSrc).not.toContain('bg-white/80');
      // Zero hardcoded text-[#121318] without dark mode pairs
      const hardcodedDarkText = (dashboardSrc.match(/text-\[#121318\](?! dark:)/g) || []).length;
      expect(hardcodedDarkText).toBe(0);
      // Header must NOT have overflow-hidden (which causes notification popover clipping)
      const headerLine = dashboardSrc.match(/<header[^>]*>/)?.[0] || '';
      expect(headerLine).not.toContain('overflow-hidden');
      expect(headerLine).toContain('z-50');
    });
  });
});
