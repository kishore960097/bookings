#!/usr/bin/env node
/**
 * scripts/lan-ip.cjs
 * Prints the first non-loopback IPv4 address found on this machine (LAN IP).
 * Used by the cap:build:lan npm script.
 * Exit-code 0 on success, 1 if no LAN IP is found.
 */
'use strict';
const os = require('os');

const ifaces = os.networkInterfaces();
let lanIp = '';

for (const name of Object.keys(ifaces)) {
  const entries = ifaces[name] ?? [];
  for (const entry of entries) {
    if (entry.family === 'IPv4' && !entry.internal) {
      lanIp = entry.address;
      break;
    }
  }
  if (lanIp) break;
}

if (!lanIp) {
  process.stderr.write('[QGo] ERROR: Could not detect a LAN IPv4 address. Connect to a WiFi network.\n');
  process.exit(1);
}

process.stdout.write(lanIp);
