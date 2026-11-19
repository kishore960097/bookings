import { api } from '../../services/api';
import { Booking } from '../../types';

export interface QbeReminderAlert {
  id: string;
  bookingId: string;
  role: 'customer' | 'owner';
  venueName: string;
  slotTime: string;
  customerName?: string;
  title: string;
  message: string;
  threshold: '30m' | '10m' | '15m';
  timestamp: number;
}

export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseSlotStartTime(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr || !timeStr) return null;

  // Extract start time portion before any "-" or "to"
  const startPart = timeStr.split(/[-–—]|to/i)[0].trim();
  const match = startPart.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}

export async function checkSlotReminders(
  role: 'customer' | 'owner',
  _userId?: string,
  salonId?: string
): Promise<QbeReminderAlert | null> {
  if (typeof window === 'undefined') return null;

  const today = toLocalDateString();
  const now = new Date();

  try {
    if (role === 'customer') {
      const res = await api.getBookings();
      const bookings: Booking[] = res?.bookings || [];

      // Filter confirmed bookings for today
      const todayBookings = bookings.filter(
        (b) => {
          const bDate = b.scheduledDate || (b as any).date;
          const statusStr = String(b.status || '');
          const isConfirmed = statusStr.includes('confirm') || statusStr === 'pending';
          return isConfirmed && (bDate === today || (!bDate && b.joinedQueueAt));
        }
      );

      for (const b of todayBookings) {
        const slotDate = b.scheduledDate || (b as any).date || today;
        const slotTime = b.scheduledTime || (b as any).timeSlot || (b as any).time || '';
        const startTime = parseSlotStartTime(slotDate, slotTime);
        if (!startTime) continue;

        const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);

        // 10 minutes reminder takes priority if in window (0 < diff <= 10)
        if (diffMinutes > 0 && diffMinutes <= 10) {
          const key = `qgo.qbe.reminded.${b.id}.10m`;
          if (localStorage.getItem(key) !== 'true') {
            localStorage.setItem(key, 'true');
            const alert: QbeReminderAlert = {
              id: `${b.id}-10m`,
              bookingId: b.id,
              role: 'customer',
              venueName: b.salonName || 'Your Turf',
              slotTime: slotTime,
              title: `⚡ 10 Mins to Slot: ${b.salonName || 'Your Turf'}`,
              message: `Your booking starts in ${Math.max(1, Math.round(diffMinutes))} mins! Have your check-in QR code ready.`,
              threshold: '10m',
              timestamp: Date.now(),
            };
            dispatchBrowserNotification(alert.title, alert.message);
            return alert;
          }
        }

        // 30 minutes reminder (10 < diff <= 30)
        if (diffMinutes > 10 && diffMinutes <= 30) {
          const key = `qgo.qbe.reminded.${b.id}.30m`;
          if (localStorage.getItem(key) !== 'true') {
            localStorage.setItem(key, 'true');
            const alert: QbeReminderAlert = {
              id: `${b.id}-30m`,
              bookingId: b.id,
              role: 'customer',
              venueName: b.salonName || 'Your Turf',
              slotTime: slotTime,
              title: `⏰ Slot Reminder: ${b.salonName || 'Your Turf'}`,
              message: `Your booking starts in ${Math.round(diffMinutes)} mins (${slotTime}). Time to get ready!`,
              threshold: '30m',
              timestamp: Date.now(),
            };
            dispatchBrowserNotification(alert.title, alert.message);
            return alert;
          }
        }
      }
    } else if (role === 'owner') {
      const activeSalonId = salonId || localStorage.getItem('qgo_salon_id') || '';
      if (!activeSalonId) return null;

      const res = await api.getBookings({ salonId: activeSalonId });
      const bookings: Booking[] = res?.bookings || [];

      const todayBookings = bookings.filter(
        (b) => {
          const bDate = b.scheduledDate || (b as any).date;
          const statusStr = String(b.status || '');
          const isConfirmed = statusStr.includes('confirm') || statusStr === 'pending';
          return isConfirmed && bDate === today;
        }
      );

      for (const b of todayBookings) {
        const slotDate = b.scheduledDate || (b as any).date || today;
        const slotTime = b.scheduledTime || (b as any).timeSlot || (b as any).time || '';
        const startTime = parseSlotStartTime(slotDate, slotTime);
        if (!startTime) continue;

        const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);

        // 15 minutes operational reminder for owners (0 < diff <= 15)
        if (diffMinutes > 0 && diffMinutes <= 15) {
          const key = `qgo.qbe.reminded.owner.${b.id}.15m`;
          if (localStorage.getItem(key) !== 'true') {
            localStorage.setItem(key, 'true');
            const customer = b.customerName || (b as any).userName || 'Customer';
            const alert: QbeReminderAlert = {
              id: `${b.id}-owner-15m`,
              bookingId: b.id,
              role: 'owner',
              venueName: b.salonName || 'Your Venue',
              slotTime: slotTime,
              customerName: customer,
              title: `🏟️ Upcoming Slot in 15 mins`,
              message: `${customer} arrives at ${slotTime} for ${b.serviceName || 'Turf ground'}. Prepare court / gear.`,
              threshold: '15m',
              timestamp: Date.now(),
            };
            dispatchBrowserNotification(alert.title, alert.message);
            return alert;
          }
        }
      }
    }
  } catch (err) {
    // Non-fatal background reminder check
    console.debug('[Qbe] Slot reminder check skipped:', err);
  }

  return null;
}

export function dispatchBrowserNotification(title: string, body: string): void {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/qgo-logo.svg',
          badge: '/qgo-logo.svg',
        });
      }
    }
  } catch (e) {
    console.debug('[Qbe] Browser notification unavailable:', e);
  }
}
