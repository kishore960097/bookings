import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: Release builds must never enable cleartext or server.url.
// For local Android development over HTTP LAN IPs, use the debug network security config in android/app/src/debug.
const config: CapacitorConfig = {
  appId: 'com.qgo.app',
  appName: 'QGo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'qgo.app',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#E73229',
      launchAutoHide: true,
      showSpinner: false,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      // Include both google.com and phone — without phone, native reCAPTCHA
      // verification for SMS OTP cannot initialize on Android.
      providers: ['google.com', 'phone'],
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
