import { describe, expect, it } from 'vitest';
import type { Booking } from '../src/types';
import {
  extractOwnerTicketId,
  findOwnerTicketBooking,
  getBookingSlotId,
  getOwnerTicketEligibilityError,
} from '../server/lib/ownerTickets';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_turf_1761750000000_ab123',
    salonId: 'salon_1',
    salonName: 'QGo Arena',
    resourceId: 'turf_1',
    customerId: 'customer_1',
    customerName: 'Customer One',
    customerPhone: '',
    serviceId: 'service_1',
    serviceName: 'Turf slot',
    serviceDuration: 60,
    servicePrice: 1000,
    mode: 'appointment',
    scheduledDate: '2026-10-29',
    scheduledTime: '18:00',
    slotEndTime: '19:00',
    status: 'confirmed',
    qrCodeId: 'QR-TEST',
    qrSignature: 'signature',
    paymentStatus: 'pay_at_shop',
    amount: 1000,
    createdAt: '2026-10-29T10:00:00.000Z',
    ...overrides,
  };
}

describe('owner ticket lookup', () => {
  const ticketId = 'QGO-1761750000000_ab123';
  const booking = makeBooking();

  it('accepts the new short ticket ID, the full booking ID, legacy JSON, and URL payloads', () => {
    expect(extractOwnerTicketId(ticketId)).toBe('1761750000000_ab123');
    expect(findOwnerTicketBooking(ticketId, [booking])?.id).toBe(booking.id);
    expect(findOwnerTicketBooking(booking.id, [booking])?.id).toBe(booking.id);
    expect(findOwnerTicketBooking(JSON.stringify({ bookingId: booking.id }), [booking])?.id).toBe(booking.id);
    expect(findOwnerTicketBooking(`https://qgo.app/ticket?id=${encodeURIComponent(ticketId)}`, [booking])?.id).toBe(booking.id);
  });

  it('retains unique old suffix QR codes but rejects ambiguous suffixes', () => {
    const second = makeBooking({ id: 'bk_turf_1761750000001_ab123' });
    expect(findOwnerTicketBooking('QGO-ab123', [booking])?.id).toBe(booking.id);
    expect(findOwnerTicketBooking('QGO-ab123', [booking, second])).toBeNull();
  });

  it('rejects malformed, oversized, and injection-like identifiers', () => {
    expect(extractOwnerTicketId('')).toBeNull();
    expect(extractOwnerTicketId('QGO-<script>')).toBeNull();
    expect(extractOwnerTicketId(`QGO-${'a'.repeat(130)}`)).toBeNull();
    expect(findOwnerTicketBooking('QGO-not-a-ticket', [booking])).toBeNull();
  });
});

describe('owner ticket completion eligibility', () => {
  it('derives a date/resource-specific slot ID for the exact booking', () => {
    expect(getBookingSlotId(makeBooking())).toBe('salon_1:turf_1:2026-10-29:18:00:19:00');
    expect(getBookingSlotId(makeBooking({ slotId: 'existing-slot-id' }))).toBe('existing-slot-id');
  });

  it('rejects cancelled, refunded, and expired bookings while allowing pay-at-venue bookings', () => {
    expect(getOwnerTicketEligibilityError(makeBooking({ status: 'cancelled' }), false)?.code).toBe('CANCELLED');
    expect(getOwnerTicketEligibilityError(makeBooking({ refundStatus: 'completed' }), false)?.code).toBe('CANCELLED');
    expect(getOwnerTicketEligibilityError(makeBooking({ status: 'no_show' }), false)?.code).toBe('EXPIRED');
    expect(getOwnerTicketEligibilityError(makeBooking(), true)?.code).toBe('EXPIRED');
    expect(getOwnerTicketEligibilityError(makeBooking(), false)).toBeNull();
  });
});
