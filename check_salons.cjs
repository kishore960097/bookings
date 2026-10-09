const fs = require('fs');
const lines = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes("post('/salons',"));
if (start !== -1) {
  console.log(lines.slice(start, start + 40).join('\n'));
}
