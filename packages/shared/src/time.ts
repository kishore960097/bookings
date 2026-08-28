export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [rawHours, rawMinutes] = time.split(':').map(Number);
  const hours = Number.isFinite(rawHours) ? rawHours : 0;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function format12Hour(time: string): string {
  if (!time) return '';
  const [rawHours, rawMinutes] = time.split(':').map(Number);
  const hours = Number.isFinite(rawHours) ? rawHours : 0;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function isMinuteInInterval(minuteOfDay: number, startTime: string, endTime: string): boolean {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === endMinutes) {
    return true;
  }

  if (endMinutes > startMinutes) {
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }

  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}
