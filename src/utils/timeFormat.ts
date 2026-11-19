export function formatTime12Hour(time24?: string | null): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const hourStr = parts[0];
  const minuteStr = parts[1];

  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'

  const hourFormatted = hour.toString().padStart(2, '0');

  return `${hourFormatted}:${minuteStr} ${ampm}`;
}

/** Short alias */
export const fmt12 = formatTime12Hour;

/**
 * Return current date string "YYYY-MM-DD" in Asia/Kolkata (IST, +05:30).
 */
export function getBusinessTodayStr(d: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Shift a "YYYY-MM-DD" date string by a given number of days.
 */
export function shiftDateStr(dateStr: string, days: number): string {
  if (days === 0) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const newY = dt.getUTCFullYear();
  const newM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const newD = String(dt.getUTCDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
}

/**
 * Format ISO string or Date to exact Indian Standard Time (IST): "DD MMM YYYY, hh:mm A"
 * e.g. "19 Nov 2026, 11:30 AM"
 */
export function formatDateTimeIST(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '-';
  try {
    const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(dt.getTime())) return '-';

    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return formatter.format(dt).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
  } catch {
    return '-';
  }
}

/**
 * Format ISO string or Date to IST Date: "DD MMM YYYY"
 * e.g. "19 Nov 2026"
 */
export function formatDateIST(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '-';
  try {
    const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(dt.getTime())) return '-';

    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return formatter.format(dt);
  } catch {
    return '-';
  }
}

/**
 * Sanitize customer name across bookings, tables, and reviews.
 * Purges legacy placeholder substrings (like "qgooox") and falls back cleanly
 * to the customer's email username or "Guest Customer" / "Guest Player".
 */
export function sanitizeCustomerName(
  name?: string | null,
  emailOrPhone?: string | null,
  fallback = 'Guest Customer'
): string {
  if (!name || typeof name !== 'string') {
    if (emailOrPhone && typeof emailOrPhone === 'string') {
      if (emailOrPhone.includes('@')) {
        const handle = emailOrPhone.split('@')[0];
        return handle.toLowerCase().includes('qgoo') ? fallback : handle;
      }
      return emailOrPhone;
    }
    return fallback;
  }

  // Remove any case-insensitive occurrences of "qgooox" or "qgooo"
  const cleaned = name.replace(/qgoo[a-z0-9_]*/gi, '').trim();
  if (!cleaned || cleaned.length < 2) {
    if (emailOrPhone && typeof emailOrPhone === 'string') {
      if (emailOrPhone.includes('@')) {
        const handle = emailOrPhone.split('@')[0];
        return handle.toLowerCase().includes('qgoo') ? fallback : handle;
      }
      return emailOrPhone;
    }
    return fallback;
  }

  return cleaned;
}
