import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getFirebaseAdmin } from '../server/firebaseAdmin';
import { processCreateOrder, OrderValidationError } from '../server/orderService';
import { DEFAULT_OPERATIONAL_SETTINGS } from '../types/operational';
import { TestDocumentTracker } from './testCleanup';

// Ensure tests communicate with the local emulator in an isolated namespace
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8081';
process.env['FIREBASE_PROJECT_ID'] = 'ashmawy-test-suite';

describe('Authoritative Server-Side Order Creation Engine', () => {
  const tracker = new TestDocumentTracker();

  beforeAll(async () => {
    const { adminDb } = getFirebaseAdmin();

    // Verify isolation: must never connect to live production or default dev project
    expect(adminDb.projectId).toBe('ashmawy-test-suite');

    // 0. Seed Operational Control Settings to ensure branches are open
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

    // 1. Seed Global Settings
    await adminDb.collection('settings').doc('global').set({
      is_website_open: true,
      closed_message: 'المطعم مغلق حالياً',
      min_order_amount: 50,
      delivery_fee: 15,
      branches: {
        'فرع المطار': {
          is_open: true,
          delivery_fee: 15,
          phone: '01150000000',
        },
        'فرع المحطة': {
          is_open: true,
          delivery_fee: 20,
          phone: '01150000001',
        },
      },
    });

    // 2. Seed Order Counter starting at 2000
    await adminDb.collection('counters').doc('order_counter').set({
      current_number: 2000,
      updated_at: new Date().toISOString(),
    });

    // 3. Seed Active Product available only in فرع المطار
    await adminDb.collection('products').doc('test_crepe').set({
      id: 'test_crepe',
      name_ar: 'كريب سوبر كرانشي',
      name_en: 'Super Crunchy Crepe',
      price: 80,
      is_active: true,
      is_available: true,
      category_id: 'crepes',
      branch_availability: {
        'فرع المطار': true,
        'فرع المحطة': false,
      },
    });

    // 4. Seed Inactive Product
    await adminDb.collection('products').doc('test_inactive_crepe').set({
      id: 'test_inactive_crepe',
      name_ar: 'كريب لحمة بلدي',
      price: 110,
      is_active: false,
      is_available: true,
      category_id: 'crepes',
    });

    // 5. Seed Low Price Product for Minimum-Order testing
    await adminDb.collection('products').doc('test_sauce').set({
      id: 'test_sauce',
      name_ar: 'صوص رانش',
      price: 15,
      is_active: true,
      is_available: true,
      category_id: 'sides',
    });

    // 6. Seed Option: Size Large (+20)
    await adminDb.collection('options').doc('test_crepe_size_large').set({
      id: 'test_crepe_size_large',
      product_id: 'test_crepe',
      group_id: 'test_crepe_sizes',
      name_ar: 'لارج',
      price_delta: 20,
      is_active: true,
      branch_availability: {
        'فرع المطار': true,
        'فرع المحطة': true,
      },
    });

    // 7. Seed Option: Extra Cheese (+15)
    await adminDb.collection('options').doc('test_crepe_extra_cheese').set({
      id: 'test_crepe_extra_cheese',
      product_id: 'test_crepe',
      group_id: 'test_crepe_extras',
      name_ar: 'جبنة زيادة',
      price_delta: 15,
      is_active: true,
      branch_availability: {
        'فرع المطار': true,
        'فرع المحطة': true,
      },
    });

    tracker.trackDoc('settings', 'operational_control');
    tracker.trackDoc('settings', 'global');
    tracker.trackDoc('counters', 'order_counter');
    tracker.trackDoc('products', 'test_crepe');
    tracker.trackDoc('products', 'test_inactive_crepe');
    tracker.trackDoc('products', 'test_unavailable_crepe');
    tracker.trackDoc('options', 'test_crepe_size_large');
    tracker.trackDoc('options', 'test_crepe_extra_cheese');
  });

  afterAll(async () => {
    const { adminDb } = getFirebaseAdmin();
    await tracker.cleanup(adminDb);
  });

  it('authoritatively calculates prices and creates order with sequential numbering', async () => {
    const input = {
      customer_name: 'محمد خالد',
      customer_phone: '01212345678',
      type: 'delivery',
      address: 'شارع أطلس، أسوان',
      branch: 'فرع المطار',
      idempotency_key: 'test_unique_key_001',
      items: [
        {
          product_id: 'test_crepe',
          quantity: 2,
          size_id: 'test_crepe_size_large', // 80 + 20 = 100
          selected_options: ['test_crepe_extra_cheese'], // + 15 = 115 per unit
        },
      ],
      // Tampered client values attempting to pay less
      subtotal: 10,
      delivery_fee: 0,
      total: 10,
    };

    const res = await processCreateOrder(input);
    tracker.trackOrder(res.orderId, input.idempotency_key);

    expect(res.success).toBe(true);
    // 115 * 2 = 230
    expect(res.subtotal).toBe(230);
    // Branch delivery fee for فرع المطار is 15
    expect(res.deliveryFee).toBe(15);
    // Total = 230 + 15 = 245
    expect(res.total).toBe(245);
    // Allocated number should be 2001
    expect(res.orderNumber).toBe(2001);

    // Verify document was persisted in Firestore
    const { adminDb } = getFirebaseAdmin();
    const orderDoc = await adminDb.collection('orders').doc(res.orderId).get();
    expect(orderDoc.exists).toBe(true);
    const orderData = orderDoc.data()!;
    expect(orderData['order_number']).toBe(2001);
    expect(orderData['status']).toBe('pending');
    expect(orderData['total']).toBe(245);
  });

  it('allocates strictly monotonic sequential order numbers for subsequent orders', async () => {
    const input = {
      customer_name: 'عمر ياسين',
      customer_phone: '01099887766',
      type: 'pickup',
      branch: 'فرع المطار',
      idempotency_key: 'test_unique_key_002',
      items: [
        {
          product_id: 'test_crepe',
          quantity: 1,
        },
      ],
    };

    const res = await processCreateOrder(input);
    tracker.trackOrder(res.orderId, input.idempotency_key);
    expect(res.success).toBe(true);
    expect(res.orderNumber).toBe(2002);
    // Pickup order has 0 delivery fee
    expect(res.deliveryFee).toBe(0);
    expect(res.total).toBe(80);
  });

  it('enforces idempotency and prevents duplicate orders for repeated submissions', async () => {
    const idempotencyKey = 'test_idempotent_order_003';
    const input = {
      customer_name: 'سارة إبراهيم',
      customer_phone: '01511223344',
      type: 'delivery',
      address: 'عمارات التأمين، أسوان',
      branch: 'فرع المطار',
      idempotency_key: idempotencyKey,
      items: [
        {
          product_id: 'test_crepe',
          quantity: 1,
        },
      ],
    };

    // First attempt creates order
    const firstResult = await processCreateOrder(input);
    tracker.trackOrder(firstResult.orderId, idempotencyKey);
    expect(firstResult.success).toBe(true);
    const originalOrderNumber = firstResult.orderNumber;
    const originalOrderId = firstResult.orderId;

    // Second repeated attempt with identical idempotency_key
    const secondResult = await processCreateOrder(input);
    expect(secondResult.success).toBe(true);
    expect(secondResult.orderId).toBe(originalOrderId);
    expect(secondResult.orderNumber).toBe(originalOrderNumber);

    // Verify only ONE order was written to Firestore
    const { adminDb } = getFirebaseAdmin();
    const querySnap = await adminDb
      .collection('orders')
      .where('idempotency_key', '==', idempotencyKey)
      .get();
    expect(querySnap.size).toBe(1);
  });

  it('rejects orders below configured minimum order amount', async () => {
    const lowValueOrder = {
      customer_name: 'كريم هاني',
      customer_phone: '01011112222',
      type: 'pickup',
      branch: 'فرع المطار',
      idempotency_key: 'test_low_order',
      items: [
        {
          product_id: 'test_sauce', // 15 EGP, min order is 50 EGP
          quantity: 1,
        },
      ],
    };

    await expect(processCreateOrder(lowValueOrder)).rejects.toThrow(OrderValidationError);
  });

  it('rejects orders for inactive or unavailable products', async () => {
    const inactiveOrder = {
      customer_name: 'طارق علي',
      customer_phone: '01022223333',
      type: 'delivery',
      address: 'شارع سعد زغلول، أسوان',
      branch: 'فرع المطار',
      idempotency_key: 'test_inactive_order',
      items: [
        {
          product_id: 'test_inactive_crepe',
          quantity: 1,
        },
      ],
    };

    await expect(processCreateOrder(inactiveOrder)).rejects.toThrow(OrderValidationError);
  });

  it('rejects order when product is disabled in the selected branch', async () => {
    // test_crepe is disabled in فرع المحطة
    const branchDisabledOrder = {
      customer_name: 'هيثم فهمي',
      customer_phone: '01033334444',
      type: 'pickup',
      branch: 'فرع المحطة',
      idempotency_key: 'test_branch_disabled',
      items: [
        {
          product_id: 'test_crepe',
          quantity: 1,
        },
      ],
    };

    await expect(processCreateOrder(branchDisabledOrder)).rejects.toThrow(OrderValidationError);
  });

  it('rejects order with non-existent product ID', async () => {
    const nonExistentProductOrder = {
      customer_name: 'رامي ممدوح',
      customer_phone: '01055556666',
      type: 'pickup',
      branch: 'فرع المطار',
      idempotency_key: 'test_fake_product',
      items: [
        {
          product_id: 'non_existent_product_9999',
          quantity: 1,
        },
      ],
    };

    await expect(processCreateOrder(nonExistentProductOrder)).rejects.toThrow(OrderValidationError);
  });

  it('rejects order with non-existent extra option ID', async () => {
    const fakeOptionOrder = {
      customer_name: 'حازم شريف',
      customer_phone: '01066667777',
      type: 'delivery',
      address: 'شارع أبطال التحرير، أسوان',
      branch: 'فرع المطار',
      idempotency_key: 'test_fake_option',
      items: [
        {
          product_id: 'test_crepe',
          quantity: 1,
          selected_options: ['non_existent_extra_888'],
        },
      ],
    };

    await expect(processCreateOrder(fakeOptionOrder)).rejects.toThrow(OrderValidationError);
  });

  it('allows updating order status and persists in Firestore', async () => {
    const input = {
      customer_name: 'أشرف عبد المنعم',
      customer_phone: '01077778888',
      type: 'delivery',
      address: 'عمارة الأوقاف، أسوان',
      branch: 'فرع المطار',
      idempotency_key: `test_lifecycle_order_${Date.now()}`,
      items: [{ product_id: 'test_crepe', quantity: 1 }],
    };

    const res = await processCreateOrder(input);
    tracker.trackOrder(res.orderId, input.idempotency_key);
    const { adminDb } = getFirebaseAdmin();
    const orderDocRef = adminDb.collection('orders').doc(res.orderId);

    // Initial status is 'pending'
    let docSnap = await orderDocRef.get();
    expect(docSnap.data()?.['status']).toBe('pending');

    // Update status to 'preparing'
    await orderDocRef.update({ status: 'preparing', updated_at: new Date().toISOString() });
    docSnap = await orderDocRef.get();
    expect(docSnap.data()?.['status']).toBe('preparing');

    // Update status to 'ready'
    await orderDocRef.update({ status: 'ready', updated_at: new Date().toISOString() });
    docSnap = await orderDocRef.get();
    expect(docSnap.data()?.['status']).toBe('ready');

    // Update status to 'completed'
    await orderDocRef.update({ status: 'completed', updated_at: new Date().toISOString() });
    docSnap = await orderDocRef.get();
    expect(docSnap.data()?.['status']).toBe('completed');
  });
  it('prevents cross-customer idempotency abuse: rejects duplicate key from different customer', async () => {
    const key = `test_cross_customer_${Date.now()}`;
    const order1 = {
      customer_name: 'Customer One',
      customer_phone: '01011112222',
      type: 'pickup' as const,
      branch: 'فرع المطار' as const,
      idempotency_key: key,
      items: [{ product_id: 'test_crepe', quantity: 1 }],
    };
    const res1 = await processCreateOrder(order1);
    tracker.trackOrder(res1.orderId, key);
    expect(res1.success).toBe(true);

    // Another customer attempts to submit with the same key
    const order2 = {
      customer_name: 'Attacker Two',
      customer_phone: '01099998888', // different phone
      type: 'pickup' as const,
      branch: 'فرع المطار' as const,
      idempotency_key: key,
      items: [{ product_id: 'test_crepe', quantity: 1 }],
    };

    await expect(processCreateOrder(order2)).rejects.toThrowError(
      /Idempotency key has already been used/
    );
  });

  it('ensures failed requests do not create orders or increment order counters', async () => {
    const { adminDb } = getFirebaseAdmin();
    const counterBefore = (await adminDb.collection('counters').doc('order_counter').get()).data()?.['current_number'];
    const ordersCountBefore = (await adminDb.collection('orders').get()).docs.length;

    // Submit invalid order (e.g. invalid product)
    const invalidOrder = {
      customer_name: 'Failed Order Attempt',
      customer_phone: '01012345678',
      type: 'pickup' as const,
      branch: 'فرع المطار' as const,
      items: [{ product_id: 'totally_non_existent_item', quantity: 1 }],
    };

    await expect(processCreateOrder(invalidOrder)).rejects.toThrow();

    const counterAfter = (await adminDb.collection('counters').doc('order_counter').get()).data()?.['current_number'];
    const ordersCountAfter = (await adminDb.collection('orders').get()).docs.length;

    expect(counterAfter).toBe(counterBefore);
    expect(ordersCountAfter).toBe(ordersCountBefore);
  });
});
