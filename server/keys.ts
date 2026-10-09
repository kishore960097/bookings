export function buildQueueKey(salonId: string, date: string): string {
  if (!salonId || !date) throw new Error('Invalid queue key parameters');
  return `${salonId}:${date}`;
}

export function buildSlotKey(salonId: string, staffId: string, date: string, time: string): string {
  if (!salonId || !staffId || !date || !time) throw new Error('Invalid slot key parameters');
  return `${salonId}:${staffId}:${date}:${time}`;
}
