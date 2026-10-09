const fs = require('fs');

let content = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');

// Replacements
content = content.replace(/Array\.from\(db\.(\w+)\.values\(\)\)/g, 'await db.$1.values()');
content = content.replace(/Array\.from\(db\.(\w+)\.entries\(\)\)/g, 'await db.$1.entries()');
content = content.replace(/db\.(\w+)\.get\(/g, 'await db.$1.get(');
content = content.replace(/db\.(\w+)\.set\(/g, 'await db.$1.set(');
content = content.replace(/db\.(\w+)\.delete\(/g, 'await db.$1.delete(');
content = content.replace(/db\.(\w+)\.clear\(\)/g, 'await db.$1.clear()');

// We also need to fix places where these might be called inside non-async functions!
// This is trickier. Let's find all non-async functions that now have await.

fs.writeFileSync('c:/projects/QGo/server/routes.ts.refactored', content);
console.log('Refactored');
