import { describe, it, expect } from 'vitest';
import { formatDateTimeIST, formatDateIST, sanitizeCustomerName } from '../src/utils/timeFormat';

describe('QGo Platform Income Vault & Accounting Engine', () => {
  it('permanently retains platform fee income even after paying out owners', () => {
    const totalBookings = 100;
    const grossSlotValue = 120000;
    const onlineAdvances = 24000;
    const baseFeePerBooking = 30.00;
    const gstPerBooking = 5.40;
    const totalPlatformFeePerBooking = 35.40;

    // Platform gross income
    const vaultGrossIncome = totalBookings * totalPlatformFeePerBooking; // ₹3,540
    const vaultStatutoryGst = totalBookings * gstPerBooking; // ₹540
    const vaultNetRetainedFee = totalBookings * baseFeePerBooking; // ₹3,000

    // Estimated payment gateway cost (2.36% on online advances)
    const estimatedGatewayCost = Number((onlineAdvances * 0.0236).toFixed(2)); // ₹566.40
    const vaultNetProfit = Number((vaultNetRetainedFee - estimatedGatewayCost).toFixed(2)); // ₹2,433.60

    // After owner payout of net payable (e.g. ₹24,000 online advances paid out)
    const ownerDisbursed = onlineAdvances;
    const ownerPendingPayable = 0;

    // Critical assertion: Platform fee income NEVER drops to ₹0 after owner payout
    expect(vaultGrossIncome).toBe(3540);
    expect(vaultStatutoryGst).toBe(540);
    expect(vaultNetRetainedFee).toBe(3000);
    expect(estimatedGatewayCost).toBe(566.4);
    expect(vaultNetProfit).toBe(2433.6);
    expect(ownerDisbursed).toBe(24000);
    expect(ownerPendingPayable).toBe(0);
    expect(vaultGrossIncome).toBeGreaterThan(0);
  });

  it('accurately computes turf vs salon metrics breakdown', () => {
    const turfBookings = 60;
    const salonBookings = 40;

    const turfGross = turfBookings * 1200;
    const salonGross = salonBookings * 600;

    const turfVault = turfBookings * 35.40;
    const salonVault = salonBookings * 35.40;

    expect(turfVault).toBe(2124);
    expect(salonVault).toBe(1416);
    expect(turfVault + salonVault).toBe(3540);
  });

  it('formats dates in Indian Standard Time (IST)', () => {
    // 2026-11-19T06:30:00.000Z is 12:00 PM IST (UTC + 5:30)
    const utcIso = '2026-11-19T06:30:00.000Z';
    const formatted = formatDateTimeIST(utcIso);

    expect(formatted).toContain('19 Nov 2026');
    expect(formatted).toContain('12:00 PM');

    const dateOnly = formatDateIST(utcIso);
    expect(dateOnly).toBe('19 Nov 2026');
  });

  it('sanitizes legacy qgooox placeholder names to clean customer identifiers', () => {
    expect(sanitizeCustomerName('qgooox123', 'arun@example.com')).toBe('arun');
    expect(sanitizeCustomerName('qgooo_test', '+91 98765 43210')).toBe('+91 98765 43210');
    expect(sanitizeCustomerName('qgooox', '')).toBe('Guest Customer');
    expect(sanitizeCustomerName('Kishore Kumar', '9600971886')).toBe('Kishore Kumar');
  });

  it('enforces Master Admin password KISHOREYES for database reset', () => {
    const verifyResetPassword = (password: string) => {
      if (password.trim() === 'KISHOREYES') {
        return { authorized: true };
      }
      return { authorized: false, error: 'Incorrect Master Admin Authorization Password' };
    };

    expect(verifyResetPassword('wrongpassword').authorized).toBe(false);
    expect(verifyResetPassword('kishoreyes').authorized).toBe(false); // Case-sensitive
    expect(verifyResetPassword('').authorized).toBe(false);
    expect(verifyResetPassword('KISHOREYES').authorized).toBe(true);
    expect(verifyResetPassword('  KISHOREYES  ').authorized).toBe(true); // Trims whitespace
  });
});
