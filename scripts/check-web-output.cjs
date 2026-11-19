const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(process.cwd(), process.argv[2] || 'dist');

console.log(`[Guard] Inspecting web build output in: ${targetDir}`);

if (!fs.existsSync(targetDir)) {
  console.error(`[Guard Error] Output directory does not exist: ${targetDir}`);
  process.exit(1);
}

function findLeakedFiles(dir) {
  let violations = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(targetDir, fullPath);

    if (entry.isDirectory()) {
      violations = violations.concat(findLeakedFiles(fullPath));
    } else {
      const fileName = entry.name.toLowerCase();
      // Check for backend bundle
      if (fileName === 'server.cjs' || fileName === 'server.js' || (fileName.startsWith('server.') && (fileName.endsWith('.cjs') || fileName.endsWith('.js') || fileName.endsWith('.mjs')))) {
        violations.push({ file: relPath, reason: 'Backend server bundle must not be in web assets' });
      }
      // Check for sourcemaps
      else if (fileName.endsWith('.map')) {
        violations.push({ file: relPath, reason: 'Source map files (.map) must not be shipped in client build' });
      }
      // Check for .env files
      else if (fileName.startsWith('.env') || fileName.includes('.env.')) {
        violations.push({ file: relPath, reason: 'Environment configuration file (.env*) must never be in web assets' });
      }
      // Check for raw TypeScript source files
      else if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        violations.push({ file: relPath, reason: 'TypeScript source file (.ts/.tsx) must not be in web assets' });
      }
    }
  }

  return violations;
}

const violations = findLeakedFiles(targetDir);

if (violations.length > 0) {
  console.error('\n======================================================');
  console.error('[GUARD ERROR] SECURITY LEAK DETECTED IN WEB OUTPUT!');
  console.error('The following files must NOT be shipped to client/Android assets:');
  violations.forEach((v) => {
    console.error(`  - ${v.file}: ${v.reason}`);
  });
  console.error('======================================================\n');
  process.exit(1);
}

console.log('[Guard] Verification PASSED: Web output is clean (no server bundle, sourcemaps, env, or TypeScript files).');
process.exit(0);
