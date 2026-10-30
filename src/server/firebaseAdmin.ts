import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';

let appInstance: App | null = null;

export function resetFirebaseAdminForTesting(): void {
  const apps = getApps();
  if (apps && apps.length > 0) {
    for (const app of [...apps]) {
      try {
        app.delete().catch(() => {});
      } catch {}
    }
  }
  appInstance = null;
}

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
  const isTestEnv = process.env['NODE_ENV'] === 'test' || Boolean(process.env['VITEST']);

  // Production Safeguard: Never allow automated tests to initialize Firebase Admin without the emulator
  if (isTestEnv && (!process.env['FIRESTORE_EMULATOR_HOST'] || process.env['FIRESTORE_EMULATOR_HOST'].trim() === '')) {
    throw new Error(
      'FATAL PRODUCTION SAFEGUARD: Automated tests attempted to initialize Firebase Admin SDK without FIRESTORE_EMULATOR_HOST. ' +
      'Connecting to live production Firestore during tests is strictly forbidden.'
    );
  }

  const expectedProjectId =
    process.env['FIREBASE_PROJECT_ID'] ||
    process.env['VITE_FIREBASE_PROJECT_ID'] ||
    (isTestEnv ? 'ashmawy-test-suite' : 'ashmawy-ordering');

  // Verify cached appInstance matches expectedProjectId; if not, discard and reset
  if (appInstance && appInstance.options?.projectId !== expectedProjectId) {
    try {
      appInstance.delete().catch(() => {});
    } catch {}
    appInstance = null;
  }

  if (!appInstance) {
    const existingApps = getApps();
    const defaultApp = existingApps.find((a: App) => a?.name === '[DEFAULT]');
    if (defaultApp) {
      // Always reuse existing [DEFAULT] app in runtime/Vite dev to prevent duplicate initialization errors
      appInstance = defaultApp;
    }

    if (!appInstance) {
      const projectId = expectedProjectId;

      // 1. Emulator mode
      if (process.env['FIRESTORE_EMULATOR_HOST']) {
        appInstance = initializeApp({ projectId });
      } else {
        const serviceAccountKey = process.env['FIREBASE_SERVICE_ACCOUNT_KEY'];

        // 2. Service Account JSON
        if (serviceAccountKey) {
          try {
            const parsed = JSON.parse(serviceAccountKey);
            appInstance = initializeApp({
              credential: cert(parsed),
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
            appInstance = initializeApp({
              credential: cert({
                projectId,
                clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] as string,
                privateKey,
              }),
            });
          } catch (err) {
            console.error('[FirebaseAdmin] Error initializing with individual credentials:', err);
          }
        }

        // 4. Default credentials fallback
        if (!appInstance) {
          appInstance = initializeApp({ projectId });
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
