const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/Admin/.gemini/antigravity-ide/brain/e8cb8840-095d-472a-88a4-c5cdb7f4a600/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let maxLen = 0;
  let bestStr = '';

  for await (const line of rl) {
    if (line.includes('FirestoreBackedMap') && line.includes('CodeContent')) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          for(let tc of obj.tool_calls) {
             const args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
             if (args.CodeContent && args.CodeContent.length > maxLen) {
                maxLen = args.CodeContent.length;
                bestStr = args.CodeContent;
             }
          }
        }
      } catch(e) {
         // try extracting it with regex if JSON parse fails
         const match = line.match(/"CodeContent":"(.*?)","Description"/);
         if (match) {
             try {
                const unescaped = JSON.parse('"' + match[1] + '"');
                if (unescaped.length > maxLen) {
                   maxLen = unescaped.length;
                   bestStr = unescaped;
                }
             } catch(e2) {}
         }
      }
    }
  }

  if (bestStr) {
    fs.writeFileSync('c:/projects/QGo/server/db.ts', bestStr);
    console.log('Restored db.ts! Length:', maxLen);
  } else {
    console.log('Could not find db.ts');
  }
}

processLineByLine();
