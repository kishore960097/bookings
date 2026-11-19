import { describe, it, expect } from 'vitest';
import { getTicketFileName, TICKET_CAPTURE_OPTIONS } from '../src/features/customer/utils/ticketDownload';

describe('Ticket Capture & Download Utilities', () => {
  it('formats ticket filename correctly with booking ID', () => {
    expect(getTicketFileName('bk_12345')).toBe('qgo-ticket-bk_12345.png');
    expect(getTicketFileName('QGO-9988')).toBe('qgo-ticket-QGO-9988.png');
    expect(getTicketFileName('b_abc-123')).toBe('qgo-ticket-b_abc-123.png');
  });

  it('sanitizes unsafe characters in booking ID for filename', () => {
    expect(getTicketFileName('booking/123?test')).toBe('qgo-ticket-booking_123_test.png');
    expect(getTicketFileName('')).toBe('qgo-ticket-ticket.png');
    expect(getTicketFileName(null)).toBe('qgo-ticket-ticket.png');
    expect(getTicketFileName(undefined)).toBe('qgo-ticket-ticket.png');
  });

  it('defines correct high-res capture options without transparency', () => {
    expect(TICKET_CAPTURE_OPTIONS.pixelRatio).toBe(2);
    expect(TICKET_CAPTURE_OPTIONS.backgroundColor).toBe('#FFFFFF');
    expect(TICKET_CAPTURE_OPTIONS.cacheBust).toBe(true);
  });
});
