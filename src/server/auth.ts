import { getFirebaseAdmin } from './firebaseAdmin';

export interface AdminAuthResult {
  authorized: boolean;
  statusCode: 200 | 401 | 403;
  error?: string | undefined;
  user?: {
    uid: string;
    email?: string | undefined;
    role?: string | undefined;
  } | undefined;
}

export const ADMIN_EMAILS = new Set([
  'admin@ashmawy.com',
  'matar@ashmawy.com',
  'mahatta@ashmawy.com',
]);

export type TokenVerifier = (token: string) => Promise<{
  uid: string;
  email?: string | undefined;
  role?: string | undefined;
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
 *    - Custom claim (role === 'admin' | 'super_admin' | 'matar_admin' | 'mahatta_admin')
 *    - Server allowlist email (admin@ashmawy.com, etc.)
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

  let decodedToken: { uid: string; email?: string | undefined; role?: string | undefined; [key: string]: any };
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

  // 1. Check verified custom claims on the token
  if (
    tokenRole === 'admin' ||
    tokenRole === 'super_admin' ||
    tokenRole === 'matar_admin' ||
    tokenRole === 'mahatta_admin'
  ) {
    return {
      authorized: true,
      statusCode: 200,
      user: { uid, email, role: tokenRole },
    };
  }

  // 2. Check trusted admin email allowlist (requires verified email)
  if (email && ADMIN_EMAILS.has(email)) {
    if (decodedToken['email_verified'] !== false) {
      return {
        authorized: true,
        statusCode: 200,
        user: { uid, email, role: 'admin' },
      };
    }
  }

  // 3. Authoritative Firestore `admins/{uid}` document check
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
          data['role'] === 'matar_admin' ||
          data['role'] === 'mahatta_admin')
      ) {
        return {
          authorized: true,
          statusCode: 200,
          user: { uid, email, role: String(data['role']) },
        };
      }
    }
  } catch (err) {
    console.warn('[AdminAuth] Error inspecting admins collection:', err);
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

