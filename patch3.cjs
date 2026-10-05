const fs = require('fs');
const file = 'server/routes.ts';
let data = fs.readFileSync(file, 'utf8');

const regex = /  if \(!resourceSchedule\) \{\s*resourceSchedule =[\s\S]*?schedules\[0\];\s*\}\s*const dateObj = new Date\(queryDate \+ 'T00:00:00Z'\);/;

const replacement = `  let isDefaultScheduleFallback = false;
  if (!resourceSchedule) {
    resourceSchedule =
      schedules.find((s) => s.resourceId === activeResourceId && !s.validFrom && !s.validTo) ||
      schedules.find((s) => (s.resourceId === 'default' || !s.resourceId) && !s.validFrom && !s.validTo) ||
      schedules[0];
    isDefaultScheduleFallback = true;
  }

  const dateObj = new Date(queryDate + 'T00:00:00Z');
  
  // Future Month Lock: If fallback to default schedule, ensure it's not a future month
  if (isDefaultScheduleFallback) {
    const today = new Date();
    const isFutureMonth = (dateObj.getUTCFullYear() > today.getFullYear()) || 
                          (dateObj.getUTCFullYear() === today.getFullYear() && dateObj.getUTCMonth() > today.getMonth());
    if (isFutureMonth) {
      return {
        isOpen: false,
        message: 'Not Yet Open',
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getUTCDay()],
        slots: [],
        resources
      };
    }
  }`;

if (regex.test(data)) {
  data = data.replace(regex, replacement);
  fs.writeFileSync(file, data);
  console.log('Successfully patched routes.ts via regex');
} else {
  console.log('Regex not found in routes.ts');
}
