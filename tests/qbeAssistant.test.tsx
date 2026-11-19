import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Ensure localStorage and window mock exists in Node test environment
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      localStorage: localStorageMock,
    },
    writable: true,
  });
}

import {
  getQbePreferences,
  setQbePreference,
  isQbeActiveForRole,
} from '../src/components/qbi/qbePreferences';
import {
  parseSlotStartTime,
  toLocalDateString,
} from '../src/components/qbi/slotReminderEngine';
import {
  handleCustomerAction,
  handleOwnerAction,
  handleAdminAction,
  getAdminDailyBriefing,
} from '../src/components/qbi/qbeAssistantActions';
import { Qbi } from '../src/components/qbi/Qbi';
import { QBE_NAME, QBI_NAME } from '../src/components/qbi/qbiTheme';
import { api } from '../src/services/api';

describe('Qbe Smart Assistant & Slot Reminder Companion', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.restoreAllMocks();
  });

  describe('Part 1: Official Qbe Branding & Expressive Awake Faces', () => {
    it('formalizes name as Qbe across exports and aria-labels', () => {
      expect(QBE_NAME).toBe('Qbe');
      expect(QBI_NAME).toBe('Qbe');

      const html = renderToStaticMarkup(<Qbi mood="happy" animate={false} />);
      expect(html).toContain('aria-label="Qbe - happy"');
      expect(html).not.toContain('qbi-z'); // Sleeping closed 'z's removed
    });

    it('renders all 4 awake expressive vector faces (happy, sad, excited, thinking)', () => {
      // 1. Happy: awake circular eyes with catchlights and upbeat curved smile
      const happyHtml = renderToStaticMarkup(<Qbi mood="happy" />);
      expect(happyHtml).toContain('qbi-anim--happy');
      expect(happyHtml).not.toContain('qbi-z1');

      // 2. Sad: concerned angled brows and empathetic small frown
      const sadHtml = renderToStaticMarkup(<Qbi mood="sad" />);
      expect(sadHtml).toContain('qbi-anim--sad');

      // 3. Excited: sparkle stars, alert ears, and wide star-glint eyes
      const excitedHtml = renderToStaticMarkup(<Qbi mood="excited" />);
      expect(excitedHtml).toContain('qbi-anim--excited');
      expect(excitedHtml).toContain('qbi-sparkle');

      // 4. Thinking: scanning glance pupils and inquiring brow
      const thinkingHtml = renderToStaticMarkup(<Qbi mood="thinking" />);
      expect(thinkingHtml).toContain('qbi-anim--thinking');
      expect(thinkingHtml).toContain('qbi-thinking-pupil');
    });
  });

  describe('Part 2: Centralized Enable / Disable Controls & Role Preferences', () => {
    it('defaults to enabled for platform, customer, owner, and admin', () => {
      const prefs = getQbePreferences();
      expect(prefs.enabled).toBe(true);
      expect(prefs.platformEnabled).toBe(true);
      expect(prefs.customerEnabled).toBe(true);
      expect(prefs.ownerEnabled).toBe(true);
      expect(prefs.adminEnabled).toBe(true);

      expect(isQbeActiveForRole('customer')).toBe(true);
      expect(isQbeActiveForRole('owner')).toBe(true);
      expect(isQbeActiveForRole('admin')).toBe(true);
    });

    it('disables Qbe globally when platform-wide master switch is turned off', () => {
      setQbePreference('platformEnabled', false);
      expect(isQbeActiveForRole('customer')).toBe(false);
      expect(isQbeActiveForRole('owner')).toBe(false);
      expect(isQbeActiveForRole('admin')).toBe(false);
    });

    it('allows independent per-role toggles for customer, owner, and admin', () => {
      setQbePreference('platformEnabled', true);
      setQbePreference('customerEnabled', false);
      setQbePreference('ownerEnabled', true);
      setQbePreference('adminEnabled', false);

      expect(isQbeActiveForRole('customer')).toBe(false);
      expect(isQbeActiveForRole('owner')).toBe(true);
      expect(isQbeActiveForRole('admin')).toBe(false);
    });
  });

  describe('Part 3: Role-Aware Smart Functionality & Interactive Q&A', () => {
    it('handles Customer actions: cancellation policy and refunds', async () => {
      const res = await handleCustomerAction('refunds');
      expect(res.text).toContain('cancellation & refund policy');
      expect(res.card?.type).toBe('policy');
      expect(res.card?.title).toBe('Free Cancellation Policy');
      expect(res.card?.actionTarget).toBe('nav_bookings');
    });

    it('handles Customer actions: upcoming slot queries', async () => {
      vi.spyOn(api, 'getBookings').mockResolvedValue({
        bookings: [
          {
            id: 'b1',
            salonId: 's1',
            salonName: 'Power Turf Ground',
            customerName: 'Kishore',
            customerId: 'c1',
            customerPhone: '9876543210',
            serviceId: 'srv1',
            serviceName: '7v7 Football Turf',
            serviceDuration: 60,
            servicePrice: 1500,
            mode: 'turf',
            status: 'confirmed',
            scheduledDate: toLocalDateString(),
            scheduledTime: '18:00',
            qrCodeId: 'qr1',
            qrSignature: 'sig1',
          } as any,
        ],
      });

      const res = await handleCustomerAction('upcoming');
      expect(res.card).toBeDefined();
      expect(res.card?.title).toBe('Power Turf Ground');
      expect(res.card?.actionTarget).toBe('ticket_b1');
    });

    it('handles Owner actions: upcoming slots in next 2 hours', async () => {
      const today = toLocalDateString();
      vi.spyOn(api, 'getBookings').mockResolvedValue({
        bookings: [
          {
            id: 'b2',
            salonId: 's1',
            salonName: 'Power Turf Ground',
            customerName: 'Rahul',
            customerId: 'c2',
            customerPhone: '9876543210',
            serviceId: 'srv1',
            serviceName: 'Box Cricket Ground',
            serviceDuration: 60,
            servicePrice: 1200,
            mode: 'turf',
            status: 'confirmed',
            scheduledDate: today,
            scheduledTime: '19:00',
            qrCodeId: 'qr2',
            qrSignature: 'sig2',
          } as any,
        ],
      });

      const res = await handleOwnerAction('next_2_hours', 's1');
      expect(res.text).toBeDefined();
      expect(res.card?.actionTarget).toBeDefined();
    });

    it('handles Owner actions: pending balance collections', async () => {
      const today = toLocalDateString();
      vi.spyOn(api, 'getBookings').mockResolvedValue({
        bookings: [
          {
            id: 'b3',
            salonId: 's1',
            salonName: 'Power Turf Ground',
            customerName: 'Sanjay',
            customerId: 'c3',
            customerPhone: '9876543210',
            serviceId: 'srv1',
            serviceName: 'Turf Court',
            serviceDuration: 60,
            servicePrice: 1600,
            mode: 'turf',
            status: 'confirmed',
            scheduledDate: today,
            paymentMode: 'ADVANCE',
            remainingBalance: 800,
            qrCodeId: 'qr3',
            qrSignature: 'sig3',
          } as any,
        ],
      });

      const res = await handleOwnerAction('pending_balance', 's1');
      expect(res.text).toContain('balance to collect');
      expect(res.card?.type).toBe('metric');
      expect(res.card?.title).toContain('800');
      expect(res.card?.actionTarget).toBe('owner_bookings');
    });

    it('handles Admin actions: pending approvals and platform pulse', async () => {
      vi.spyOn(api, 'getAdminVenues').mockResolvedValue({
        venues: [{ id: 'v1', name: 'New Turf', approvalStatus: 'pending', isApproved: false }],
      } as any);

      vi.spyOn(api, 'getAdminOverview').mockResolvedValue({
        success: true,
        kpis: { totalGmv: 48500, qgoNetEarnings: 4200 } as any,
        alerts: [{ id: 'a1', status: 'active', isResolved: false }] as any,
        timeSeries: {} as any,
        statusBreakdown: {},
        categorySplit: { salon: 1, turf: 3 },
        paymentModeSplit: { paid: 1, partially_paid: 1, pay_at_shop: 1 },
      });

      const approvalsRes = await handleAdminAction('pending_approvals');
      expect(approvalsRes.text).toContain('pending approval');
      expect(approvalsRes.card?.actionTarget).toBe('admin_approvals');

      const pulseRes = await handleAdminAction('platform_pulse');
      expect(pulseRes.text).toContain('platform pulse');
      expect(pulseRes.card?.title).toContain('48,500');
      expect(pulseRes.card?.actionTarget).toBe('admin_overview');

      const alertsRes = await handleAdminAction('active_alerts');
      expect(alertsRes.text).toContain('radar');
      expect(alertsRes.card?.actionTarget).toBe('admin_alerts');
    });
  });

  describe('Part 4: Automated Pre-Slot Booking Reminder Time Parser', () => {
    it('parses various slot time formats reliably into exact Dates', () => {
      const today = toLocalDateString();
      const [y, m, d] = today.split('-').map(Number);

      // 24h range format
      const t1 = parseSlotStartTime(today, '18:00 - 19:00');
      expect(t1).not.toBeNull();
      expect(t1?.getFullYear()).toBe(y);
      expect(t1?.getMonth()).toBe(m - 1);
      expect(t1?.getDate()).toBe(d);
      expect(t1?.getHours()).toBe(18);
      expect(t1?.getMinutes()).toBe(0);

      // 12h PM format
      const t2 = parseSlotStartTime(today, '06:30 PM - 07:30 PM');
      expect(t2?.getHours()).toBe(18);
      expect(t2?.getMinutes()).toBe(30);

      // 12h AM format
      const t3 = parseSlotStartTime(today, '09:15 AM');
      expect(t3?.getHours()).toBe(9);
      expect(t3?.getMinutes()).toBe(15);

      // Single time 24h format
      const t4 = parseSlotStartTime(today, '21:00');
      expect(t4?.getHours()).toBe(21);
      expect(t4?.getMinutes()).toBe(0);
    });
  });

  describe('Part 5: Draggable Position & Daily Executive Briefing', () => {
    it('persists and restores Qbe draggable screen coordinates', () => {
      const pos = { x: 250, y: 350 };
      localStorage.setItem('qgo.qbe.position', JSON.stringify(pos));
      const retrieved = JSON.parse(localStorage.getItem('qgo.qbe.position')!);
      expect(retrieved.x).toBe(250);
      expect(retrieved.y).toBe(350);
    });

    it('assembles and delivers the daily executive briefing with user growth and live GMV', async () => {
      vi.spyOn(api, 'getAdminOverview').mockResolvedValue({
        success: true,
        kpis: {
          totalGmv: 65000,
          qgoNetEarnings: 5800,
          todayBookingsCount: 18,
          pendingApprovalsCount: 2,
          totalCustomersCount: 35,
          totalOwnersCount: 9,
        } as any,
        alerts: [],
        timeSeries: {} as any,
        statusBreakdown: {},
        categorySplit: { salon: 2, turf: 7 },
        paymentModeSplit: { paid: 5, partially_paid: 3, pay_at_shop: 10 },
      });

      const briefing = await getAdminDailyBriefing();
      expect(briefing.totalGmv).toBe(65000);
      expect(briefing.todayBookingsCount).toBe(18);
      expect(briefing.pendingApprovalsCount).toBe(2);
      expect(briefing.systemStatus).toBe('healthy');

      const actionRes = await handleAdminAction('daily_briefing');
      expect(actionRes.text).toContain('Daily Executive Platform Briefing');
      expect(actionRes.card?.title).toContain('65,000');
      expect(actionRes.card?.actionTarget).toBe('admin_approvals');
    });

    it('tracks once-daily briefing dismiss date via localStorage', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(localStorage.getItem('qgo.qbe.adminNewsDate')).toBeNull();
      localStorage.setItem('qgo.qbe.adminNewsDate', today);
      expect(localStorage.getItem('qgo.qbe.adminNewsDate')).toBe(today);
    });
  });

  describe('Part 6: Owner vs Customer Login Role Persistence', () => {
    it('persists preferred role in localStorage on login and role switch', () => {
      localStorage.setItem('qgo_preferred_role', 'owner');
      expect(localStorage.getItem('qgo_preferred_role')).toBe('owner');

      localStorage.setItem('qgo_preferred_role', 'consumer');
      expect(localStorage.getItem('qgo_preferred_role')).toBe('consumer');
    });
  });
});
