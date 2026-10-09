import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';

const hasCredentials = 
  (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
  process.env.FIRESTORE_EMULATOR_HOST;

const firebaseAdminConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
};

if (!getApps().length) {
  initializeApp(firebaseAdminConfig);
}

export const adminDb = hasCredentials ? getFirestore() : {
  collection: (name: string) => ({
    get: async () => ({ docs: [], size: 0 }),
    doc: (id: string) => ({
      set: async () => {},
      delete: async () => {}
    })
  }),
  batch: () => ({
    delete: () => {},
    commit: async () => {}
  })
} as any;

export const adminAuth = hasCredentials ? getAuth() : {} as any;
export const adminStorage = hasCredentials ? getStorage() : {} as any;

