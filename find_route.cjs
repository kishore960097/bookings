const fs = require('fs');
const lines = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes("post('/bookings'") || l.includes("post('/bookings',")) {
    console.log(`Line ${i + 1}: ${l}`);
  }
});
