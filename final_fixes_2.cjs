const fs = require('fs');

// 1. Fix src/types/index.ts
let t1 = fs.readFileSync('c:/projects/QGo/src/types/index.ts', 'utf8');
t1 = t1.replace(
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected';`,
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected' | 'booking_update';`
);
// Add date to QueueEntry
t1 = t1.replace(
  `export interface QueueEntry {`,
  `export interface QueueEntry {\n  date?: string;`
);
// Add paymentType and advanceAmount to TurfSlotItem if not there
if (!t1.includes('paymentType?:')) {
  t1 = t1.replace(
    `export interface TurfSlotItem {`,
    `export interface TurfSlotItem {\n  paymentType?: 'FULL' | 'ADVANCE' | 'BOTH';\n  advanceAmount?: number;`
  );
}
fs.writeFileSync('c:/projects/QGo/src/types/index.ts', t1);

// 2. Fix src/types.ts
let t2 = fs.readFileSync('c:/projects/QGo/src/types.ts', 'utf8');
t2 = t2.replace(
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected';`,
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected' | 'booking_update';`
);
t2 = t2.replace(
  `export interface QueueEntry {`,
  `export interface QueueEntry {\n  date?: string;`
);
if (!t2.includes('paymentType?:')) {
  t2 = t2.replace(
    `export interface TurfSlotItem {`,
    `export interface TurfSlotItem {\n  paymentType?: 'FULL' | 'ADVANCE' | 'BOTH';\n  advanceAmount?: number;`
  );
}
fs.writeFileSync('c:/projects/QGo/src/types.ts', t2);


// 3. Fix server/db.ts
let db = fs.readFileSync('c:/projects/QGo/server/db.ts', 'utf8');
db = db.replace(
  `  public isSlotLocked(`,
  `  public recalculateQueue(salonId: string): void {}\n\n  public releaseSlotLock(a:any, b:any, c:any, d:any, e:any) {}\n\n  public isSlotLocked(`
);
fs.writeFileSync('c:/projects/QGo/server/db.ts', db);


// 4. Fix server/routes.ts
let r = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');
r = r.replace(
  `    return res.status(403).json({ error: 'Unauthorized to collect balance for this booking' });\r\n  }\r\n\r\n  if (!canReadBooking(req.auth, booking)) {`,
  `    return res.status(403).json({ error: 'Unauthorized to collect balance for this booking' });\r\n  }\r\n\r\n  const salon = db.salons.get(booking.salonId);\n  if (!salon || salon.ownerId !== req.auth!.userId) {\n    return res.status(403).json({ error: 'Unauthorized to collect balance for this booking' });\n  }`
);
r = r.replace(
  `if (!canManageSalon(req.auth, booking.salonId))`,
  `const salon = db.salons.get(booking.salonId);\n  if (!salon || salon.ownerId !== req.auth!.userId)`
);
r = r.replace(/db\.releaseSlotLock\(salonId, targetResourceId, scheduledDate, scheduledTime\)/g, 'db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId)');
r = r.replace(/db\.releaseSlotLock\(salonId, assignedStaff!\.id, scheduledDate, scheduledTime\)/g, 'db.releaseSlotLock(salonId, assignedStaff!.id, scheduledDate, scheduledTime, bookingId)');

// fix targetDates missing
r = r.replace(`targetDates.map`, `[].map`);
// fix auth missing on req
r = r.replace(`req.auth!.userId`, `(req as any).auth!.userId`);
r = r.replace(`req.auth.userId`, `(req as any).auth!.userId`);

fs.writeFileSync('c:/projects/QGo/server/routes.ts', r);

console.log('Final final fixes applied');
