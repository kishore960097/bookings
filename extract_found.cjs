const fs = require('fs');

const lines = fs.readFileSync('c:/projects/QGo/found.txt', 'utf8').split('\n');
let maxLen = 0;
let bestStr = '';

for(let l of lines) {
  try {
    const obj = JSON.parse(l);
    if (obj.tool_calls) {
       for(let tc of obj.tool_calls) {
          const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
          if (args.CodeContent && args.CodeContent.length > maxLen) {
             maxLen = args.CodeContent.length;
             bestStr = args.CodeContent;
          }
          if (args.ReplacementContent && args.ReplacementContent.length > maxLen) {
             maxLen = args.ReplacementContent.length;
             bestStr = args.ReplacementContent;
          }
       }
    }
  } catch(e) {}
}

if (bestStr) {
  fs.writeFileSync('c:/projects/QGo/server/db.ts', bestStr);
  console.log('Restored db.ts! Length:', maxLen);
} else {
  console.log('Could not parse from found.txt');
}
