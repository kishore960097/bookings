import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue?.path?.join('.') || 'body';
      const message = firstIssue?.message || 'Invalid input data';
      return res.status(400).json({
        success: false,
        error: `Validation error on ${fieldPath}: ${message}`,
        code: 'VALIDATION_ERROR',
      });
    }
    // Replace req.body with parsed/sanitized data (strips unknown fields)
    req.body = result.data;
    next();
  };
}

// Schemas
export const otpRequestSchema = z.object({
  phone: z.string().trim().min(10).max(18).regex(/^(?:\+?[1-9]\d{9,14}|[6-9]\d{9})$/, 'Invalid phone number format'),
}).strict();

export const otpVerifySchema = z.object({
  phone: z.string().trim().min(10).max(18),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  name: z.string().trim().min(2).max(50).regex(/^[a-zA-Z\s.\-']+$/, 'Name contains invalid characters').optional(),
  role: z.enum(['consumer', 'customer', 'owner']).optional(),
}).strict();

export const bookingCreationSchema = z.object({
  salonId: z.string().trim().min(1).max(100),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().min(10).max(18),
  serviceId: z.string().trim().max(100).optional(),
  staffId: z.string().trim().max(100).optional(),
  resourceId: z.string().trim().max(100).optional(),
  mode: z.enum(['appointment', 'token']).default('appointment'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  scheduledTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  slotEndTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'End time must be in HH:MM format').optional(),
  numberOfPlayers: z.number().int().min(1).max(50).optional(),
  notes: z.string().trim().max(500).optional(),
  paymentType: z.enum(['ADVANCE', 'FULL', 'pay_at_shop']).default('pay_at_shop'),
  advanceAmount: z.number().nonnegative().optional(),
  manualBooking: z.boolean().optional(),
}).passthrough(); // allows internal fields checked manually

export const reviewCreationSchema = z.object({
  salonId: z.string().trim().min(1),
  bookingId: z.string().trim().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
}).passthrough();

export const supportTicketSchema = z.object({
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().min(3).max(2000).optional(),
  message: z.string().trim().min(3).max(2000).optional(),
  attachmentUrl: z.string().trim().max(500).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
}).passthrough();
