import type { Booking } from '../../src/types';

export interface OwnerTicketEligibilityError {
  code: 'CANCELLED' | 'EXPIRED';
  message: string;
}

export function extractOwnerTicketId(payload: unknown): string | null {
  if (typeof payload !== 'string' || payload.length > 2048) return null;
  const input = payload.trim();
  if (!input) return null;
  let candidate: unknown = input;

  if (input.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(input);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      const record = parsed as Record<string, unknown>;
      candidate = record.ticketId || record.bookingId || record.id || record.qrCodeId || record.tokenNumber || record.token;
    } catch {
      return null;
    }
  } else if (/^https?:\/\//i.test(input) || input.includes('?')) {
    try {
      const url = new URL(input, 'https://qgo.app');
      candidate = url.searchParams.get('ticketId')
        || url.searchParams.get('bookingId')
        || url.searchParams.get('id')
        || url.searchParams.get('bId')
        || url.pathname.split('/').filter(Boolean).pop()
        || '';
    } catch {
      return null;
    }
  }

  if (typeof candidate !== 'string') return null;
  const cleaned = candidate.trim().replace(/^QGO-/i, '');
  return /^[a-zA-Z0-9_-]{1,128}$/.test(cleaned) ? cleaned : null;
}

export function findOwnerTicketBooking(payload: unknown, bookings: Iterable<Booking>): Booking | null {
  const cleanId = extractOwnerTicketId(payload);
  if (!cleanId) return null;
  const normalized = cleanId.toUpperCase();
  const allBookings = Array.from(bookings);
  const exactMatches = allBookings.filter((booking) => (
    booking.id.toUpperCase() === normalized
    || booking.id.replace(/^(bk_turf_|bk_walkin_|bk_|booking_)/i, '').toUpperCase() === normalized
    || (booking.qrCodeId || '').toUpperCase() === normalized
    || booking.tokenNumber?.toUpperCase() === normalized
  ));
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1 || normalized.length > 8) return null;

  const legacyMatches = allBookings.filter((booking) => (
    (booking.id.split('_').pop() || '').toUpperCase() === normalized
  ));
  return legacyMatches.length === 1 ? legacyMatches[0] : null;
}

export function getBookingSlotId(booking: Booking): string {
  return booking.slotId || [
    booking.salonId,
    booking.resourceId || booking.staffId || 'default',
    booking.scheduledDate || '',
    booking.scheduledTime || '',
    booking.slotEndTime || '',
  ].join(':');
}

export function getOwnerTicketEligibilityError(
  booking: Booking,
  expired: boolean
): OwnerTicketEligibilityError | null {
  if (booking.status === 'cancelled') {
    return { code: 'CANCELLED', message: 'This booking was cancelled and cannot be completed.' };
  }
  if (booking.refundStatus === 'completed' || booking.refundAmount > 0 || /refund/i.test(booking.paymentStatus || '')) {
    return { code: 'CANCELLED', message: 'This booking has been refunded and cannot be completed.' };
  }
  if (booking.status === 'no_show' || expired) {
    return { code: 'EXPIRED', message: 'This ticket has expired and cannot be completed.' };
  }
  return null;
}
