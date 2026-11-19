import { describe, it, expect } from 'vitest';
import {
  computeBreakdown,
  validateAdvanceAmount,
  normalizePaymentStatus,
  QGO_FEE,
  QGO_GST,
  QGO_CHARGES,
  MIN_ADVANCE,
} from '../src/utils/paymentBreakdown';

describe('Payment Breakdown Math', () => {
  it('correctly computes ADVANCE breakdown for slot 1000 + advance 400 with reconciled formula', () => {
    const result = computeBreakdown({
      slotTotal: 1000,
      advanceAmount: 400,
      mode: 'ADVANCE',
    });

    expect(result.slotTotal).toBe(1000);
    expect(result.qgoFee).toBe(30);
    expect(result.gst).toBe(5.4);
    expect(result.payNow).toBe(435.4);
    expect(result.slotCredit).toBe(400);
    expect(result.balanceAtVenue).toBe(600);

    // Invariant check: payNow - qgoFee - gst + balanceAtVenue === slotTotal
    expect(Math.round(result.payNow - result.qgoFee - result.gst + result.balanceAtVenue)).toBe(1000);
  });

  it('correctly computes ADVANCE breakdown for slot 600 + advance 400', () => {
    const result = computeBreakdown({
      slotTotal: 600,
      advanceAmount: 400,
      mode: 'ADVANCE',
    });

    expect(result.slotTotal).toBe(600);
    expect(result.qgoFee).toBe(30);
    expect(result.gst).toBe(5.4);
    expect(result.payNow).toBe(435.4);
    expect(result.slotCredit).toBe(400);
    expect(result.balanceAtVenue).toBe(200);

    expect(Math.round(result.payNow - result.qgoFee - result.gst + result.balanceAtVenue)).toBe(600);
  });

  it('correctly computes FULL breakdown for slot 1000', () => {
    const result = computeBreakdown({
      slotTotal: 1000,
      mode: 'FULL',
    });

    expect(result.slotTotal).toBe(1000);
    expect(result.qgoFee).toBe(30);
    expect(result.gst).toBe(5.4);
    expect(result.payNow).toBe(1035.4);
    expect(result.slotCredit).toBe(1000);
    expect(result.balanceAtVenue).toBe(0);

    expect(Math.round(result.payNow - result.qgoFee - result.gst + result.balanceAtVenue)).toBe(1000);
  });

  it('correctly handles multi-slot totals with fee charged once', () => {
    // 2 slots: 1000 + 800 = 1800; advances 400 + 400 = 800
    const result = computeBreakdown({
      slotTotal: 1800,
      advanceAmount: 800,
      mode: 'ADVANCE',
    });

    expect(result.slotTotal).toBe(1800);
    expect(result.payNow).toBe(835.4);
    expect(result.slotCredit).toBe(800);
    expect(result.balanceAtVenue).toBe(1000);

    expect(Math.round(result.payNow - result.qgoFee - result.gst + result.balanceAtVenue)).toBe(1800);
  });

  it('validates advance amount constraints', () => {
    expect(validateAdvanceAmount(400, 1000)).toBeNull();
    expect(validateAdvanceAmount(50, 1000)).toContain('must be at least ₹100');
    expect(validateAdvanceAmount(1200, 1000)).toContain('cannot exceed slot price');
    expect(validateAdvanceAmount(undefined, 1000)).toContain('is required');
  });

  it('normalizes legacy and mixed-case payment statuses properly', () => {
    expect(normalizePaymentStatus('PAID')).toBe('paid');
    expect(normalizePaymentStatus('paid')).toBe('paid');
    expect(normalizePaymentStatus('FULLY_PAID')).toBe('paid');
    expect(normalizePaymentStatus('PARTIALLY_PAID')).toBe('partially_paid');
    expect(normalizePaymentStatus('partially_paid')).toBe('partially_paid');
    expect(normalizePaymentStatus('PAY_AT_SHOP')).toBe('pay_at_shop');
    expect(normalizePaymentStatus('pay_at_shop')).toBe('pay_at_shop');
    expect(normalizePaymentStatus('pending')).toBe('pending');
    expect(normalizePaymentStatus('refunded')).toBe('refunded');
    expect(normalizePaymentStatus(undefined)).toBe('pay_at_shop');
    expect(normalizePaymentStatus(null)).toBe('pay_at_shop');
  });
});
