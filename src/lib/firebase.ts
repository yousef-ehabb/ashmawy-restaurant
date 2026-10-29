import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase Client SDK Configuration for Ashmawy Restaurant
 */
export const firebaseConfig = {
  apiKey: (import.meta.env['VITE_FIREBASE_API_KEY'] as string | undefined) || 'AIzaSyAByIgIA-PXP4dfDavJieB3T2yAIdDu6vE',
  authDomain: (import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string | undefined) || 'ashmawy-ordering.firebaseapp.com',
  projectId: (import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string | undefined) || 'ashmawy-ordering',
  storageBucket: (import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] as string | undefined) || 'ashmawy-ordering.firebasestorage.app',
  messagingSenderId: (import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string | undefined) || '76898297639',
  appId: (import.meta.env['VITE_FIREBASE_APP_ID'] as string | undefined) || '1:76898297639:web:ebc029a859f7e83ad42b02',
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your_api_key_here' &&
    firebaseConfig.projectId !== 'your-project-id'
  );
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export const ensureAnonymousAuth = async (): Promise<void> => {
  // Automatic anonymous sign-in is disabled; the application uses authenticated accounts
  return;
};

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    const isBrowser = typeof window !== 'undefined';

    try {
      if (isBrowser) {
        // Multi-tab offline persistence for client browser
        db = initializeFirestore(app, {
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } else {
        // SSR / Node / Nitro environment
        db = getFirestore(app);
      }
    } catch {
      db = getFirestore(app);
    }

    if (isBrowser) {
      if (import.meta.env['VITE_USE_FIREBASE_EMULATOR'] === 'true' && db) {
        try {
          connectFirestoreEmulator(db, '127.0.0.1', 8081);
        } catch {
          // already connected
        }
      }

      auth = getAuth(app);
    }
  } catch (error) {
    console.warn('[Ashmawy Firebase] Initialization error:', error);
  }
} else {
  console.info('[Ashmawy Firebase] Offline mode: Set credentials in .env to connect to live Firestore.');
}

export { app, db, auth };
