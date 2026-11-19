import crypto from 'crypto';
import { getSessionSecret } from '../config';

export type CanonicalPaymentStatus = 'paid' | 'partially_paid' | 'pay_at_shop' | 'pending' | 'refunded';

/**
 * Normalizes any legacy or new payment status value to canonical lowercase representation.
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

/**
 * Creates an HMAC signature for an initiated payment order.
 */
export function makeOrderSignature(orderId: string, amount: number, salonId: string): string {
  const secret = getSessionSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}:${amount.toFixed(2)}:${salonId}`)
    .digest('hex');
}

/**
 * Creates an HMAC signature confirming a completed gateway payment.
 */
export function makePaymentSignature(orderId: string, paymentId: string, amount: number): string {
  const secret = process.env.RAZORPAY_KEY_SECRET || getSessionSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}:${paymentId}:${amount.toFixed(2)}`)
    .digest('hex');
}

/**
 * Cryptographically verifies that a payment signature matches the order and expected amount.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  amount: number,
  providedSignature: string
): boolean {
  if (!orderId || !paymentId || !providedSignature || typeof providedSignature !== 'string') {
    return false;
  }

  // Check QGo platform HMAC signature
  const expectedPlatformSig = makePaymentSignature(orderId, paymentId, amount);
  if (
    providedSignature.length === expectedPlatformSig.length &&
    crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedPlatformSig))
  ) {
    return true;
  }

  // Check Razorpay standard HMAC signature if configured: HMAC_SHA256(order_id + "|" + payment_id, secret)
  const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
  if (rzpSecret) {
    const expectedRzpSig = crypto
      .createHmac('sha256', rzpSecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    if (
      providedSignature.length === expectedRzpSig.length &&
      crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedRzpSig))
    ) {
      return true;
    }
  }

  return false;
}
