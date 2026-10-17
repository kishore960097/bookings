const fs = require('fs');
const path = './server/routes.ts';
let c = fs.readFileSync(path, 'utf8');

const oldCode = `    const bookingId = \`bk_turf_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;

    // 1. STRICT ATOMIC LOCK FOR DOUBLE BOOKING PROTECTION
    const lockAcquired = db.tryAcquireSlotLock(
      salonId,
      targetResourceId,
      scheduledDate,
      scheduledTime,
      bookingId
    );

    if (!lockAcquired) {
      return res.status(409).json({
        error: 'This turf slot was just booked by another customer. Please choose another time or turf.',
        slotTaken: true,
      });
    }

    // 2. RE-VERIFY NO OVERLAPPING BOOKING EXISTS FOR THIS SPECIFIC TURF
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.salonId !== salonId || b.scheduledDate !== scheduledDate) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      if (b.resourceId && b.resourceId !== targetResourceId) return false;

      const reqStart = timeToMinutes(scheduledTime);
      const reqEnd = slotEndTime ? timeToMinutes(slotEndTime) : reqStart + 60;
      const bStart = timeToMinutes(b.scheduledTime || '00:00');
      const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || 60);

      return reqStart < bEnd && reqEnd > bStart;
    });

    if (existingConflict) {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
      return res.status(409).json({
        error: \`This time slot for \${targetResourceName} is already booked. Please choose another slot.\`,
        slotTaken: true,
      });
    }

    // 3. Read the configured slot from the server-side availability engine.
    const configuredSlot = calculateTurfSlotsForDate(salon, scheduledDate, targetResourceId).slots.find(
      (slot) => slot.resourceId === targetResourceId && slot.startTime === scheduledTime
    );
    if (!configuredSlot || !configuredSlot.available || configuredSlot.status !== 'available') {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
      return res.status(409).json({ error: 'This turf slot is unavailable. Refresh availability and choose another slot.', slotTaken: true });
    }
    if (slotEndTime && slotEndTime !== configuredSlot.endTime) {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
      return res.status(400).json({ error: 'The requested slot duration does not match the configured availability.' });
    }

    const startM = timeToMinutes(configuredSlot.startTime);
    const endM = timeToMinutes(configuredSlot.endTime);
    const durationMinutes = configuredSlot.durationMinutes;
    const finalPrice = configuredSlot.price;
    const acceptedPaymentType = configuredSlot.paymentType || 'BOTH';`;

const newCode = `    // 1. Read configured slots from the server-side availability engine BEFORE locking
    const allSlots = calculateTurfSlotsForDate(salon, scheduledDate, targetResourceId).slots;
    
    // Support multi-slot bookings (e.g., 08:00 to 10:00 spans two 60-min slots)
    const reqStartM = timeToMinutes(scheduledTime);
    const reqEndM = slotEndTime ? timeToMinutes(slotEndTime) : reqStartM + 60;
    
    const requestedSlots = allSlots.filter((slot) => {
      const sStart = timeToMinutes(slot.startTime);
      const sEnd = timeToMinutes(slot.endTime) <= sStart ? timeToMinutes(slot.endTime) + 1440 : timeToMinutes(slot.endTime);
      const rEnd = reqEndM <= reqStartM ? reqEndM + 1440 : reqEndM;
      return sStart >= reqStartM && sEnd <= rEnd;
    });

    if (requestedSlots.length === 0) {
      return res.status(409).json({ error: 'This turf slot is unavailable. Refresh availability and choose another slot.', slotTaken: true });
    }

    const unavailableSlot = requestedSlots.find(s => !s.available || s.status !== 'available');
    if (unavailableSlot) {
      return res.status(409).json({ error: 'One or more selected slots are unavailable. Refresh availability and choose another time.', slotTaken: true });
    }

    const totalDuration = requestedSlots.reduce((acc, slot) => acc + slot.durationMinutes, 0);
    const expectedDuration = (reqEndM <= reqStartM ? reqEndM + 1440 : reqEndM) - reqStartM;
    if (totalDuration !== expectedDuration) {
      return res.status(400).json({ error: 'The requested slot duration does not perfectly match the configured availability blocks.' });
    }

    const bookingId = \`bk_turf_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;

    // 2. STRICT ATOMIC LOCK FOR DOUBLE BOOKING PROTECTION
    const lockAcquired = db.tryAcquireSlotLock(
      salonId,
      targetResourceId,
      scheduledDate,
      scheduledTime,
      bookingId
    );

    if (!lockAcquired) {
      return res.status(409).json({
        error: 'This turf slot was just booked by another customer. Please choose another time or turf.',
        slotTaken: true,
      });
    }

    // 3. RE-VERIFY NO OVERLAPPING BOOKING EXISTS FOR THIS SPECIFIC TURF
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.salonId !== salonId || b.scheduledDate !== scheduledDate) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      if (b.resourceId && b.resourceId !== targetResourceId) return false;

      const reqStart = timeToMinutes(scheduledTime);
      const reqEnd = slotEndTime ? timeToMinutes(slotEndTime) : reqStart + 60;
      const bStart = timeToMinutes(b.scheduledTime || '00:00');
      const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || 60);

      const rE = reqEnd <= reqStart ? reqEnd + 1440 : reqEnd;
      const bE = bEnd <= bStart ? bEnd + 1440 : bEnd;

      return reqStart < bE && rE > bStart;
    });

    if (existingConflict) {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime, bookingId);
      return res.status(409).json({
        error: \`This time slot for \${targetResourceName} is already booked. Please choose another slot.\`,
        slotTaken: true,
      });
    }

    const startM = timeToMinutes(requestedSlots[0].startTime);
    const endM = timeToMinutes(requestedSlots[requestedSlots.length - 1].endTime);
    const durationMinutes = totalDuration;
    const finalPrice = requestedSlots.reduce((acc, slot) => acc + slot.price, 0);
    const acceptedPaymentType = requestedSlots[0].paymentType || 'BOTH';`;

if(c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  fs.writeFileSync(path, c);
  console.log("Success");
} else {
  console.log("Not found");
}
