const fs = require('fs');
const content = fs.readFileSync('c:/projects/QGo/server/db.ts', 'utf8');

// Methods I missed:
// recalculateQueueStats
// isSlotLocked
// getNextTokenNumber
// getAnalytics

const getMethodStr = (name) => {
  const start = content.indexOf(`  public ${name}`);
  if (start === -1) return '';
  let braces = 0;
  let i = start;
  while(i < content.length) {
    if (content[i] === '{') braces++;
    if (content[i] === '}') {
      braces--;
      if (braces === 0) return content.slice(start, i + 1);
    }
    i++;
  }
  return '';
}

fs.writeFileSync('c:/projects/QGo/missing_methods.txt', 
  getMethodStr('recalculateQueueStats') + '\n\n' +
  getMethodStr('isSlotLocked') + '\n\n' +
  getMethodStr('getNextTokenNumber') + '\n\n' +
  getMethodStr('getAnalytics')
);
console.log('Saved');
