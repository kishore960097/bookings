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
