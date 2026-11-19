#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('\n========================================');
console.log('   QGo Android APK Build System');
console.log('========================================\n');

// 1. Resolve current app version
let appVersion = '1.0.0';
try {
  const versionFile = path.resolve(__dirname, '../src/config/appVersion.ts');
  if (fs.existsSync(versionFile)) {
    const content = fs.readFileSync(versionFile, 'utf8');
    const match = content.match(/CURRENT_APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
      appVersion = match[1];
    }
  }
} catch {
  // Use fallback
}

console.log(`[QGo] Target Version: v${appVersion}`);

// 2. Locate Android directory and Gradle wrapper
const androidDir = path.resolve(__dirname, '../android');
if (!fs.existsSync(androidDir)) {
  console.error('[Error] android/ directory not found. Please run "npx cap add android" first.');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const gradleCmd = isWindows
  ? path.join(androidDir, 'gradlew.bat')
  : path.join(androidDir, 'gradlew');

if (!fs.existsSync(gradleCmd)) {
  console.error(`[Error] Gradle wrapper not found at: ${gradleCmd}`);
  process.exit(1);
}

console.log(`[QGo] Executing Gradle assembleDebug in ${androidDir}...`);
const gradlewResult = spawnSync(gradleCmd, ['assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
});

if (gradlewResult.status !== 0) {
  console.error('\n[Error] Gradle build failed with exit code:', gradlewResult.status);
  console.log('[Tip] Ensure Android SDK and Java JDK 17+ are installed and ANDROID_HOME is set.');
  process.exit(gradlewResult.status || 1);
}

// 3. Locate generated debug APK
const generatedApkPath = path.join(
  androidDir,
  'app/build/outputs/apk/debug/app-debug.apk'
);

if (!fs.existsSync(generatedApkPath)) {
  console.error(`\n[Error] Could not find output APK at: ${generatedApkPath}`);
  process.exit(1);
}

// 4. Copy APK to release/ folder
const releaseDir = path.resolve(__dirname, '../release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const targetApkName = `QGo-v${appVersion}.apk`;
const targetApkPath = path.join(releaseDir, targetApkName);

fs.copyFileSync(generatedApkPath, targetApkPath);

const stats = fs.statSync(targetApkPath);
const fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n======================================================');
console.log('   SUCCESS! Shareable Android APK Built');
console.log('======================================================');
console.log(`Output File : ${targetApkPath}`);
console.log(`File Name   : ${targetApkName}`);
console.log(`File Size   : ${fileSizeMb} MB`);
console.log(`App Version : v${appVersion}`);
console.log('\n--- HOW TO SHARE WITH FRIENDS FOR BETA TESTING ---');
console.log('1. WhatsApp Web / Mobile:');
console.log(`   Attach and send "${targetApkName}" directly in any WhatsApp chat.`);
console.log('   Your friend taps the file to install (enable "Install Unknown Apps" if prompted).');
console.log('\n2. Google Drive / GitHub Releases (For In-App OTA Update):');
console.log(`   Upload "${targetApkName}" to Drive or GitHub, grab direct link, and paste into:`);
console.log('   Super Admin Dashboard -> Platform Settings -> Publish Android APK Release.');
console.log('   All mobile users will see the "Update Available" modal automatically!');
console.log('======================================================\n');
