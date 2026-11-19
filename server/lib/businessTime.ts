/**
 * Business Time Helpers
 *
 * All business logic dates/times must use these helpers so the server
 * produces consistent results regardless of the host's own timezone.
 *
 * The canonical timezone offset is read from QGO_TZ_OFFSET env var
 * (default: "+05:30" for IST). Every function accepts an injectable
 * `now` (epoch-ms) for deterministic testing.
 */

/** Offset string, e.g. "+05:30" or "-04:00". */
export const BUSINESS_TZ_OFFSET: string =
  process.env.QGO_TZ_OFFSET || '+05:30';

/**
 * Parse the offset string into total minutes from UTC.
 * "+05:30" → +330, "-04:00" → −240.
 */
function parseOffset(offset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) throw new Error(`Invalid QGO_TZ_OFFSET: "${offset}"`);
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}

const offsetMinutes = parseOffset(BUSINESS_TZ_OFFSET);

/**
 * Return the current "YYYY-MM-DD" in business time.
 */
export function businessToday(now: number = Date.now()): string {
  // Shift the epoch by the offset, then extract UTC date parts.
  const shifted = new Date(now + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Return an absolute epoch-ms timestamp for a given date + "HH:mm" in
 * business time. This is the unambiguous instant that slot refers to.
 */
export function slotInstantMs(dateStr: string, time: string): number {
  // Build an ISO-like string with the explicit business offset.
  const iso = `${dateStr}T${time}:00${BUSINESS_TZ_OFFSET}`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid date/time: "${dateStr}" "${time}"`);
  }
  return ms;
}

/**
 * Current minute-of-day in business time (0–1439).
 */
export function businessMinutesOfDay(now: number = Date.now()): number {
  const shifted = new Date(now + offsetMinutes * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/**
 * Day-of-week in business time (0 = Sun … 6 = Sat).
 */
export function businessDayOfWeek(now: number = Date.now()): number {
  const shifted = new Date(now + offsetMinutes * 60_000);
  return shifted.getUTCDay();
}

/**
 * Day-of-month in business time.
 */
export function businessDayOfMonth(now: number = Date.now()): number {
  const shifted = new Date(now + offsetMinutes * 60_000);
  return shifted.getUTCDate();
}

/**
 * Shift a "YYYY-MM-DD" date string by a given number of days.
 */
export function shiftBusinessDate(dateStr: string, days: number): string {
  if (days === 0) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const newY = dt.getUTCFullYear();
  const newM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const newD = String(dt.getUTCDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
}
