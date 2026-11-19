import { describe, it, expect } from 'vitest';
import {
  otpRequestSchema,
  otpVerifySchema,
  bookingCreationSchema,
} from '../server/middleware/validation';
import { getSessionSecret } from '../server/config';
import crypto from 'crypto';

describe('Security Hardening Validations', () => {
  describe('Zod Input Validation Schemas', () => {
    it('validates and accepts valid phone numbers for OTP', () => {
      const valid = otpRequestSchema.safeParse({ phone: '+919876543210' });
      expect(valid.success).toBe(true);

      const valid10 = otpRequestSchema.safeParse({ phone: '9876543210' });
      expect(valid10.success).toBe(true);
    });

    it('rejects invalid or injection phone strings', () => {
      const invalid = otpRequestSchema.safeParse({ phone: 'phone12345<script>' });
      expect(invalid.success).toBe(false);

      const tooShort = otpRequestSchema.safeParse({ phone: '123' });
      expect(tooShort.success).toBe(false);
    });

    it('validates 6-digit OTP strictly', () => {
      const validOtp = otpVerifySchema.safeParse({ phone: '9876543210', otp: '123456' });
      expect(validOtp.success).toBe(true);

      const nonDigit = otpVerifySchema.safeParse({ phone: '9876543210', otp: '12345a' });
      expect(nonDigit.success).toBe(false);

      const fiveDigits = otpVerifySchema.safeParse({ phone: '9876543210', otp: '12345' });
      expect(fiveDigits.success).toBe(false);
    });

    it('rejects unauthorized mass-assignment fields in strict schemas', () => {
      const extraField = otpRequestSchema.safeParse({ phone: '9876543210', role: 'admin' });
      expect(extraField.success).toBe(false);
    });
  });

  describe('Session Secret Fail-Fast Config', () => {
    it('throws error when secret is too short', () => {
      const original = process.env.QGO_SESSION_SECRET;
      try {
        process.env.QGO_SESSION_SECRET = 'short';
        expect(() => getSessionSecret()).toThrow(/too short/i);
      } finally {
        process.env.QGO_SESSION_SECRET = original;
      }
    });

    it('throws error when secret is a known insecure default', () => {
      const original = process.env.QGO_SESSION_SECRET;
      try {
        process.env.QGO_SESSION_SECRET = 'change-me-min-32-chars-long-secret';
        expect(() => getSessionSecret()).toThrow(/insecure default/i);
      } finally {
        process.env.QGO_SESSION_SECRET = original;
      }
    });
  });

  describe('Timing-Safe HMAC Signature Verification', () => {
    function makeSig(bId: string, sId: string, qId: string, secret: string) {
      return crypto.createHmac('sha256', secret).update(`${bId}:${sId}:${qId}`).digest('hex');
    }

    it('verifies genuine signatures correctly', () => {
      const secret = 'test-secret-at-least-32-characters-long';
      const sig = makeSig('b1', 's1', 'q1', secret);
      const expected = makeSig('b1', 's1', 'q1', secret);

      const bufA = Buffer.from(sig, 'utf8');
      const bufB = Buffer.from(expected, 'utf8');
      expect(bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)).toBe(true);
    });

    it('rejects forged or tampered signatures', () => {
      const secret = 'test-secret-at-least-32-characters-long';
      const sig = makeSig('b1', 's1', 'q1', secret);
      const forged = 'a'.repeat(64);

      const bufA = Buffer.from(forged, 'utf8');
      const bufB = Buffer.from(sig, 'utf8');
      expect(bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)).toBe(false);
    });
  });

  describe('Security Headers & Google Auth Compliance', () => {
    it('sets Cross-Origin-Opener-Policy to same-origin-allow-popups for Google Sign-In popup support', async () => {
      const { helmetMiddleware } = await import('../server/middleware/security');
      const headers: Record<string, string> = {};
      const mockReq: any = { headers: {} };
      const mockRes: any = {
        setHeader(key: string, val: string) {
          headers[key.toLowerCase()] = String(val);
        },
        getHeader(key: string) {
          return headers[key.toLowerCase()];
        },
        removeHeader(key: string) {
          delete headers[key.toLowerCase()];
        },
      };

      helmetMiddleware(mockReq, mockRes, () => {});

      expect(headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
      const csp = headers['content-security-policy'] || headers['content-security-policy-report-only'];
      expect(csp).toBeDefined();
      expect(csp).toContain('apis.google.com');
      expect(csp).toContain('accounts.google.com');
      expect(csp).toContain('firestore.googleapis.com');
      expect(csp).toContain('media-src');
    });
  });
});

