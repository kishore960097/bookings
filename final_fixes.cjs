const fs = require('fs');

// 1. Fix src/types/index.ts (booking_update)
let t = fs.readFileSync('c:/projects/QGo/src/types/index.ts', 'utf8');
t = t.replace(
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected';`,
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected' | 'booking_update';`
);
fs.writeFileSync('c:/projects/QGo/src/types/index.ts', t);

// 2. Fix server.ts initializeAll
let s = fs.readFileSync('c:/projects/QGo/server.ts', 'utf8');
s = s.replace(`  await db.initializeAll();\n`, '');
fs.writeFileSync('c:/projects/QGo/server.ts', s);

// 3. Add initializeAll back to db.ts
let db = fs.readFileSync('c:/projects/QGo/server/db.ts', 'utf8');
if (!db.includes('initializeAll()')) {
  db = db.replace(
    `  public recalculateQueueStats`,
    `  async initializeAll() {\n    await Promise.all([\n      this.users.initialize(),\n      this.salons.initialize(),\n      this.services.initialize(),\n      this.staff.initialize(),\n      this.bookings.initialize(),\n      this.queueEntries.initialize(),\n      this.reviews.initialize(),\n      this.notifications.initialize(),\n      this.otpStore.initialize(),\n      this.authAccounts.initialize(),\n      this.userRoles.initialize(),\n    ]);\n  }\n\n  public recalculateQueueStats`
  );
  fs.writeFileSync('c:/projects/QGo/server/db.ts', db);
}

// 4. Fix routes.ts (service.price used before defined)
let r = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');
r = r.replace(
  `    if (paymentType === 'ADVANCE') {\r\n      if (!advanceAmount || advanceAmount <= 0) {\r\n        return res.status(400).json({ error: 'Invalid advance amount.' });\r\n      }\r\n      if (advanceAmount > service.price) {\r\n        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\r\n      }\r\n    }\r\n\r\n    const qrCodeId`,
  `    const qrCodeId`
);
r = r.replace(
  `    if (paymentType === 'ADVANCE') {\n      if (!advanceAmount || advanceAmount <= 0) {\n        return res.status(400).json({ error: 'Invalid advance amount.' });\n      }\n      if (advanceAmount > service.price) {\n        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\n      }\n    }\n\n    const qrCodeId`,
  `    const qrCodeId`
);

// Re-add it after `const service = db.services.get(serviceId);`
r = r.replace(
  `  const service = db.services.get(serviceId);\r\n  if (!service || service.salonId !== salonId || !service.isActive) {\r\n    return res.status(404).json({ error: 'Service not found' });\r\n  }`,
  `  const service = db.services.get(serviceId);\r\n  if (!service || service.salonId !== salonId || !service.isActive) {\r\n    return res.status(404).json({ error: 'Service not found' });\r\n  }\r\n\r\n  if (paymentType === 'ADVANCE') {\r\n    if (!advanceAmount || advanceAmount <= 0) {\r\n      return res.status(400).json({ error: 'Invalid advance amount.' });\r\n    }\r\n    if (advanceAmount > service.price) {\r\n      return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\r\n    }\r\n  }`
);
r = r.replace(
  `  const service = db.services.get(serviceId);\n  if (!service || service.salonId !== salonId || !service.isActive) {\n    return res.status(404).json({ error: 'Service not found' });\n  }`,
  `  const service = db.services.get(serviceId);\n  if (!service || service.salonId !== salonId || !service.isActive) {\n    return res.status(404).json({ error: 'Service not found' });\n  }\n\n  if (paymentType === 'ADVANCE') {\n    if (!advanceAmount || advanceAmount <= 0) {\n      return res.status(400).json({ error: 'Invalid advance amount.' });\n    }\n    if (advanceAmount > service.price) {\n      return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\n    }\n  }`
);

fs.writeFileSync('c:/projects/QGo/server/routes.ts', r);

console.log('Final fixes applied');
