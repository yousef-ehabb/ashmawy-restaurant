import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleApiRequest } from '../server/apiRouter';
import { setTokenVerifierForTesting } from '../server/auth';
import { getFirebaseAdmin } from '../server/firebaseAdmin';

process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8081';
process.env['FIREBASE_PROJECT_ID'] = 'ashmawy-ordering';

describe('Admin API Security & Authentication', () => {
  let createdOrderId = '';

  beforeEach(() => {
    setTokenVerifierForTesting(null);
  });

  beforeAll(async () => {
    const { adminDb } = getFirebaseAdmin();
    // Seed an order for update tests
    const orderRef = adminDb.collection('orders').doc();
    createdOrderId = orderRef.id;
    await orderRef.set({
      id: createdOrderId,
      order_number: 9999,
      status: 'new',
      customer_name: 'Test Customer',
      customer_phone: '01012345678',
      type: 'delivery',
      branch: 'فرع المطار',
      items: [],
      subtotal: 100,
      delivery_fee: 15,
      total: 115,
      created_at: new Date().toISOString(),
    });
  });

  afterAll(() => {
    setTokenVerifierForTesting(null);
  });

  // 1. Request without credentials -> 401
  it('rejects GET /api/admin/orders without credentials with 401', async () => {
    const req = new Request('http://localhost/api/admin/orders', { method: 'GET' });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // 2. Invalid or expired credentials -> 401
  it('rejects GET /api/admin/orders with invalid/expired token with 401', async () => {
    const req = new Request('http://localhost/api/admin/orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid.expired.token' },
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(401);
  });

  // 3. Authenticated non-admin -> 403
  it('rejects authenticated non-admin customer with 403 Forbidden', async () => {
    setTokenVerifierForTesting(async () => ({
      uid: 'customer-user-123',
      email: 'customer@gmail.com',
      role: 'customer',
    }));

    const req = new Request('http://localhost/api/admin/orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid.customer.token' },
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('administrator privileges');
  });

  // 3b. Unverified user claiming admin email -> 403
  it('rejects unverified user impersonating allowlisted admin email with 403 Forbidden', async () => {
    setTokenVerifierForTesting(async () => ({
      uid: 'attacker-impersonator-uid',
      email: 'admin@ashmawy.com',
      email_verified: false,
    }));

    const req = new Request('http://localhost/api/admin/orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer spoofed.unverified.token' },
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('administrator privileges');
  });

  // 4. Authenticated administrator can retrieve orders -> 200
  it('allows authenticated administrator to retrieve orders with 200', async () => {
    setTokenVerifierForTesting(async () => ({
      uid: 'admin-user-001',
      email: 'admin@ashmawy.com',
      role: 'admin',
    }));

    const req = new Request('http://localhost/api/admin/orders', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid.admin.token' },
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.orders)).toBe(true);
  });

  // 5. Authenticated administrator can update a valid order status
  it('allows authenticated administrator to update status from new to preparing', async () => {
    setTokenVerifierForTesting(async () => ({
      uid: 'admin-user-001',
      email: 'admin@ashmawy.com',
      role: 'admin',
    }));

    const req = new Request('http://localhost/api/admin/orders/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid.admin.token',
      },
      body: JSON.stringify({
        orderId: createdOrderId,
        status: 'preparing',
        notes: 'In kitchen preparation',
      }),
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('preparing');
  });

  // 6. Invalid status transitions and malformed requests are rejected
  it('rejects invalid status transitions and malformed status values with 422', async () => {
    setTokenVerifierForTesting(async () => ({
      uid: 'admin-user-001',
      email: 'admin@ashmawy.com',
      role: 'admin',
    }));

    // Malformed status string
    const malformedReq = new Request('http://localhost/api/admin/orders/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid.admin.token',
      },
      body: JSON.stringify({
        orderId: createdOrderId,
        status: 'non_existent_status',
      }),
    });
    const malformedRes = await handleApiRequest(malformedReq);
    expect(malformedRes.status).toBe(422);

    // Invalid transition: preparing -> new (backward transition is prohibited)
    const invalidTransReq = new Request('http://localhost/api/admin/orders/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid.admin.token',
      },
      body: JSON.stringify({
        orderId: createdOrderId,
        status: 'new',
      }),
    });
    const invalidTransRes = await handleApiRequest(invalidTransReq);
    expect(invalidTransRes.status).toBe(422);
  });

  // 7. Supplying another user's uid or role: "admin" in body does not grant privileges
  it('does not grant privileges if client supplies spoofed uid or role in request', async () => {
    // Client supplies invalid token with spoofed body
    const req = new Request('http://localhost/api/admin/orders', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer spoofed-token',
        'x-user-role': 'admin',
        'x-user-uid': 'admin-uid',
      },
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(401);
  });

  // 8. The old authorization endpoint cannot promote arbitrary users
  it('permanently rejects /api/admin/authorize requests with 404', async () => {
    const req = new Request('http://localhost/api/admin/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 'arbitrary-attacker-uid' }),
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(404);
  });
});

describe('Security & Credential Isolation Audit', () => {
  it('ensures no privileged credentials or private keys are bundled in client assets', () => {
    const vercelAssetsDir = path.resolve(__dirname, '../../.vercel/output/static/assets');
    const cloudflareAssetsDir = path.resolve(__dirname, '../../.output/public/assets');
    const publicAssetsDir = fs.existsSync(vercelAssetsDir) ? vercelAssetsDir : cloudflareAssetsDir;

    if (fs.existsSync(publicAssetsDir)) {
      const files = fs.readdirSync(publicAssetsDir).filter((f) => f.endsWith('.js') || f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);

      const forbiddenSignatures = [
        'BEGIN PRIVATE KEY',
        'BEGIN RSA PRIVATE KEY',
        'private_key_id',
        'FIREBASE_SERVICE_ACCOUNT_KEY',
      ];

      for (const file of files) {
        const content = fs.readFileSync(path.join(publicAssetsDir, file), 'utf-8');
        for (const sig of forbiddenSignatures) {
          expect(content.includes(sig), `Found forbidden secret signature "${sig}" in client file ${file}`).toBe(false);
        }
      }
    }
  });

  it('ensures firestore.rules disables direct client order creation', () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    expect(fs.existsSync(rulesPath)).toBe(true);

    const rules = fs.readFileSync(rulesPath, 'utf-8');

    expect(rules).toMatch(/match \/orders\/\{orderId\}[\s\S]*?allow create:\s*if false;/);
    expect(rules).toMatch(/match \/counters\/\{counterId\}[\s\S]*?allow write:\s*if false;/);
    expect(rules).toMatch(/match \/idempotency_records\/\{recordId\}[\s\S]*?allow read, write:\s*if false;/);
  });
});
