import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'node:fs';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
const isUsingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
const isUsingApplicationDefaultCredentials =
  isUsingEmulator ||
  Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
  process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true';

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID must be configured for the QGo server.');
}

let useMock = false;

if (!isUsingApplicationDefaultCredentials) {
  console.warn('\x1b[33m[Warning] Firebase Admin credentials not found. Running in mock/in-memory mode.\x1b[0m');
  useMock = true;
} else {
  if (!getApps().length) {
    try {
      initializeApp({
        projectId,
        ...(storageBucket ? { storageBucket } : {}),
        ...(!isUsingEmulator ? { credential: applicationDefault() } : {}),
      });
    } catch (error) {
      console.warn('\x1b[33m[Warning] Could not initialize Firebase. Running in mock/in-memory mode.\x1b[0m');
      useMock = true;
    }
  }
}

export const adminDb = useMock ? createMockDb() : getFirestore();
export const adminAuth = useMock ? createMockAuth() : getAuth();
export const adminStorage = useMock ? createMockStorage() : getStorage();

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

      try {
        const data = JSON.parse(token);
        if (data && data.mock) {
          if (data.exp && data.exp < Date.now()) {
            throw new Error('Mock token has expired');
          }
          return {
            uid: 'mock-uid-' + (data.phone || '1').replace(/\+/g, ''),
            phone_number: data.phone,
            name: data.name,
          };
        }
      } catch (e: any) {
        if (e.message === 'Mock token has expired') throw e;
      }

      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payloadBase64 = parts[1];
          const payload = Buffer.from(payloadBase64, 'base64').toString('utf8');
          const data = JSON.parse(payload);
          if (data && typeof data === 'object') {
            if (data.exp && typeof data.exp === 'number' && data.exp * 1000 < Date.now()) {
              throw new Error('Firebase ID token has expired');
            }
            return {
              uid: data.sub || data.user_id || 'mock-uid',
              email: data.email,
              name: data.name,
              picture: data.picture,
              phone_number: data.phone_number,
            };
          }
        }
      } catch (e: any) {
        if (e.message === 'Firebase ID token has expired') throw e;
      }

      throw new Error('Invalid or expired Firebase ID token');
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
