#!/usr/bin/env node
/**
 * scripts/build-cloud.cjs
 *
 * Builds a standalone Android APK configured for 24/7 Cloud Backend (Render, Railway, etc.).
 * Does NOT require laptop to be running or phone to be on same Wi-Fi.
 *
 * Usage:
 *   node scripts/build-cloud.cjs <CLOUD_BACKEND_HTTPS_URL>
 * Example:
 *   node scripts/build-cloud.cjs https://qgo-backend.onrender.com
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

require('dotenv').config();

let cloudUrl = process.argv[2] || process.env.VITE_API_URL || '';

if (!cloudUrl) {
  console.log('[QGo Cloud Build] No URL provided in CLI argument or VITE_API_URL.');
  console.log('Usage: npm run cap:build:cloud -- https://your-app.onrender.com');
  console.log('Defaulting to Render blueprint name: https://qgo-backend.onrender.com');
  cloudUrl = 'https://qgo-backend.onrender.com';
}

cloudUrl = cloudUrl.trim().replace(/\/+$/, '');

console.log('====================================================');
console.log('       QGo Standalone Cloud APK Builder');
console.log('====================================================');
console.log(`Cloud Backend URL: ${cloudUrl}`);
console.log('Target: Standalone Android APK (Runs anywhere on 4G/5G/Wi-Fi)');
console.log('----------------------------------------------------');

process.env.VITE_API_URL = cloudUrl;
process.env.NODE_ENV = 'production';

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd || process.cwd(), shell: true });
}

try {
  console.log('\n[1/3] Building production web assets...');
  run('npx vite build');

  console.log('\n[2/3] Syncing Capacitor Android assets...');
  run('npx cap sync android');

  console.log('\n[3/3] Compiling Android APK...');
  run('gradlew.bat assembleDebug', path.join(process.cwd(), 'android'));

  const srcApk = path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const rootApk = path.join(process.cwd(), 'QGo-Public-Cloud.apk');

  if (fs.existsSync(srcApk)) {
    fs.copyFileSync(srcApk, rootApk);

    const stats = fs.statSync(rootApk);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n====================================================');
    console.log('       ✔ CLOUD APK BUILD SUCCESSFUL!');
    console.log('====================================================');
    console.log(`File: ${rootApk}`);
    console.log(`Size: ${sizeMb} MB`);
    console.log(`Cloud Backend: ${cloudUrl}`);
    console.log('');
    console.log('HOW TO SHARE WITH USERS:');
    console.log('1. Send "QGo-Public-Cloud.apk" via WhatsApp or upload to Google Drive.');
    console.log('2. Users can install and open the app on ANY network (Jio / Airtel / 4G / 5G / Wi-Fi).');
    console.log('3. Laptop is NOT needed. Data saves to Cloud 24/7.');
    console.log('====================================================\n');
  } else {
    throw new Error('APK binary not found at ' + srcApk);
  }
} catch (err) {
  console.error('\n[QGo Cloud Build] Build failed:', err.message);
  process.exit(1);
}
