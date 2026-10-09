const fs = require('fs');

// Fix db.ts duplicate functions
let db = fs.readFileSync('c:/projects/QGo/server/db.ts', 'utf8');
const lines = db.split('\n');
let newLines = [];
let seenFuncs = new Set();
let skip = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('public recalculateQueueStats(') || line.includes('public isSlotLocked(') || line.includes('public getNextTokenNumber(') || line.includes('public getAnalytics(')) {
    const funcName = line.match(/public (\w+)\(/)[1];
    if (seenFuncs.has(funcName)) {
      skip = true;
    } else {
      seenFuncs.add(funcName);
      skip = false;
    }
  }
  if (!skip) {
    newLines.push(line);
  } else {
    // skip until closing brace
    if (line.trim() === '}') {
      skip = false;
    }
  }
}
fs.writeFileSync('c:/projects/QGo/server/db.ts', newLines.join('\n'));

// Fix routes.ts releaseSlotLock calls
let r = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');
r = r.replace(/db\.releaseSlotLock\(([^,]+), ([^,]+), ([^,]+), ([^)]+)\)/g, 'db.releaseSlotLock($1, $2, $3, $4, undefined)');
fs.writeFileSync('c:/projects/QGo/server/routes.ts', r);

console.log('Fixed duplicates and remaining TS errors');
