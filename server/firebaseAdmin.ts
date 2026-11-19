import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'node:fs';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
const isUsingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

// Support inline service account JSON via FIREBASE_SERVICE_ACCOUNT_JSON.
// Value may be raw JSON or base64-encoded JSON — both are accepted.
// This is the recommended approach for APK debug testing and CI without a credentials file on disk.
const inlineServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const hasExplicitCredentials =
  isUsingEmulator ||
  Boolean(inlineServiceAccountJson) ||
  Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
  process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true';

if (!getApps().length) {
  try {
    let credential;
    if (inlineServiceAccountJson) {
      let serviceAccountObj: object;
      try {
        serviceAccountObj = JSON.parse(inlineServiceAccountJson);
      } catch {
        const decoded = Buffer.from(inlineServiceAccountJson, 'base64').toString('utf-8');
        serviceAccountObj = JSON.parse(decoded);
      }
      credential = cert(serviceAccountObj as Parameters<typeof cert>[0]);
      console.log('[Firebase Admin] Initialized with inline FIREBASE_SERVICE_ACCOUNT_JSON credential.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      credential = cert(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file.');
    } else if (hasExplicitCredentials && !isUsingEmulator) {
      credential = applicationDefault();
      console.log('[Firebase Admin] Initialized with Application Default Credentials.');
    }

    initializeApp({
      projectId,
      ...(storageBucket ? { storageBucket } : {}),
      ...(credential ? { credential } : {}),
    });
    console.log('[Firebase Admin] App initialized for project:', projectId);
  } catch (error) {
    console.warn('\x1b[33m[Warning] Could not initialize Firebase Admin SDK:\x1b[0m', error);
  }

  // ── Emit a clear named warning if no credentials were resolved ──────────────
  if (!hasExplicitCredentials) {
    console.warn(
      '\x1b[33m[Firebase Admin] WARNING: No credentials configured.\x1b[0m\n' +
      '  Auth token verification will use a MOCK (all tokens will be rejected).\n' +
      '  To fix, set one of the following in your .env:\n' +
      '    GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json>\n' +
      '    FIREBASE_SERVICE_ACCOUNT_JSON=<inline-JSON-or-base64>\n' +
      '    FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=true  (requires gcloud/firebase login)\n' +
      '  Get a service account key: Firebase Console → Project Settings → Service accounts\n' +
      '    → Generate new private key → save as .json → set GOOGLE_APPLICATION_CREDENTIALS'
    );
  }

} // end if (!getApps().length)

// Firestore requires credentials unless emulator is running

const useMockFirestore = !hasExplicitCredentials && !isUsingEmulator;
let firestoreInstance: any;
if (useMockFirestore) {
  firestoreInstance = createMockDb();
} else {
  firestoreInstance = getFirestore();
  try {
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    // Non-fatal if settings already applied
  }
}
export const adminDb = firestoreInstance;

// Auth verification works with public certificates even without a service account
let realAuth: ReturnType<typeof getAuth> | null = null;
try {
  realAuth = getAuth();
} catch (e) {
  console.warn('[Firebase Admin] getAuth() failed, falling back to mock auth:', e);
}

export const adminAuth = realAuth || createMockAuth();
export const adminStorage = useMockFirestore ? createMockStorage() : getStorage();

function createMockDb(): any {
  return {
    collection: (name: string) => ({
      get: async () => ({ docs: [], size: 0, forEach: () => {} }),
      doc: (id?: string) => ({
        set: async () => {},
        delete: async () => {},
        get: async () => ({ exists: false, data: () => null }),
        id: id || 'mock-id'
      }),
      add: async () => ({ id: 'mock-id' })
    }),
    batch: () => ({
      delete: () => {},
      set: () => {},
      update: () => {},
      commit: async () => {}
    }),
    runTransaction: async (cb: any) => {
      const transaction = {
        get: async (ref: any) => ({ exists: false, data: () => null }),
        set: () => {},
        delete: () => {},
        update: () => {}
      };
      return cb(transaction);
    }
  };
}

function createMockAuth(): any {
  return {
    verifyIdToken: async (token: string) => {
      if (!token || typeof token !== 'string') {
        throw new Error('No token provided');
      }

      const error = new Error(
        'Firebase Admin credentials are not configured. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_JSON in your .env file with the contents of your Firebase service account JSON ' +
        '(from Firebase Console → Project Settings → Service accounts → Generate new private key).'
      );
      Object.assign(error, { code: 'auth/admin-not-configured' });
      throw error;
    },
    getUser: async () => ({ uid: 'mock-uid', email: 'mock@example.com' }),
    createUser: async () => ({ uid: 'mock-uid' }),
    updateUser: async () => ({ uid: 'mock-uid' }),
    deleteUser: async () => {},
    createCustomToken: async () => 'mock-token'
  };
}

function createMockStorage(): any {
  return {
    bucket: () => ({
      file: () => ({
        save: async () => {},
        getSignedUrl: async () => ['http://mock-url'],
        delete: async () => {}
      })
    })
  };
}
