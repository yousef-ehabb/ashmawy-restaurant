import { getFirebaseAdmin } from './firebaseAdmin';

export type AdminRole = 'super_admin' | 'branch_admin' | 'admin';

export interface AdminAccountDefinition {
  email: string;
  role: 'super_admin' | 'branch_admin';
  branch: string; // 'all' | 'فرع المحطة' | 'فرع المطار'
  displayName: string;
  password?: string;
}

export const ADMIN_ACCOUNTS_MAP: Record<string, AdminAccountDefinition> = {
  // 1. Super Admin (Full access to all branches and global website settings)
  'admin@ashmawy.com': {
    email: 'admin@ashmawy.com',
    role: 'super_admin',
    branch: 'all',
    displayName: 'الإدارة العامة - كافة الفروع',
    password: 'admin@123456',
  },
  // 2. Station Branch Admin (أدمن فرع المحطة) - includes typo alias as requested
  'station_admin@ashmayw.com': {
    email: 'station_admin@ashmayw.com',
    role: 'branch_admin',
    branch: 'فرع المحطة',
    displayName: 'إدارة فرع المحطة',
    password: 'admin@123456',
  },
  'station_admin@ashmawy.com': {
    email: 'station_admin@ashmawy.com',
    role: 'branch_admin',
    branch: 'فرع المحطة',
    displayName: 'إدارة فرع المحطة',
    password: 'admin@123456',
  },
  'mahatta@ashmawy.com': {
    email: 'mahatta@ashmawy.com',
    role: 'branch_admin',
    branch: 'فرع المحطة',
    displayName: 'إدارة فرع المحطة',
    password: 'admin@123456',
  },
  // 3. Airport Branch Admin (أدمن فرع المطار)
  'elmatar_st_admin@ashmawy.com': {
    email: 'elmatar_st_admin@ashmawy.com',
    role: 'branch_admin',
    branch: 'فرع المطار',
    displayName: 'إدارة فرع المطار',
    password: 'admin@123456',
  },
  'matar@ashmawy.com': {
    email: 'matar@ashmawy.com',
    role: 'branch_admin',
    branch: 'فرع المطار',
    displayName: 'إدارة فرع المطار',
    password: 'admin@123456',
  },
};

export const ADMIN_EMAILS = new Set<string>(Object.keys(ADMIN_ACCOUNTS_MAP));

export interface AdminAuthResult {
  authorized: boolean;
  statusCode: 200 | 401 | 403;
  error?: string | undefined;
  user?: {
    uid: string;
    email?: string | undefined;
    role?: AdminRole | string | undefined;
    branch?: string | undefined; // 'all' | 'فرع المحطة' | 'فرع المطار'
    displayName?: string | undefined;
  } | undefined;
}

let hasSeededAdmins = false;
let seedingPromise: Promise<void> | null = null;

/**
 * Automatically seeds/ensures the Super Admin and dedicated Branch Admin accounts
 * exist in Firebase Admin Auth and Firestore `admins/{uid}` with `admin@123456`.
 */
export async function ensureAdminAccounts(force = false): Promise<void> {
  if (hasSeededAdmins && !force) return;
  if (seedingPromise && !force) return seedingPromise;

  // Don't attempt remote operations in test environment without emulator
  if (process.env['NODE_ENV'] === 'test' && !process.env['FIRESTORE_EMULATOR_HOST']) {
    return;
  }

  seedingPromise = (async () => {
    try {
      const { adminAuth, adminDb } = getFirebaseAdmin();
      const accountsToSeed = [
        ADMIN_ACCOUNTS_MAP['station_admin@ashmayw.com'],
        ADMIN_ACCOUNTS_MAP['station_admin@ashmawy.com'],
        ADMIN_ACCOUNTS_MAP['elmatar_st_admin@ashmawy.com'],
        ADMIN_ACCOUNTS_MAP['admin@ashmawy.com'],
      ];

      for (const acc of accountsToSeed) {
        if (!acc) continue;
        try {
          let userRecord: any = null;
          try {
            userRecord = await adminAuth.getUserByEmail(acc.email);
            if (acc.password) {
              await adminAuth.updateUser(userRecord.uid, {
                password: acc.password,
                displayName: acc.displayName,
                emailVerified: true,
              });
            }
          } catch (getErr: any) {
            if (getErr?.code === 'auth/user-not-found') {
              userRecord = await adminAuth.createUser({
                email: acc.email,
                password: acc.password || 'admin@123456',
                displayName: acc.displayName,
                emailVerified: true,
              });
            } else {
              throw getErr;
            }
          }

          if (userRecord && userRecord.uid) {
            // Set custom claims for branch authorization
            await adminAuth.setCustomUserClaims(userRecord.uid, {
              role: acc.role,
              branch: acc.branch,
              admin: true,
            });

            // Persist to authoritative Firestore `admins` collection
            await adminDb.collection('admins').doc(userRecord.uid).set(
              {
                uid: userRecord.uid,
                email: acc.email,
                role: acc.role,
                branch: acc.branch,
                displayName: acc.displayName,
                is_active: true,
                updated_at: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        } catch (itemErr: any) {
          console.warn(`[ensureAdminAccounts] Seeding note for ${acc.email}:`, itemErr?.message || itemErr);
        }
      }
      hasSeededAdmins = true;
    } catch (err: any) {
      console.warn('[ensureAdminAccounts] Admin seeding error:', err?.message || err);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

// Trigger initial seed in background on module load
if (process.env['NODE_ENV'] !== 'test') {
  ensureAdminAccounts().catch(() => {});
}

export type TokenVerifier = (token: string) => Promise<{
  uid: string;
  email?: string | undefined;
  role?: string | undefined;
  branch?: string | undefined;
  [key: string]: any;
}>;

let customTokenVerifier: TokenVerifier | null = null;

export function setTokenVerifierForTesting(verifier: TokenVerifier | null): void {
  customTokenVerifier = verifier;
}

/**
 * Validates whether an incoming Request has a verified administrator identity.
 * 1. Checks Authorization header (Bearer <token>). Missing/invalid -> 401.
 * 2. Cryptographically verifies the token using Firebase Admin SDK. Invalid/expired -> 401.
 * 3. Enforces server-side authorization:
 *    - Custom claim (role === 'admin' | 'super_admin' | 'branch_admin' | 'matar_admin' | 'mahatta_admin')
 *    - Server allowlist email (admin@ashmawy.com, station_admin@..., elmatar_st_admin@..., etc.)
 *    - Active document in Firestore `admins/{uid}` with is_active === true and valid role
 *    Any authenticated non-admin -> 403 Forbidden.
 * 4. Never trusts client-supplied headers or body fields.
 */
export async function verifyAdminRequest(request: Request): Promise<AdminAuthResult> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Missing or malformed Authorization header (expected Bearer <token>)',
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Empty bearer token',
    };
  }

  let decodedToken: { uid: string; email?: string | undefined; role?: string | undefined; branch?: string | undefined; [key: string]: any };
  try {
    if (customTokenVerifier) {
      decodedToken = await customTokenVerifier(token);
    } else {
      const { adminAuth } = getFirebaseAdmin();
      decodedToken = await adminAuth.verifyIdToken(token);
    }
  } catch (err: any) {
    return {
      authorized: false,
      statusCode: 401,
      error: `Unauthorized: Invalid or expired token (${err?.message || 'Verification failed'})`,
    };
  }

  if (!decodedToken || typeof decodedToken !== 'object' || !decodedToken.uid) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Unauthorized: Token payload does not contain a valid user identity',
    };
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email ? decodedToken.email.toLowerCase() : undefined;
  const tokenRole = decodedToken['role'];
  const tokenBranch = decodedToken['branch'];

  // 1. Check verified custom claims on the token
  if (
    tokenRole === 'admin' ||
    tokenRole === 'super_admin' ||
    tokenRole === 'branch_admin' ||
    tokenRole === 'matar_admin' ||
    tokenRole === 'mahatta_admin'
  ) {
    const effectiveRole: AdminRole =
      tokenRole === 'matar_admin' || tokenRole === 'mahatta_admin'
        ? 'branch_admin'
        : (tokenRole as AdminRole);
    const effectiveBranch =
      tokenBranch ||
      (tokenRole === 'matar_admin'
        ? 'فرع المطار'
        : tokenRole === 'mahatta_admin'
          ? 'فرع المحطة'
          : email && ADMIN_ACCOUNTS_MAP[email]
            ? ADMIN_ACCOUNTS_MAP[email].branch
            : 'all');
    return {
      authorized: true,
      statusCode: 200,
      user: {
        uid,
        email,
        role: effectiveRole,
        branch: effectiveBranch,
        displayName: decodedToken['displayName'] || (email ? ADMIN_ACCOUNTS_MAP[email]?.displayName : undefined),
      },
    };
  }

  // 2. Check trusted admin email allowlist (requires verified email)
  if (email && ADMIN_EMAILS.has(email)) {
    if (decodedToken['email_verified'] !== false) {
      const known = ADMIN_ACCOUNTS_MAP[email];
      return {
        authorized: true,
        statusCode: 200,
        user: {
          uid,
          email,
          role: known?.role || 'admin',
          branch: known?.branch || 'all',
          displayName: known?.displayName,
        },
      };
    }
  }

  // 3. Authoritative Firestore `admins/{uid}` document check
  if (!customTokenVerifier) {
    try {
    const { adminDb } = getFirebaseAdmin();
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    if (adminDoc.exists) {
      const data = adminDoc.data();
      if (
        data &&
        data['is_active'] === true &&
        (data['role'] === 'admin' ||
          data['role'] === 'super_admin' ||
          data['role'] === 'branch_admin' ||
          data['role'] === 'matar_admin' ||
          data['role'] === 'mahatta_admin')
      ) {
        const rawRole = String(data['role']);
        const effectiveRole: AdminRole =
          rawRole === 'matar_admin' || rawRole === 'mahatta_admin' ? 'branch_admin' : (rawRole as AdminRole);
        const effectiveBranch =
          (data['branch'] as string) ||
          (rawRole === 'matar_admin'
            ? 'فرع المطار'
            : rawRole === 'mahatta_admin'
              ? 'فرع المحطة'
              : email && ADMIN_ACCOUNTS_MAP[email]
                ? ADMIN_ACCOUNTS_MAP[email].branch
                : 'all');
        return {
          authorized: true,
          statusCode: 200,
          user: {
            uid,
            email,
            role: effectiveRole,
            branch: effectiveBranch,
            displayName: data['displayName'] || (email ? ADMIN_ACCOUNTS_MAP[email]?.displayName : undefined),
          },
        };
      }
    }
  } catch (err) {
    console.warn('[AdminAuth] Error inspecting admins collection:', err);
  }
  }

  // Authenticated user possesses valid token, but is not in admin records -> 403 Forbidden
  return {
    authorized: false,
    statusCode: 403,
    error: 'Forbidden: Authenticated user does not possess administrator privileges',
  };
}

export interface CustomerAuthResult {
  authenticated: boolean;
  statusCode: 200 | 401;
  error?: string | undefined;
  user?: {
    uid: string;
    email?: string | undefined;
    displayName?: string | undefined;
  } | undefined;
}

/**
 * Validates whether an incoming Request has a verified customer Firebase ID token.
 * Never trusts client-supplied headers or body fields.
 */
export async function verifyCustomerRequest(request: Request): Promise<CustomerAuthResult> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      statusCode: 401,
      error: 'Unauthorized: Missing or malformed Authorization header (expected Bearer <token>)',
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      authenticated: false,
      statusCode: 401,
      error: 'Unauthorized: Empty bearer token',
    };
  }

  try {
    let decodedToken: { uid: string; email?: string | undefined; name?: string | undefined; [key: string]: any };
    if (customTokenVerifier) {
      decodedToken = await customTokenVerifier(token);
    } else {
      const { adminAuth } = getFirebaseAdmin();
      decodedToken = await adminAuth.verifyIdToken(token);
    }

    if (!decodedToken || typeof decodedToken !== 'object' || !decodedToken.uid) {
      return {
        authenticated: false,
        statusCode: 401,
        error: 'Unauthorized: Token payload does not contain a valid user identity',
      };
    }

    return {
      authenticated: true,
      statusCode: 200,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
      },
    };
  } catch (err: any) {
    return {
      authenticated: false,
      statusCode: 401,
      error: `Unauthorized: Invalid or expired token (${err?.message || 'Verification failed'})`,
    };
  }
}

/**
 * Extracts and cryptographically verifies an optional customer token from a request.
 * If no Authorization header is provided, returns null (guest mode).
 * If an Authorization header is provided, verifies it. If invalid, throws an error or returns null.
 */
export async function extractVerifiedCustomer(
  request: Request
): Promise<{ uid: string; email?: string | undefined } | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    let decodedToken: { uid: string; email?: string | undefined; [key: string]: any };
    if (customTokenVerifier) {
      decodedToken = await customTokenVerifier(token);
    } else {
      const { adminAuth } = getFirebaseAdmin();
      decodedToken = await adminAuth.verifyIdToken(token);
    }

    if (decodedToken && decodedToken.uid) {
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
    }
  } catch (err) {
    console.warn('[extractVerifiedCustomer] Token verification failed:', err);
    throw new Error('Invalid or expired authentication token. Please sign in again.');
  }

  return null;
}
