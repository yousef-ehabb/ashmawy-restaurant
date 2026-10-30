import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { handleApiRequest } from '../server/apiRouter';
import { setTokenVerifierForTesting, type TokenVerifier } from '../server/auth';
import { getFirebaseAdmin } from '../server/firebaseAdmin';
import { DEFAULT_OPERATIONAL_SETTINGS } from '../types/operational';
import { TestDocumentTracker } from './testCleanup';

// Point tests to local emulator in isolated namespace
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8081';
process.env['FIREBASE_PROJECT_ID'] = 'ashmawy-test-suite';

describe('Customer Authentication & Account System Tests', () => {
  const tracker = new TestDocumentTracker();
  const customerA = {
    uid: 'customer_test_user_a',
    email: 'customera@test.com',
    displayName: 'أحمد محمود',
    token: 'token_customer_a',
  };

  const customerB = {
    uid: 'customer_test_user_b',
    email: 'customerb@test.com',
    displayName: 'سارة إبراهيم',
    token: 'token_customer_b',
  };

  const adminUser = {
    uid: 'admin_test_user',
    email: 'admin@ashmawy.com',
    role: 'admin',
    token: 'token_admin',
  };

  beforeAll(async () => {
    // Mock token verifier for testing server verification
    const mockVerifier: TokenVerifier = async (token: string) => {
      if (token === customerA.token) {
        return {
          uid: customerA.uid,
          email: customerA.email,
          name: customerA.displayName,
          email_verified: true,
        };
      }
      if (token === customerB.token) {
        return {
          uid: customerB.uid,
          email: customerB.email,
          name: customerB.displayName,
          email_verified: true,
        };
      }
      if (token === adminUser.token) {
        return {
          uid: adminUser.uid,
          email: adminUser.email,
          role: 'admin',
          email_verified: true,
        };
      }
      throw new Error('Invalid or expired ID token');
    };

    setTokenVerifierForTesting(mockVerifier);

    const { adminDb } = getFirebaseAdmin();

    // Verify isolation: must never connect to live production or default dev project
    expect(adminDb.projectId).toBe('ashmawy-test-suite');

    // 0. Ensure branches are open in operational control
    await adminDb.collection('settings').doc('operational_control').set({
      ...DEFAULT_OPERATIONAL_SETTINGS,
      branches: {
        'فرع المطار': {
          isOpen: true,
          autoCloseAfterHours: false,
          closedMessage: '',
        },
        'فرع المحطة': {
          isOpen: true,
          autoCloseAfterHours: false,
          closedMessage: '',
        },
      },
    });
    tracker.trackDoc('settings', 'operational_control');

    // 1. Seed global settings
    await adminDb.collection('settings').doc('global').set({
      is_website_open: true,
      min_order_amount: 50,
      delivery_fee: 15,
      branches: {
        'فرع المطار': { is_open: true, delivery_fee: 15 },
        'فرع المحطة': { is_open: true, delivery_fee: 20 },
      },
    });
    tracker.trackDoc('settings', 'global');

    // 2. Seed test product
    await adminDb.collection('products').doc('auth_test_burger').set({
      id: 'auth_test_burger',
      name_ar: 'ساندوتش كريسبي دبل',
      price: 85,
      is_active: true,
      is_available: true,
      category_id: 'sandwiches',
      branch_availability: {
        'فرع المطار': true,
        'فرع المحطة': true,
      },
    });
    tracker.trackDoc('products', 'auth_test_burger');
    tracker.trackDoc('users', customerA.uid);
    tracker.trackDoc('users', customerB.uid);
    tracker.trackDoc('admins', adminUser.uid);
  });

  afterAll(async () => {
    setTokenVerifierForTesting(null);
    const { adminDb } = getFirebaseAdmin();
    await tracker.cleanup(adminDb);
  });

  // 1. Guest Completes Checkout Successfully
  it('Scenario 1: Guest completes checkout successfully with customerType=guest', async () => {
    const guestPayload = {
      customer_name: 'كريم زائر',
      customer_phone: '01011112222',
      type: 'delivery',
      address: 'أسوان - أطلس - بجوار مدرسة التجارة',
      branch: 'فرع المطار',
      idempotency_key: `guest_order_${Date.now()}`,
      items: [
        {
          product_id: 'auth_test_burger',
          quantity: 1,
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guestPayload),
    });

    const res = await handleApiRequest(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    tracker.trackOrder(body.orderId, guestPayload.idempotency_key);
    expect(body.success).toBe(true);
    expect(body.orderNumber).toBeGreaterThan(1000);

    // Verify in Firestore that order is associated as guest
    const { adminDb } = getFirebaseAdmin();
    const orderDoc = await adminDb.collection('orders').doc(body.orderId).get();
    expect(orderDoc.exists).toBe(true);
    const data = orderDoc.data();
    expect(data?.customerType).toBe('guest');
    expect(data?.customerUid).toBeNull();
    expect(data?.user_id).toBeNull();
  });

  // 2. Reject Client Attempting to Spoof UID Without Valid Token
  it('Security: Untrusted customerUid or user_id supplied in body without valid token is nullified', async () => {
    const maliciousPayload = {
      customer_name: 'مهاجم يحاول انتحال هوية',
      customer_phone: '01022223333',
      type: 'delivery',
      address: 'أسوان - كورنيش النيل',
      branch: 'فرع المطار',
      user_id: 'victim_user_uid_123',
      customerUid: 'victim_user_uid_123',
      idempotency_key: `spoof_attempt_${Date.now()}`,
      items: [{ product_id: 'auth_test_burger', quantity: 1 }],
    };

    const req = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // No Authorization header!
      body: JSON.stringify(maliciousPayload),
    });

    const res = await handleApiRequest(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    tracker.trackOrder(body.orderId);

    const { adminDb } = getFirebaseAdmin();
    const orderDoc = await adminDb.collection('orders').doc(body.orderId).get();
    const data = orderDoc.data();
    // Must NOT trust the client-supplied victim UID!
    expect(data?.customerUid).toBeNull();
    expect(data?.user_id).toBeNull();
    expect(data?.customerType).toBe('guest');
  });

  // 3. Reject Order Creation When Invalid Bearer Token Is Provided
  it('Security: Rejects order creation with 401 when invalid Bearer token is provided', async () => {
    const req = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid_fake_token',
      },
      body: JSON.stringify({
        customer_name: 'عميل برمز غير صالح',
        customer_phone: '01033334444',
        type: 'pickup',
        branch: 'فرع المطار',
        items: [{ product_id: 'auth_test_burger', quantity: 1 }],
      }),
    });

    const res = await handleApiRequest(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // 4. Authenticated Customer A Completes Order
  it('Scenario 6: Authenticated customer A completes an order associated with their UID', async () => {
    const authOrderPayload = {
      customer_name: customerA.displayName,
      customer_phone: '01055556666',
      type: 'delivery',
      address: 'أسوان - شارع أطلس - عمارة ٤',
      branch: 'فرع المطار',
      idempotency_key: `cust_a_order_${Date.now()}`,
      items: [{ product_id: 'auth_test_burger', quantity: 2 }],
    };

    const req = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`,
      },
      body: JSON.stringify(authOrderPayload),
    });

    const res = await handleApiRequest(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    tracker.trackOrder(body.orderId, authOrderPayload.idempotency_key);
    expect(body.success).toBe(true);

    const { adminDb } = getFirebaseAdmin();
    const orderDoc = await adminDb.collection('orders').doc(body.orderId).get();
    const data = orderDoc.data();
    expect(data?.customerUid).toBe(customerA.uid);
    expect(data?.user_id).toBe(customerA.uid);
    expect(data?.customerType).toBe('registered');
  });

  // 5. Authenticated Customer B Completes Order
  it('Authenticated customer B completes order associated with B UID', async () => {
    const req = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerB.token}`,
      },
      body: JSON.stringify({
        customer_name: customerB.displayName,
        customer_phone: '01277778888',
        type: 'pickup',
        branch: 'فرع المحطة',
        idempotency_key: `cust_b_order_${Date.now()}`,
        items: [{ product_id: 'auth_test_burger', quantity: 1 }],
      }),
    });

    const res = await handleApiRequest(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    tracker.trackOrder(body.orderId);

    const { adminDb } = getFirebaseAdmin();
    const orderDoc = await adminDb.collection('orders').doc(body.orderId).get();
    const data = orderDoc.data();
    expect(data?.customerUid).toBe(customerB.uid);
    expect(data?.customerType).toBe('registered');
  });

  // 6. Customer Sees Their Own Order History (Scenarios 7 & 8)
  it('Scenario 7 & 8: Customer A sees only their own orders; cannot access Customer B orders', async () => {
    // Customer A queries /api/customer/orders
    const reqA = new Request('http://localhost:3000/api/customer/orders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerA.token}`,
      },
    });

    const resA = await handleApiRequest(reqA);
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);
    expect(bodyA.orders.length).toBeGreaterThanOrEqual(1);

    // All returned orders must belong strictly to customer A
    const { adminDb } = getFirebaseAdmin();
    for (const ord of bodyA.orders) {
      const snap = await adminDb.collection('orders').doc(ord.id).get();
      const ordData = snap.data();
      expect(ordData?.customerUid === customerA.uid || ordData?.user_id === customerA.uid).toBe(true);
      expect(ordData?.customerUid).not.toBe(customerB.uid);
    }

    // Customer B queries /api/customer/orders
    const reqB = new Request('http://localhost:3000/api/customer/orders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerB.token}`,
      },
    });

    const resB = await handleApiRequest(reqB);
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.success).toBe(true);

    for (const ord of bodyB.orders) {
      const snap = await adminDb.collection('orders').doc(ord.id).get();
      const ordData = snap.data();
      expect(ordData?.customerUid === customerB.uid || ordData?.user_id === customerB.uid).toBe(true);
      expect(ordData?.customerUid).not.toBe(customerA.uid);
    }
  });

  // 7. Unauthenticated User Blocked From Customer Orders API
  it('Security: GET /api/customer/orders rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost:3000/api/customer/orders', {
      method: 'GET',
    });

    const res = await handleApiRequest(req);
    expect(res.status).toBe(401);
  });

  // 8. Customer Profile Management (GET & POST /api/customer/profile)
  it('Scenario 4 & Profile: Customer can read and update their profile data', async () => {
    // 1. Initial GET
    const getReq = new Request('http://localhost:3000/api/customer/profile', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerA.token}` },
    });
    const getRes = await handleApiRequest(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    expect(getBody.profile.uid).toBe(customerA.uid);

    // 2. Update profile
    const updateReq = new Request('http://localhost:3000/api/customer/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerA.token}`,
      },
      body: JSON.stringify({
        displayName: 'أحمد محمود المحدث',
        phone: '01099998888',
        defaultAddress: 'أسوان - شارع أطلس الجديد - عمارة ٧',
      }),
    });

    const updateRes = await handleApiRequest(updateReq);
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
    expect(updateBody.profile.displayName).toBe('أحمد محمود المحدث');
    expect(updateBody.profile.phone).toBe('01099998888');
    expect(updateBody.profile.defaultAddress).toBe('أسوان - شارع أطلس الجديد - عمارة ٧');

    // 3. Verify in Firestore `users/{uid}`
    const { adminDb } = getFirebaseAdmin();
    const userDoc = await adminDb.collection('users').doc(customerA.uid).get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()?.displayName).toBe('أحمد محمود المحدث');
    expect(userDoc.data()?.phone).toBe('01099998888');
  });

  // 9. Existing Admin Order Management Still Works (Scenario 10)
  it('Scenario 10: Existing admin order management fetches both guest and registered orders', async () => {
    const adminReq = new Request('http://localhost:3000/api/admin/orders', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminUser.token}` },
    });

    const res = await handleApiRequest(adminReq);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orders.length).toBeGreaterThanOrEqual(2);

    // Both registered and guest orders exist in admin list
    const hasRegistered = body.orders.some((o: any) => o.customer_name === customerA.displayName);
    const hasGuest = body.orders.some((o: any) => o.customer_name === 'كريم زائر');
    expect(hasRegistered).toBe(true);
    expect(hasGuest).toBe(true);
  });

  // 10. Missing Phone or Address Validation (Scenario 5)
  it('Scenario 5: Delivery order rejects missing or invalid phone and address', async () => {
    // Missing address for delivery
    const badAddressReq = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'عميل تجربة',
        customer_phone: '01012345678',
        type: 'delivery',
        address: 'قصر', // < 5 chars
        branch: 'فرع المطار',
        items: [{ product_id: 'auth_test_burger', quantity: 1 }],
      }),
    });

    const res1 = await handleApiRequest(badAddressReq);
    expect(res1.status).toBe(400);

    // Invalid phone number
    const badPhoneReq = new Request('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'عميل تجربة',
        customer_phone: '12345', // invalid phone
        type: 'delivery',
        address: 'أسوان - شارع أطلس',
        branch: 'فرع المطار',
        items: [{ product_id: 'auth_test_burger', quantity: 1 }],
      }),
    });

    const res2 = await handleApiRequest(badPhoneReq);
    expect(res2.status).toBe(400);
  });
});

