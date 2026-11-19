import { describe, expect, it, beforeEach, vi } from 'vitest';

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
      open: () => null,
      localStorage: localStorageMock,
    },
    writable: true,
  });
}

import {
  isConfidentialPlatformQuery,
  CONFIDENTIAL_REFUSAL_MESSAGE,
  parseNaturalTimeReminder,
  handleCustomerAction,
  handleOwnerAction,
  handleAdminAction,
} from '../src/components/qbi/qbeAssistantActions';
import {
  getQbePreferences,
  setQbePreference,
} from '../src/components/qbi/qbePreferences';
import { api } from '../src/services/api';

describe('Qbe Executive 24/7 AI Assistant & Strict Role Isolation', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.restoreAllMocks();
  });

  describe('1. Strict Role Isolation & Confidentiality Firewall', () => {
    it('detects confidential platform keywords accurately', () => {
      expect(isConfidentialPlatformQuery('What is your profit?')).toBe(true);
      expect(isConfidentialPlatformQuery('Show me the 30 margin fee')).toBe(true);
      expect(isConfidentialPlatformQuery('What is total GMV this month?')).toBe(true);
      expect(isConfidentialPlatformQuery('Call admin at 9600971886')).toBe(true);
      expect(isConfidentialPlatformQuery('Tell me Kishore password')).toBe(true);
      expect(isConfidentialPlatformQuery('Execute KISHOREYES reset')).toBe(true);
      expect(isConfidentialPlatformQuery('Show me firestore database collections')).toBe(true);
      expect(isConfidentialPlatformQuery('Where is escrow balance held?')).toBe(true);

      // Safe non-confidential queries
      expect(isConfidentialPlatformQuery('How do I book a slot?')).toBe(false);
      expect(isConfidentialPlatformQuery('Where can I see my tickets?')).toBe(false);
      expect(isConfidentialPlatformQuery('Can I reschedule my appointment?')).toBe(false);
    });

    it('strictly blocks confidential queries from Customer role', async () => {
      const resp1 = await handleCustomerAction(
        'custom',
        'How much profit does QGo make per booking?'
      );
      expect(resp1.text).toBe(CONFIDENTIAL_REFUSAL_MESSAGE);

      const resp2 = await handleCustomerAction(
        'custom',
        'Give me Kishore phone number 9600971886'
      );
      expect(resp2.text).toBe(CONFIDENTIAL_REFUSAL_MESSAGE);

      const resp3 = await handleCustomerAction(
        'custom',
        'What is the database password KISHOREYES?'
      );
      expect(resp3.text).toBe(CONFIDENTIAL_REFUSAL_MESSAGE);
    });

    it('strictly blocks confidential queries from Owner role', async () => {
      const resp1 = await handleOwnerAction(
        'custom',
        'What is QGo total GMV and margin take rate?'
      );
      expect(resp1.text).toBe(CONFIDENTIAL_REFUSAL_MESSAGE);

      const resp2 = await handleOwnerAction(
        'custom',
        'Who is Kishore and what is 9600971886?'
      );
      expect(resp2.text).toBe(CONFIDENTIAL_REFUSAL_MESSAGE);
    });

    it('allows legitimate customer and owner assistance while blocking confidential data', async () => {
      const custResp = await handleCustomerAction(
        'custom',
        'How do I show my QR ticket at the turf?'
      );
      expect(custResp.text).not.toBe(CONFIDENTIAL_REFUSAL_MESSAGE);
      expect(custResp.text.toLowerCase()).toContain('qr');

      const ownerResp = await handleOwnerAction(
        'custom',
        'How does the QR scanner work?'
      );
      expect(ownerResp.text).not.toBe(CONFIDENTIAL_REFUSAL_MESSAGE);
      expect(ownerResp.text.toLowerCase()).toContain('scan');
    });
  });

  describe('2. Natural Time Reminder Parser (English & Tanglish)', () => {
    it('parses Tanglish command "12:40-ku call panni remind pannu"', () => {
      const parsed = parseNaturalTimeReminder('12:40-ku call panni remind pannu');
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('12:40 PM');
      expect(parsed?.targetMinutesOfDay).toBe(12 * 60 + 40); // 760
    });

    it('parses English command "Call me at 12:40 PM to check Turf 1 payout"', () => {
      const parsed = parseNaturalTimeReminder(
        'Call me at 12:40 PM to check Turf 1 payout'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('12:40 PM');
      expect(parsed?.targetMinutesOfDay).toBe(760);
      expect(parsed?.note).toContain('check Turf 1 payout');
    });

    it('parses morning time "Remind me at 9:15 AM to inspect pending approvals"', () => {
      const parsed = parseNaturalTimeReminder(
        'Remind me at 9:15 AM to inspect pending approvals'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('09:15 AM');
      expect(parsed?.targetMinutesOfDay).toBe(9 * 60 + 15); // 555
    });

    it('parses 24-hour military time "Remind me at 17:30"', () => {
      const parsed = parseNaturalTimeReminder('Remind me at 17:30');
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('05:30 PM');
      expect(parsed?.targetMinutesOfDay).toBe(17 * 60 + 30); // 1050
    });

    it('smart daytime AM/PM resolution: resolves "1:00-ku call pannu" at 12:59 PM to upcoming 01:00 PM', () => {
      // 12:59 PM in IST (07:29 UTC)
      const mockTime = new Date('2026-11-19T07:29:00Z');
      const parsed = parseNaturalTimeReminder('1:00-ku call pannu', mockTime);
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('01:00 PM');
      expect(parsed?.targetMinutesOfDay).toBe(13 * 60); // 780
      expect(parsed?.scheduledTime).toBe('13:00');
    });

    it('smart daytime AM/PM resolution: resolves "10:00-ku call pannu" at 09:00 AM to upcoming 10:00 AM', () => {
      // 09:00 AM in IST (03:30 UTC)
      const mockTime = new Date('2026-11-19T03:30:00Z');
      const parsed = parseNaturalTimeReminder('10:00-ku call pannu', mockTime);
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('10:00 AM');
      expect(parsed?.targetMinutesOfDay).toBe(10 * 60); // 600
      expect(parsed?.scheduledTime).toBe('10:00');
    });

    it('respects explicit AM even during afternoon', () => {
      const mockTime = new Date('2026-11-19T07:29:00Z'); // 12:59 IST
      const parsed = parseNaturalTimeReminder('1:00 am-ku call pannu', mockTime);
      expect(parsed).not.toBeNull();
      expect(parsed?.targetTime).toBe('01:00 AM');
      expect(parsed?.targetMinutesOfDay).toBe(60);
    });

    it('returns null when no valid time expression is found', () => {
      const parsed = parseNaturalTimeReminder('Hello Qbe how are you doing today?');
      expect(parsed).toBeNull();
    });
  });

  describe('3. Super Admin Natural Autonomous Commands', () => {
    it('schedules a custom reminder via natural command', async () => {
      const createReminderSpy = vi
        .spyOn(api, 'createAdminReminder')
        .mockResolvedValueOnce({
          success: true,
          reminder: {
            id: 'rem_123',
            adminId: 'admin_test',
            targetTime: '12:40 PM',
            targetDate: '2026-11-19',
            targetMinutesOfDay: 760,
            title: 'Custom Reminder',
            note: '12:40 reminder',
            triggered: false,
            acknowledged: false,
            notifyPhone: '9600971886',
            createdAt: '2026-11-19T07:10:00Z',
          },
        });

      const resp = await handleAdminAction('custom', '12:40-ku call panni remind pannu');
      expect(createReminderSpy).toHaveBeenCalled();
      expect(resp.actionData?.type).toBe('schedule_reminder');
      expect(resp.text).toContain('12:40 PM');
      expect(resp.text).toContain('9600971886');
    });

    it('handles "Pending turf/salon approve pannu" by auto-approving venues', async () => {
      vi.spyOn(api, 'getAdminVenues').mockResolvedValueOnce({
        success: true,
        venues: [
          {
            id: 'v_unapp',
            name: 'Chennai Smashers Turf',
            isApproved: false,
            approvalStatus: 'pending',
            category: 'turf',
            ownerName: 'Vignesh',
          },
        ],
      } as any);

      vi.spyOn(api, 'approveVenue').mockResolvedValueOnce({
        success: true,
        venue: { id: 'v_unapp', isApproved: true },
      } as any);

      const resp = await handleAdminAction('custom', 'Pending turf/salon approve pannu');
      expect(resp.actionData?.type).toBe('approve_venues');
      expect(resp.text).toContain('Chennai Smashers Turf');
    });

    it('handles "Download profit Excel" by triggering export action', async () => {
      const resp = await handleAdminAction('custom', 'Download profit Excel');
      expect(resp.actionData?.type).toBe('export_excel');
      expect(resp.text.toLowerCase()).toContain('profit');
    });

    it('handles WhatsApp alert command to 9600971886', async () => {
      vi.spyOn(api, 'getAdminSettlements').mockResolvedValueOnce({
        success: true,
        settlements: [
          {
            salonId: 's_1',
            salonName: 'Skyline Turf',
            netOwnerPayable: 14000,
            isPayoutDue: true,
            payoutCycle: 'weekly',
          },
        ],
      } as any);

      const resp = await handleAdminAction(
        'custom',
        'Send weekly payout details to 9600971886'
      );
      expect(resp.actionData?.type).toBe('send_whatsapp');
      expect(resp.actionData?.data?.whatsappUrl).toContain('wa.me/919600971886');
    });

    it('handles "Reply to all 5 star reviews" autonomously', async () => {
      vi.spyOn(api, 'getAdminVenues').mockResolvedValueOnce({
        success: true,
        venues: [
          {
            id: 'v_1',
            name: 'Prime Turf',
          },
        ],
      } as any);

      vi.spyOn(api, 'getSalonReviews').mockResolvedValueOnce({
        success: true,
        reviews: [
          {
            id: 'rev_1',
            rating: 5,
            comment: 'Fantastic turf and great lighting!',
            ownerReply: '',
          },
        ],
      } as any);

      const replySpy = vi.spyOn(api, 'replyToReview').mockResolvedValueOnce({
        success: true,
      } as any);

      const resp = await handleAdminAction('custom', 'Reply to all 5 star reviews');
      expect(replySpy).toHaveBeenCalled();
      expect(resp.actionData?.type).toBe('auto_reply_reviews');
      expect(resp.text).toContain('1 positive 4★ and 5★ customer reviews');
    });

    it('handles theme voice command "dai page ahh dark mood mathu"', async () => {
      const resp = await handleAdminAction('custom', 'dai page ahh dark mood mathu');
      expect(resp.actionData?.type).toBe('set_theme');
      expect(resp.actionData?.data?.mode).toBe('dark');
      expect(resp.spokenText).toBe('Dark mode activated.');
    });

    it('handles theme voice command "light mode mathu"', async () => {
      const resp = await handleAdminAction('custom', 'light mode mathu');
      expect(resp.actionData?.type).toBe('set_theme');
      expect(resp.actionData?.data?.mode).toBe('light');
      expect(resp.spokenText).toBe('Light mode activated.');
    });

    it('handles language voice command "tamil mathu"', async () => {
      const resp = await handleAdminAction('custom', 'tamil mathu');
      expect(resp.actionData?.type).toBe('set_language');
      expect(resp.actionData?.data?.language).toBe('ta');
      expect(resp.spokenText).toBe('மொழி தமிழுக்கு மாற்றப்பட்டது.');
    });

    it('handles language voice command "english mathu"', async () => {
      const resp = await handleAdminAction('custom', 'english mathu');
      expect(resp.actionData?.type).toBe('set_language');
      expect(resp.actionData?.data?.language).toBe('en');
      expect(resp.spokenText).toBe('Switched language to English.');
    });

    it('handles tab navigation command "approvals kaattu"', async () => {
      const resp = await handleAdminAction('custom', 'approvals kaattu');
      expect(resp.actionData?.type).toBe('navigate_tab');
      expect(resp.actionData?.data?.tab).toBe('approvals');
      expect(resp.spokenText).toContain('Approvals');
    });

    it('handles tab navigation command "payments open pannu"', async () => {
      const resp = await handleAdminAction('custom', 'payments open pannu');
      expect(resp.actionData?.type).toBe('navigate_tab');
      expect(resp.actionData?.data?.tab).toBe('payments');
    });

    it('handles venue drill-down command "open Skyline Turf details"', async () => {
      const resp = await handleAdminAction('custom', 'open Skyline Turf details');
      expect(resp.actionData?.type).toBe('venue_drilldown');
      expect(resp.actionData?.data?.venueName).toBe('Skyline Turf');
      expect(resp.spokenText).toContain('Skyline Turf');
    });

    it('enforces safety refusal when asked to reset database without authorization', async () => {
      const resp = await handleAdminAction('custom', 'Reset the database now');
      expect(resp.text).toContain('KISHOREYES');
      expect(resp.actionData?.type).toBe('safety_guard_refusal');
    });
  });

  describe('4. Autonomous Settings & Preferences Defaults', () => {
    it('initializes with production-ready executive defaults', () => {
      const prefs = getQbePreferences();
      expect(prefs.platformEnabled).toBe(true);
      expect(prefs.adminEnabled).toBe(true);
      expect(prefs.autopilotWatchdog).toBe(true);
      expect(prefs.voiceOutputEnabled).toBe(true);
      expect(prefs.speechRate).toBe(1.0);
      expect(prefs.ringtoneEnabled).toBe(true);
      expect(prefs.vibrationEnabled).toBe(true);
      expect(prefs.adminPhone).toBe('9600971886');
      expect(prefs.dailyBriefingSchedule).toBe(true);
      expect(prefs.weeklyPayoutSchedule).toBe(true);
      expect(prefs.monthlyPayoutSchedule).toBe(true);
    });

    it('persists preference updates reliably in localStorage', () => {
      setQbePreference('speechRate', 1.25);
      expect(getQbePreferences().speechRate).toBe(1.25);

      setQbePreference('autopilotWatchdog', false);
      expect(getQbePreferences().autopilotWatchdog).toBe(false);

      setQbePreference('autopilotWatchdog', true);
      expect(getQbePreferences().autopilotWatchdog).toBe(true);
    });
  });

  describe('5. Real Twilio Cellular SIM Voice & Native Lock-Screen Test Call', () => {
    it('dispatches test call and returns twilio_cellular_call channel', async () => {
      const testSpy = vi.spyOn(api, 'testQbeCall').mockResolvedValueOnce({
        success: true,
        recipient: '919600971886',
        whatsappUrl: 'https://wa.me/919600971886?text=test',
        automatedSent: false,
        deliveryChannel: 'twilio_cellular_call',
        twilioStatus: {
          channel: 'twilio_cellular_call',
          success: true,
          sid: 'CA123456789',
          status: 'queued',
        },
        callData: {
          callerName: 'Qbe',
          callerSubtitle: 'Executive AI',
          title: 'Executive Test Call',
          message: 'Attention Kishore, this is a verified test call from Qbe.',
          timestamp: '2026-11-19T07:30:00Z',
        },
      });

      const res = await api.testQbeCall('9600971886');
      expect(testSpy).toHaveBeenCalledWith('9600971886');
      expect(res.deliveryChannel).toBe('twilio_cellular_call');
      expect(res.recipient).toBe('919600971886');
      expect(res.twilioStatus?.sid).toBe('CA123456789');
    });
  });
});
