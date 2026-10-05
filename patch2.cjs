const fs = require('fs');
const file = 'server/routes.ts';
let data = fs.readFileSync(file, 'utf8');

const oldStr = `  // 1. Find schedule configuration for this resource or default schedule
  const schedules = salon.turfSchedule || [];
  const resourceSchedule =
    schedules.find((s) => s.resourceId === activeResourceId) ||
    schedules.find((s) => s.resourceId === 'default' || !s.resourceId) ||
    schedules[0];`;

const newStr = `  // 1. Find schedule configuration for this resource or default schedule
  const schedules = salon.turfSchedule || [];
  let resourceSchedule = schedules.find((s) => {
    if (s.validFrom && queryDate < s.validFrom) return false;
    if (s.validTo && queryDate > s.validTo) return false;
    return s.resourceId === activeResourceId;
  });

  if (!resourceSchedule) {
    resourceSchedule =
      schedules.find((s) => s.resourceId === activeResourceId && !s.validFrom && !s.validTo) ||
      schedules.find((s) => (s.resourceId === 'default' || !s.resourceId) && !s.validFrom && !s.validTo) ||
      schedules[0];
  }`;

if (data.includes(oldStr)) {
  data = data.replace(oldStr, newStr);
  fs.writeFileSync(file, data);
  console.log('Successfully patched calculateTurfSlotsForDate');
} else {
  // try regex
  const regex = /  \/\/ 1\. Find schedule configuration[\s\S]*?schedules\[0\];/;
  if (regex.test(data)) {
    data = data.replace(regex, newStr);
    fs.writeFileSync(file, data);
    console.log('Successfully patched calculateTurfSlotsForDate via regex');
  } else {
    console.log('Search string not found in routes.ts');
  }
}
