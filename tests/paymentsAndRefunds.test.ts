import { describe, it, expect, beforeAll } from 'vitest';
import {
  normalizePaymentStatus,
  makeOrderSignature,
  makePaymentSignature,
  verifyPaymentSignature,
} from '../server/lib/payment';
import { computeBreakdown } from '../src/utils/paymentBreakdown';

describe('Payment & Refund Reliability Suite', () => {
  beforeAll(() => {
    process.env.QGO_SESSION_SECRET = 'secure-production-random-token-secret-for-qgo-tests-12345';
  });

  describe('Accounting Invariant', () => {
    it('preserves (paidAmount - convenienceFee - gstAmount + balanceAmount === finalPrice) for FULL payment', () => {
      const finalPrice = 1200;
      const breakdown = computeBreakdown({ slotTotal: finalPrice, mode: 'FULL' });
      
      const paidAmount = breakdown.payNow;
      const convenienceFee = breakdown.qgoFee;
      const gstAmount = breakdown.gst;
      const balanceAmount = breakdown.balanceAtVenue;

      const netSlotCredit = paidAmount - convenienceFee - gstAmount;
      expect(Math.round(netSlotCredit + balanceAmount)).toBe(finalPrice);
      expect(balanceAmount).toBe(0);
    });

    it('preserves (paidAmount - convenienceFee - gstAmount + balanceAmount === finalPrice) for ADVANCE payment', () => {
      const finalPrice = 1500;
      const advanceAmount = 500;
      const breakdown = computeBreakdown({
        slotTotal: finalPrice,
        advanceAmount,
        mode: 'ADVANCE',
      });

      const paidAmount = breakdown.payNow;
      const convenienceFee = breakdown.qgoFee;
      const gstAmount = breakdown.gst;
      const balanceAmount = breakdown.balanceAtVenue;

      const netSlotCredit = paidAmount - convenienceFee - gstAmount;
      expect(Math.round(netSlotCredit + balanceAmount)).toBe(finalPrice);
      expect(balanceAmount).toBe(1000);
      expect(Math.round(netSlotCredit)).toBe(500);
    });
  });

  describe('Cancellation Refund Calculation', () => {
    // Helper replicating PATCH /bookings/:id/cancel calculation in server/routes.ts
    function calculateRefund(booking: {
      paymentStatus?: string;
      paidAmount?: number;
      amount: number;
      convenienceFee?: number;
      gstAmount?: number;
      refundPercentage?: number;
      isOwnerCancel?: boolean;
    }) {
      const refundPct = booking.isOwnerCancel ? 100 : (booking.refundPercentage ?? 70);
      const normStatus = normalizePaymentStatus(booking.paymentStatus);

      let refundAmount = 0;
      let nonRefundableAmount = 0;
      let refundStatus: 'none' | 'pending' | 'completed' | 'rejected' = 'none';

      if (normStatus === 'paid' || normStatus === 'partially_paid') {
        const rawNetSlotPaid = Math.max(
          0,
          (booking.paidAmount || 0) - (booking.convenienceFee || 0) - (booking.gstAmount || 0)
        );
        const netSlotPaid = Math.round(rawNetSlotPaid * 100) / 100;
        const refundablePaid = netSlotPaid > 0 ? netSlotPaid : (normStatus === 'paid' ? (booking.amount || 0) : 0);
        refundAmount = Math.round((refundablePaid * refundPct) / 100);
        nonRefundableAmount = Math.max(0, Math.round((refundablePaid - refundAmount) * 100) / 100);
        refundStatus = refundAmount > 0 ? 'completed' : 'none';
      } else {
        refundAmount = 0;
        nonRefundableAmount = 0;
        refundStatus = 'none';
      }

      return { refundAmount, nonRefundableAmount, refundStatus, refundPct };
    }

    it('calculates 70% refund for customer cancellation on FULL online payment', () => {
      const booking = {
        paymentStatus: 'paid',
        amount: 1000,
        paidAmount: 1035.40,
        convenienceFee: 30,
        gstAmount: 5.40,
        refundPercentage: 70,
        isOwnerCancel: false,
      };

      const result = calculateRefund(booking);
      expect(result.refundPct).toBe(70);
      // Net slot paid = 1035.40 - 30 - 5.40 = 1000. 70% of 1000 = 700.
      expect(result.refundAmount).toBe(700);
      expect(result.nonRefundableAmount).toBe(300);
      expect(result.refundStatus).toBe('completed');
    });

    it('calculates 100% refund for owner cancellation on FULL online payment', () => {
      const booking = {
        paymentStatus: 'paid',
        amount: 1000,
        paidAmount: 1035.40,
        convenienceFee: 30,
        gstAmount: 5.40,
        refundPercentage: 70,
        isOwnerCancel: true,
      };

      const result = calculateRefund(booking);
      expect(result.refundPct).toBe(100);
      expect(result.refundAmount).toBe(1000);
      expect(result.nonRefundableAmount).toBe(0);
      expect(result.refundStatus).toBe('completed');
    });

    it('never over-refunds for ADVANCE payment customer cancellation', () => {
      // Slot price is ₹2000, but customer only paid ₹500 advance + ₹35.40 fee
      const booking = {
        paymentStatus: 'partially_paid',
        amount: 2000,
        paidAmount: 535.40,
        convenienceFee: 30,
        gstAmount: 5.40,
        refundPercentage: 70,
        isOwnerCancel: false,
      };

      const result = calculateRefund(booking);
      // Net slot paid is ₹500 (NOT the full ₹2000 slot price). 70% of ₹500 = ₹350.
      expect(result.refundAmount).toBe(350);
      expect(result.nonRefundableAmount).toBe(150);
      expect(result.refundStatus).toBe('completed');
    });

    it('refunds 100% of advance paid on owner cancellation for ADVANCE payment', () => {
      const booking = {
        paymentStatus: 'partially_paid',
        amount: 2000,
        paidAmount: 535.40,
        convenienceFee: 30,
        gstAmount: 5.40,
        isOwnerCancel: true,
      };

      const result = calculateRefund(booking);
      expect(result.refundPct).toBe(100);
      expect(result.refundAmount).toBe(500);
      expect(result.nonRefundableAmount).toBe(0);
    });

    it('correctly handles legacy uppercase PAID booking with fallback to booking.amount', () => {
      const booking = {
        paymentStatus: 'PAID',
        amount: 800,
        // No paidAmount, convenienceFee, or gstAmount stored on legacy record
        refundPercentage: 70,
        isOwnerCancel: false,
      };

      const result = calculateRefund(booking);
      // 70% of 800 = 560
      expect(result.refundAmount).toBe(560);
      expect(result.nonRefundableAmount).toBe(240);
      expect(result.refundStatus).toBe('completed');
    });

    it('returns ₹0 refund for pay_at_shop or pending bookings', () => {
      const payAtShopBooking = {
        paymentStatus: 'pay_at_shop',
        amount: 1000,
        isOwnerCancel: false,
      };
      expect(calculateRefund(payAtShopBooking)).toEqual({
        refundAmount: 0,
        nonRefundableAmount: 0,
        refundStatus: 'none',
        refundPct: 70,
      });

      const legacyPayAtShop = {
        paymentStatus: 'PAY_AT_SHOP',
        amount: 1000,
        isOwnerCancel: true,
      };
      expect(calculateRefund(legacyPayAtShop)).toEqual({
        refundAmount: 0,
        nonRefundableAmount: 0,
        refundStatus: 'none',
        refundPct: 100,
      });
    });
  });

  describe('Cryptographic Payment Signatures & Verification', () => {
    it('generates and verifies valid order and payment signatures', () => {
      const orderId = 'order_test_123';
      const paymentId = 'pay_test_456';
      const amount = 1035.40;

      const signature = makePaymentSignature(orderId, paymentId, amount);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA-256 hex string

      const isValid = verifyPaymentSignature(orderId, paymentId, amount, signature);
      expect(isValid).toBe(true);
    });

    it('rejects tampered amount', () => {
      const orderId = 'order_test_123';
      const paymentId = 'pay_test_456';
      const originalAmount = 1035.40;
      const tamperedAmount = 500.00;

      const signature = makePaymentSignature(orderId, paymentId, originalAmount);
      const isValid = verifyPaymentSignature(orderId, paymentId, tamperedAmount, signature);
      expect(isValid).toBe(false);
    });

    it('rejects tampered orderId or paymentId', () => {
      const orderId = 'order_test_123';
      const paymentId = 'pay_test_456';
      const amount = 435.40;

      const signature = makePaymentSignature(orderId, paymentId, amount);
      expect(verifyPaymentSignature('order_forged', paymentId, amount, signature)).toBe(false);
      expect(verifyPaymentSignature(orderId, 'pay_forged', amount, signature)).toBe(false);
    });
  });
});
