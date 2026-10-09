const fs = require('fs');

const path = 'C:/Users/Admin/.gemini/antigravity-ide/brain/e8cb8840-095d-472a-88a4-c5cdb7f4a600/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let best = '';

for(let l of lines) {
  if (l.includes('db.ts') && l.includes('FirestoreBackedMap')) {
    try {
      const obj = JSON.parse(l);
      const args = obj.tool_calls?.[0]?.arguments;
      if (args) {
         let parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
         if (parsedArgs.CodeContent && parsedArgs.CodeContent.includes('FirestoreBackedMap')) {
             best = parsedArgs.CodeContent;
         }
      }
    } catch(e) {}
  }
}

if (best) {
  fs.writeFileSync('c:/projects/QGo/server/db.ts', best);
  console.log('Restored db.ts');
} else {
  console.log('Could not find db.ts');
}
