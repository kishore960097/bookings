import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, Auth, setPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID,
};

const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== 'measurementId' && !value)
  .map(([key]) => key);

const isFirebaseConfigured = missingFirebaseConfig.length === 0;

if (!isFirebaseConfigured) {
  console.warn(
    `[QGo] Missing Firebase config keys: ${missingFirebaseConfig.join(', ')}. ` +
    'Auth features will be unavailable. Add the required VITE_FIREBASE_* env vars.'
  );
}

// Gracefully initialise – never throw at module level so the app can always boot.
let app: FirebaseApp;
let auth: Auth;
let firebaseAuthReady: Promise<void>;
let db: Firestore;
let storage: FirebaseStorage;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  firebaseAuthReady = setPersistence(auth, browserLocalPersistence).catch((e) => {
    console.warn('[QGo] Firebase persistence error:', e);
  }) as Promise<void>;
  db = getFirestore(app);
  storage = getStorage(app);
} catch (e) {
  console.error('[QGo] Firebase initialisation failed:', e);
  // Provide stub objects so imports don't fail throughout the codebase.
  // The app will work in a limited, unauthenticated mode.
  app = {} as FirebaseApp;
  auth = {
    currentUser: null,
    onIdTokenChanged: (_next: any) => () => {},
    onAuthStateChanged: (_next: any) => () => {},
  } as unknown as Auth;
  firebaseAuthReady = Promise.resolve();
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

export { app, auth, firebaseAuthReady, db, storage };
