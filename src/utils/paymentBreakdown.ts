/**
 * Single source of truth for payment breakdown math across customer UI, owner UI, and server.
 * All intermediate math is done in integer paise to avoid IEEE-754 floating point drift.
 */

export const QGO_FEE = 30;
export const GST_RATE = 0.18;
export const QGO_GST = 5.40;
export const QGO_CHARGES = 35.40;
export const MIN_ADVANCE = 100;

export const QGO_FEE_PAISE = 3000; // ₹30.00 in paise
export const QGO_GST_PAISE = 540;   // ₹5.40 in paise (18% of ₹30)
export const QGO_CHARGES_PAISE = 3540; // ₹35.40 in paise
export const MIN_ADVANCE_PAISE = 10000; // ₹100.00 in paise

export type CanonicalPaymentStatus = 'paid' | 'partially_paid' | 'pay_at_shop' | 'pending' | 'refunded';

/**
 * Normalizes any legacy or new payment status value to a canonical lowercase representation.
 */
export function normalizePaymentStatus(status?: string | null): CanonicalPaymentStatus {
  if (!status) return 'pay_at_shop';
  const clean = String(status).trim().toLowerCase();
  if (clean === 'paid' || clean === 'fully_paid') return 'paid';
  if (clean === 'partially_paid' || clean === 'partial') return 'partially_paid';
  if (clean === 'pay_at_shop' || clean === 'unpaid' || clean === 'cash') return 'pay_at_shop';
  if (clean === 'pending') return 'pending';
  if (clean === 'refunded') return 'refunded';
  return 'pay_at_shop';
}

export type PaymentBreakdownMode = 'ADVANCE' | 'FULL';

export interface PaymentBreakdownInput {
  slotTotal: number;
  advanceAmount?: number;
  mode: PaymentBreakdownMode;
}

export interface PaymentBreakdown {
  slotTotal: number;
  qgoFee: number;
  gst: number;
  payNow: number;
  slotCredit: number;
  balanceAtVenue: number;
}

/**
 * Computes exact payment breakdown for a booking.
 * 
 * In 'ADVANCE' mode:
 * - slotCredit: Net amount credited toward the slot (the configured advance amount).
 * - payNow: Total customer payment online = slotCredit + QGO_CHARGES (QGo convenience fee + GST).
 * - balanceAtVenue: Remaining amount customer pays at the venue = slotTotal - slotCredit.
 * 
 * In 'FULL' mode:
 * - slotCredit: Full slot total.
 * - payNow: slotTotal + QGO_CHARGES.
 * - balanceAtVenue: 0.
 * 
 * Invariant: payNow - qgoFee - gst + balanceAtVenue === slotTotal always holds.
 */
export function computeBreakdown({
  slotTotal,
  advanceAmount,
  mode,
}: PaymentBreakdownInput): PaymentBreakdown {
  const slotTotalPaise = Math.round(Number(slotTotal || 0) * 100);

  if (mode === 'FULL') {
    const payNowPaise = slotTotalPaise + QGO_CHARGES_PAISE;
    const slotCreditPaise = slotTotalPaise;
    const balanceAtVenuePaise = 0;

    return {
      slotTotal: Number((slotTotalPaise / 100).toFixed(2)),
      qgoFee: QGO_FEE,
      gst: QGO_GST,
      payNow: Number((payNowPaise / 100).toFixed(2)),
      slotCredit: Number((slotCreditPaise / 100).toFixed(2)),
      balanceAtVenue: Number((balanceAtVenuePaise / 100).toFixed(2)),
    };
  }

  // ADVANCE mode
  const advanceInputPaise = Math.round(Number(advanceAmount || 0) * 100);
  const slotCreditPaise = Math.min(slotTotalPaise, Math.max(0, advanceInputPaise));
  const payNowPaise = slotCreditPaise + QGO_CHARGES_PAISE;
  const balanceAtVenuePaise = Math.max(0, slotTotalPaise - slotCreditPaise);

  return {
    slotTotal: Number((slotTotalPaise / 100).toFixed(2)),
    qgoFee: QGO_FEE,
    gst: QGO_GST,
    payNow: Number((payNowPaise / 100).toFixed(2)),
    slotCredit: Number((slotCreditPaise / 100).toFixed(2)),
    balanceAtVenue: Number((balanceAtVenuePaise / 100).toFixed(2)),
  };
}

/**
 * Validates advance amount against slot price.
 * Returns null if valid, or an error string if invalid.
 */
export function validateAdvanceAmount(
  advance: number | undefined | null,
  slotPrice: number
): string | null {
  if (advance === undefined || advance === null || isNaN(advance)) {
    return 'Advance amount is required.';
  }
  if (advance < MIN_ADVANCE) {
    return `Advance must be at least ₹${MIN_ADVANCE}.`;
  }
  if (advance > slotPrice) {
    return `Advance cannot exceed slot price (₹${slotPrice}).`;
  }
  return null;
}
