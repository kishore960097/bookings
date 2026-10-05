const fs = require('fs'); 
const data = fs.readFileSync('server/routes.ts', 'utf8'); 
const idx = data.indexOf("apiRouter.get('/notifications'"); 
const pre = data.substring(0, idx); 
const patch = `apiRouter.post('/salons/:id/unblock-date', requireAuth, (req, res) => {
  const { id } = req.params;
  const { dates } = req.body;
  if (!dates || !Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'No dates' });
  const salon = db.salons.get(id);
  if (!salon) return res.status(404).json({ error: 'Not found' });
  if (salon.holidays) salon.holidays = salon.holidays.filter(h => !dates.includes(h.date));
  if (salon.turfSchedule && salon.turfSchedule[0] && salon.turfSchedule[0].specialDates) salon.turfSchedule[0].specialDates = salon.turfSchedule[0].specialDates.filter(sd => !dates.includes(sd.date));
  return res.json({ success: true, message: 'unblocked' });
});\n\n`; 
const newContent = pre + patch + data.substring(idx); 
fs.writeFileSync('server/routes.ts', newContent);
