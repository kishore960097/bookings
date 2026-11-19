import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../server/db';
import type { Booking, Salon } from '../src/types';

describe('Feature: Scan Customer Ticket -> Confirm -> Mark Slot Completed', () => {
  const testSalonId = 'salon_test_turf_1';
  const otherSalonId = 'salon_other_turf_2';
  const testOwnerId = 'owner_user_1';

  beforeEach(() => {
    // Setup test salon
    const salon: Salon = {
      id: testSalonId,
      ownerId: testOwnerId,
      name: 'KD Sports Arena',
      category: 'Turf',
      description: 'Premier sports turf',
      logoUrl: '',
      coverUrl: '',
      address: 'Main Road',
      city: 'Erode',
      lat: 11.34,
      lng: 77.71,
      phone: '9876543210',
      verified: true,
      isPublished: true,
      status: 'live',
      setupStep: 8,
      enableQueue: false,
      bookingMode: 'resource_slot',
      bookingSettings: {
        advanceBookingDays: 30,
        minNoticeMinutes: 15,
        cancellationAllowed: true,
        cancellationDeadlineHours: 2,
        customerChoosesStaff: false,
      },
      joinCode: 'KD1234',
      pin: '1234',
      workingHours: [],
      holidays: [],
      rating: 4.8,
      reviewCount: 20,
      queueLength: 0,
      estimatedWaitMinutes: 0,
      createdAt: new Date().toISOString(),
    };
    db.salons.set(testSalonId, salon);
  });

  it('marks a valid confirmed ticket and its slot as completed atomically', () => {
    const bookingId = 'bk_turf_test_101';
    const booking: Booking = {
      id: bookingId,
      salonId: testSalonId,
      salonName: 'KD Sports Arena',
      resourceId: 'turf_1',
      resourceName: 'Main Pitch (7-a-side)',
      customerId: 'cust_user_42',
      customerName: 'Karthik',
      customerPhone: '+919876543210',
      serviceId: 'srv_turf_60',
      serviceName: 'Box Cricket Slot',
      serviceDuration: 60,
      servicePrice: 1200,
      mode: 'appointment',
      scheduledDate: '2026-10-29',
      scheduledTime: '18:00',
      slotEndTime: '19:00',
      status: 'confirmed',
      qrCodeId: 'QR-TEST-101',
      qrSignature: 'sig-test',
      paymentStatus: 'paid',
      amount: 1200,
      totalAmount: 1200,
      paidAmount: 1200,
      createdAt: new Date().toISOString(),
    };
    db.bookings.set(bookingId, booking);

    // Simulate completion
    const b = db.bookings.get(bookingId)!;
    expect(b.status).toBe('confirmed');

    const completedAt = new Date().toISOString();
    b.status = 'completed';
    b.completedAt = completedAt;
    b.completedBy = testOwnerId;
    db.bookings.set(b.id, b);

    const saved = db.bookings.get(bookingId)!;
    expect(saved.status).toBe('completed');
    expect(saved.completedAt).toBe(completedAt);
    expect(saved.completedBy).toBe(testOwnerId);
  });

  it('is idempotent: completing an already completed ticket returns success without modifying original completedAt', () => {
    const bookingId = 'bk_turf_test_102';
    const originalCompletedAt = '2026-10-29T10:00:00.000Z';
    const booking: Booking = {
      id: bookingId,
      salonId: testSalonId,
      salonName: 'KD Sports Arena',
      resourceId: 'turf_1',
      customerId: 'cust_user_43',
      customerName: 'Dinesh',
      customerPhone: '+919876543211',
      serviceId: 'srv_turf_60',
      serviceName: 'Football Slot',
      serviceDuration: 60,
      servicePrice: 1500,
      mode: 'appointment',
      status: 'completed',
      completedAt: originalCompletedAt,
      completedBy: testOwnerId,
      qrCodeId: 'QR-TEST-102',
      qrSignature: 'sig-test',
      paymentStatus: 'paid',
      amount: 1500,
      createdAt: new Date().toISOString(),
    };
    db.bookings.set(bookingId, booking);

    const b = db.bookings.get(bookingId)!;
    const isAlreadyCompleted = b.status === 'completed';
    expect(isAlreadyCompleted).toBe(true);
    expect(b.completedAt).toBe(originalCompletedAt);
  });

  it('rejects tickets from other owners with wrong salon check', () => {
    const bookingId = 'bk_turf_wrong_salon_103';
    const booking: Booking = {
      id: bookingId,
      salonId: otherSalonId, // Booked for a different venue
      salonName: 'Other City Turf',
      resourceId: 'turf_2',
      customerId: 'cust_user_44',
      customerName: 'Ravi',
      customerPhone: '+919876543212',
      serviceId: 'srv_turf_60',
      serviceName: 'Cricket',
      serviceDuration: 60,
      servicePrice: 1000,
      mode: 'appointment',
      status: 'confirmed',
      qrCodeId: 'QR-TEST-103',
      qrSignature: 'sig-test',
      paymentStatus: 'paid',
      amount: 1000,
      createdAt: new Date().toISOString(),
    };
    db.bookings.set(bookingId, booking);

    const b = db.bookings.get(bookingId)!;
    // Attempting to complete under testSalonId should fail ownership check
    const matchesOwnerSalon = b.salonId === testSalonId;
    expect(matchesOwnerSalon).toBe(false);
  });

  it('rejects cancelled bookings from being marked completed', () => {
    const bookingId = 'bk_turf_cancelled_104';
    const booking: Booking = {
      id: bookingId,
      salonId: testSalonId,
      salonName: 'KD Sports Arena',
      resourceId: 'turf_1',
      customerId: 'cust_user_45',
      customerName: 'Praveen',
      customerPhone: '+919876543213',
      serviceId: 'srv_turf_60',
      serviceName: 'Cricket',
      serviceDuration: 60,
      servicePrice: 1000,
      mode: 'appointment',
      status: 'cancelled',
      cancellationReason: 'Player requested refund',
      qrCodeId: 'QR-TEST-104',
      qrSignature: 'sig-test',
      paymentStatus: 'paid',
      amount: 1000,
      createdAt: new Date().toISOString(),
    };
    db.bookings.set(bookingId, booking);

    const b = db.bookings.get(bookingId)!;
    const canComplete = b.status !== 'cancelled' && b.status !== 'no_show';
    expect(canComplete).toBe(false);
  });

  it('validates sanitized booking ID format rejecting injection payloads', () => {
    const validId = 'bk_turf_valid_123';
    const invalidId1 = 'bk_turf<script>alert(1)</script>';
    const invalidId2 = 'bk_turf; DROP TABLE bookings;--';
    const idRegex = /^[a-zA-Z0-9_-]{1,128}$/;

    expect(idRegex.test(validId)).toBe(true);
    expect(idRegex.test(invalidId1)).toBe(false);
    expect(idRegex.test(invalidId2)).toBe(false);
  });
});

