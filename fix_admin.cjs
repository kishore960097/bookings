const fs = require('fs');
let content = fs.readFileSync('server/routes.ts', 'utf8');

// replace .createdAt.slice with .createdAt?.slice
content = content.replace(/\.createdAt\.slice/g, '.createdAt?.slice');

// replace localeCompare
content = content.replace(/b\.createdAt\.localeCompare\(a\.createdAt\)/g, '(b.createdAt || "").localeCompare(a.createdAt || "")');
content = content.replace(/b\.timestamp\.localeCompare\(a\.timestamp\)/g, '(b.timestamp || "").localeCompare(a.timestamp || "")');

fs.writeFileSync('server/routes.ts', content);
