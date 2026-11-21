import 'dotenv/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'node:fs';
import path from 'node:path';

let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
const isUsingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

// Support inline service account JSON via FIREBASE_SERVICE_ACCOUNT_JSON.
// Value may be raw JSON or base64-encoded JSON — both are accepted.
const inlineServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

// Clean up GOOGLE_APPLICATION_CREDENTIALS path if provided
const googleAppCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? process.env.GOOGLE_APPLICATION_CREDENTIALS.trim().replace(/^["']|["']$/g, '')
  : '';

let resolvedServiceAccountObj: any = null;
let resolvedSource = '';

if (inlineServiceAccountJson) {
  try {
    resolvedServiceAccountObj = JSON.parse(inlineServiceAccountJson);
    resolvedSource = 'inline FIREBASE_SERVICE_ACCOUNT_JSON';
  } catch {
    try {
      const decoded = Buffer.from(inlineServiceAccountJson, 'base64').toString('utf-8');
      resolvedServiceAccountObj = JSON.parse(decoded);
      resolvedSource = 'base64 FIREBASE_SERVICE_ACCOUNT_JSON';
    } catch (err: any) {
      console.error('[Firebase Admin] Failed parsing FIREBASE_SERVICE_ACCOUNT_JSON:', err?.message || err);
    }
  }
}

if (!resolvedServiceAccountObj && googleAppCredsPath) {
  try {
    if (fs.existsSync(googleAppCredsPath)) {
      const content = fs.readFileSync(googleAppCredsPath, 'utf-8');
      resolvedServiceAccountObj = JSON.parse(content);
      resolvedSource = `GOOGLE_APPLICATION_CREDENTIALS file (${googleAppCredsPath})`;
    } else {
      console.warn(`[Firebase Admin] File specified in GOOGLE_APPLICATION_CREDENTIALS does not exist: "${googleAppCredsPath}"`);
    }
  } catch (err: any) {
    console.error(`[Firebase Admin] Failed reading GOOGLE_APPLICATION_CREDENTIALS from "${googleAppCredsPath}":`, err?.message || err);
  }
}

// Auto-discover Render secret files or project-relative service account if not yet resolved
if (!resolvedServiceAccountObj) {
  const candidatePaths = [
    '/etc/secrets/firebase-adminsdk.json',
    '/etc/secrets/firebase-adminsdk',
    '/etc/secrets/google-application-credentials.json',
    '/etc/secrets/google-credentials.json',
    path.resolve(process.cwd(), 'qqoo-b335e-firebase-adminsdk-fbsvc-3cc634a347.json'),
  ];
  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8');
        resolvedServiceAccountObj = JSON.parse(content);
        resolvedSource = `Auto-discovered secret file (${candidate})`;
        break;
      }
    } catch {
      // Continue searching
    }
  }
}

if (resolvedServiceAccountObj) {
  if (!projectId && resolvedServiceAccountObj.project_id) {
    projectId = resolvedServiceAccountObj.project_id;
  }
  if (!storageBucket && resolvedServiceAccountObj.project_id) {
    storageBucket = `${resolvedServiceAccountObj.project_id}.firebasestorage.app`;
  }
}

const hasExplicitCredentials =
  isUsingEmulator ||
  Boolean(resolvedServiceAccountObj) ||
  (process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true' && !process.env.GOOGLE_APPLICATION_CREDENTIALS);

if (!getApps().length) {
  try {
    let credential;
    if (resolvedServiceAccountObj) {
      credential = cert(resolvedServiceAccountObj as Parameters<typeof cert>[0]);
      console.log(`[Firebase Admin] Initialized with cert() from ${resolvedSource}. Project: ${projectId || resolvedServiceAccountObj.project_id}`);
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
    console.error('\x1b[31m[Firebase Admin Error] Could not initialize Firebase Admin SDK:\x1b[0m', error);
  }

  // ── Emit a clear named warning if no credentials were resolved ──────────────
  if (!hasExplicitCredentials) {
    console.warn(
      '\x1b[33m[Firebase Admin] WARNING: No credentials configured.\x1b[0m\n' +
      '  Auth token verification will use a MOCK (all tokens will be rejected).\n' +
      '  To fix, set one of the following in your .env or Render dashboard:\n' +
      '    GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-adminsdk.json\n' +
      '    FIREBASE_SERVICE_ACCOUNT_JSON=<inline-JSON-or-base64>\n' +
      '    Mount secret file at /etc/secrets/firebase-adminsdk.json\n' +
      '  Get a service account key: Firebase Console → Project Settings → Service accounts\n' +
      '    → Generate new private key → upload to Render Secret Files'
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

      console.error(
        '[Firebase Admin Auth Error] Rejecting verifyIdToken: Firebase Admin credentials are not configured on the server.\n' +
        '  Ensure GOOGLE_APPLICATION_CREDENTIALS points to a valid service account file on Render (e.g. /etc/secrets/firebase-adminsdk.json),\n' +
        '  or define FIREBASE_SERVICE_ACCOUNT_JSON in environment variables.'
      );

      const error = new Error(
        'Firebase Admin credentials are not configured on server. ' +
        'Configure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.'
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
