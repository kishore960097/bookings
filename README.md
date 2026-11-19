# QGo

Salon and barber booking with live queue tracking, QR tickets, owner tools, and staff queue management.

## Run Locally

Prerequisite: Node.js

1. Install dependencies:
   `npm install`
2. Add environment values from `.env.example`.
3. Start the app:
   `npm run dev`

If the project folder path contains special characters such as `&`, run the server directly:

```bash
node --import tsx server.ts
```

## Phone Preview

### Primary (Android + USB Cable)
1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone to your PC via USB and run:
   ```bash
   npm run dev:phone
   ```
   *(This runs `adb reverse tcp:3000 tcp:3000`)*
3. Open `http://localhost:3000` in Chrome on your phone.
   - **Why localhost?** `localhost` is treated as a secure origin by browsers and is an authorized domain in Firebase Auth by default. Authentication, camera, and geolocation work out of the box with zero CORS configuration needed.

### Secondary (Wireless / Cloudflare Quick Tunnel)
If testing without a USB cable:
1. Start a Cloudflare tunnel pointing to your dev server:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Note the generated `https://<random-subdomain>.trycloudflare.com` URL.
3. **Manual configuration steps**:
   - Add the tunnel origin to `QGO_ALLOWED_ORIGINS` in your local `.env`.
   - Add the tunnel domain (`<random-subdomain>.trycloudflare.com`) in **Firebase Console > Authentication > Settings > Authorized domains**.
   *(Do NOT commit tunnel URLs to version control).*

