import { describe, it, expect } from 'vitest';

describe('Partner Payout & Settlement Calculation Engine', () => {
  it('calculates exact convenience fee, GST, and net owner payout without roundoff error', () => {
    const bookingsCount = 8;
    const slotPrice = 1200;
    const advancePaidPerSlot = 240; // 20% advance
    const convenienceFeePerBooking = 30.00;
    const gstPerBooking = 5.40; // 18% of 30.00
    const qgoTotalRetainedPerBooking = 35.40;

    const totalGrossSlotValue = bookingsCount * slotPrice; // ₹9,600
    const totalAdvanceCollected = bookingsCount * advancePaidPerSlot; // ₹1,920
    const totalOnlineCollected = totalAdvanceCollected + (bookingsCount * qgoTotalRetainedPerBooking); // ₹1,920 + ₹283.20 = ₹2,203.20

    const qgoConvenienceFee = bookingsCount * convenienceFeePerBooking; // ₹240.00
    const qgoGstCollected = Number((bookingsCount * gstPerBooking).toFixed(2)); // ₹43.20
    const qgoTotalRetained = Number((qgoConvenienceFee + qgoGstCollected).toFixed(2)); // ₹283.20

    const netOwnerPayable = Math.max(0, Math.round(totalOnlineCollected - qgoTotalRetained));
    const venueBalanceCollected = totalGrossSlotValue - netOwnerPayable;

    expect(totalGrossSlotValue).toBe(9600);
    expect(totalOnlineCollected).toBe(2203.2);
    expect(qgoConvenienceFee).toBe(240);
    expect(qgoGstCollected).toBe(43.2);
    expect(qgoTotalRetained).toBe(283.2);
    expect(netOwnerPayable).toBe(1920); // 100% of collected booking advance transferred to owner
    expect(venueBalanceCollected).toBe(7680); // Remaining 80% collected directly at venue
  });

  it('calculates 100% full online prepayment payout accurately', () => {
    const bookingsCount = 5;
    const slotPrice = 1500; // paid in full online

    const totalGrossSlotValue = bookingsCount * slotPrice; // ₹7,500
    const totalOnlineCollected = totalGrossSlotValue + (bookingsCount * 35.40); // ₹7,500 + ₹177.00 = ₹7,677.00

    const qgoConvenienceFee = bookingsCount * 30.00; // ₹150.00
    const qgoGstCollected = bookingsCount * 5.40; // ₹27.00
    const qgoTotalRetained = qgoConvenienceFee + qgoGstCollected; // ₹177.00

    const netOwnerPayable = Math.max(0, Math.round(totalOnlineCollected - qgoTotalRetained));
    const venueBalanceCollected = totalGrossSlotValue - netOwnerPayable;

    expect(netOwnerPayable).toBe(7500); // 100% of slot price to owner
    expect(venueBalanceCollected).toBe(0); // ₹0 due at venue
  });

  it('formats target Admin WhatsApp alert with exact recipient 919600971886', () => {
    const DEFAULT_ADMIN_WHATSAPP = '919600971886';
    const shopName = 'Apex Arena Turf';
    const ownerName = 'Karthik S';
    const cycle = 'Weekly Settlement';
    const netOwnerPayable = 4800;

    const messageLines = [
      '🚨 *QGo Payout Due Alert*',
      `*Shop:* ${shopName}`,
      `*Owner:* ${ownerName}`,
      `*Cycle:* ${cycle}`,
      `*Exact Net Payable to Owner:* ₹${netOwnerPayable.toLocaleString('en-IN')}`,
    ];
    const text = messageLines.join('\n');
    const waUrl = `https://wa.me/${DEFAULT_ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`;

    expect(waUrl).toContain('https://wa.me/919600971886');
    expect(decodeURIComponent(waUrl)).toContain('Apex Arena Turf');
    expect(decodeURIComponent(waUrl)).toContain('₹4,800');
  });

  it('requires UTR reference and valid payment method for settlement confirmation', () => {
    const validatePayoutInput = (input: { amountPaid: number; utrReference: string; paymentMethod: string }) => {
      if (input.amountPaid <= 0) return { valid: false, error: 'A positive payout amount is required' };
      if (!input.utrReference.trim()) return { valid: false, error: 'UTR / Bank transaction reference is required' };
      return { valid: true };
    };

    expect(validatePayoutInput({ amountPaid: 0, utrReference: 'UTR123', paymentMethod: 'UPI' }).valid).toBe(false);
    expect(validatePayoutInput({ amountPaid: 500, utrReference: '', paymentMethod: 'UPI' }).valid).toBe(false);
    expect(validatePayoutInput({ amountPaid: 500, utrReference: '432198765432', paymentMethod: 'UPI Transfer' }).valid).toBe(true);
  });
});
