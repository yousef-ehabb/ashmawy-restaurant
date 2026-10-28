import admin from 'firebase-admin';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

let appInstance: App | null = null;

export function isFirebaseAdminConfigured(): boolean {
  if (process.env['FIRESTORE_EMULATOR_HOST']) return true;
  if (process.env['FIREBASE_SERVICE_ACCOUNT_KEY']) return true;
  if (process.env['FIREBASE_PRIVATE_KEY'] && process.env['FIREBASE_CLIENT_EMAIL']) return true;
  return false;
}

export function getFirebaseAdmin(): {
  adminApp: App;
  adminDb: Firestore;
  adminAuth: Auth;
  FieldValue: typeof FieldValue;
} {
  const firebase = (admin as any).default || admin;

  if (!appInstance) {
    const existingApps = firebase.apps;
    if (existingApps && existingApps.length > 0 && existingApps[0]) {
      appInstance = existingApps[0];
    } else {
      const projectId =
        process.env['FIREBASE_PROJECT_ID'] ||
        process.env['VITE_FIREBASE_PROJECT_ID'] ||
        'ashmawy-ordering';

      // 1. Emulator mode
      if (process.env['FIRESTORE_EMULATOR_HOST']) {
        appInstance = firebase.initializeApp({ projectId });
      } else {
        const certFn = firebase.cert || (firebase.credential && firebase.credential.cert);
        const serviceAccountKey = process.env['FIREBASE_SERVICE_ACCOUNT_KEY'];

        // 2. Service Account JSON
        if (serviceAccountKey) {
          try {
            const parsed = JSON.parse(serviceAccountKey);
            appInstance = firebase.initializeApp({
              credential: certFn ? certFn(parsed) : undefined,
              projectId: parsed.project_id || projectId,
            });
          } catch (err) {
            console.error('[FirebaseAdmin] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', err);
          }
        }

        // 3. Individual credentials
        if (!appInstance && process.env['FIREBASE_PRIVATE_KEY'] && process.env['FIREBASE_CLIENT_EMAIL']) {
          try {
            const privateKey = (process.env['FIREBASE_PRIVATE_KEY'] as string).replace(/\\n/g, '\n');
            appInstance = firebase.initializeApp({
              credential: certFn
                ? certFn({
                    projectId,
                    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] as string,
                    privateKey,
                  })
                : undefined,
            });
          } catch (err) {
            console.error('[FirebaseAdmin] Error initializing with individual credentials:', err);
          }
        }

        // 4. Default credentials fallback
        if (!appInstance) {
          appInstance = firebase.initializeApp({ projectId });
        }
      }
    }
  }

  const db = getFirestore(appInstance as App);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings can only be called once
  }
  const auth = getAuth(appInstance as App);

  return {
    adminApp: appInstance as App,
    adminDb: db,
    adminAuth: auth,
    FieldValue,
  };
}
