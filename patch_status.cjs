const fs = require('fs');
const file = 'server/routes.ts';
let data = fs.readFileSync(file, 'utf8');

const regex = /const isBooked = Boolean\(matchingBooking\) \|\| db\.isSlotLocked\(salon\.id, activeResourceId, queryDate, slotItem\.startTime\);\s*const isBlocked = slotItem\.status === 'blocked' \|\| disabledSlots\.includes\(slotItem\.startTime\);\s*const available = !isPast && !isBooked && !isBlocked;\s*const status = isBooked \? 'booked' : \(isBlocked \? 'blocked' : \(available \? 'available' : 'disabled'\)\);/g;

const replacement = `const isBooked = Boolean(matchingBooking) || db.isSlotLocked(salon.id, activeResourceId, queryDate, slotItem.startTime);
      const isBlocked = slotItem.status === 'blocked' || disabledSlots.includes(slotItem.startTime);
      const available = !isPast && !isBooked && !isBlocked;
      
      let status = isBooked ? 'booked' : (isBlocked ? 'blocked' : (available ? 'available' : 'disabled'));
      
      const isPastDate = queryDate < new Date().toISOString().split('T')[0];
      const isPastSlot = isPastDate || isPast;
      
      if (matchingBooking && (matchingBooking.status === 'completed' || isPastSlot)) {
        status = 'completed';
      } else if (isPastSlot && !isBooked) {
        status = 'closed';
      }`;

if (regex.test(data)) {
  data = data.replace(regex, replacement);
  fs.writeFileSync(file, data);
  console.log('Successfully patched slots status!');
} else {
  console.log('Regex not found!');
}
