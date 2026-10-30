import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import admin from 'firebase-admin';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin, resetFirebaseAdminForTesting } from '../server/firebaseAdmin';
import { TestDocumentTracker } from './testCleanup';

describe('Database Isolation & Production Safeguards', () => {
  const tracker = new TestDocumentTracker();

  afterAll(async () => {
    const { adminDb } = getFirebaseAdmin();
    await tracker.cleanup(adminDb);
  });

  it('verifies test environment runs strictly against local emulator with isolated project namespace', () => {
    expect(process.env['FIRESTORE_EMULATOR_HOST']).toBeDefined();
    expect(process.env['FIRESTORE_EMULATOR_HOST']).toContain('8081');

    const { adminDb, adminApp } = getFirebaseAdmin();

    // Must strictly be the isolated test suite namespace
    expect(adminDb.projectId).toBe('ashmawy-test-suite');
    expect(adminApp.options.projectId).toBe('ashmawy-test-suite');

    // Must NEVER match the development or production project
    expect(adminDb.projectId).not.toBe('ashmawy-ordering');
  });

  it('confirms documents written to test namespace do not exist in dev/prod namespace', async () => {
    const { adminDb } = getFirebaseAdmin();
    const uniqueDocId = `test_isolation_order_${Date.now()}`;

    // 1. Write document to test suite namespace
    tracker.trackOrder(uniqueDocId);
    await adminDb.collection('orders').doc(uniqueDocId).set({
      customer_name: 'عزل قواعد البيانات التجريبية',
      customer_phone: '01011112222',
      total: 100,
      created_at: new Date().toISOString(),
    });

    // Verify it exists in ashmawy-test-suite
    const testDoc = await adminDb.collection('orders').doc(uniqueDocId).get();
    expect(testDoc.exists).toBe(true);

    // 2. Query development namespace (ashmawy-ordering) directly on emulator
    const devApp = initializeApp({ projectId: 'ashmawy-ordering' }, `iso-check-${Date.now()}`);
    const devDb = getFirestore(devApp);

    try {
      const devDoc = await devDb.collection('orders').doc(uniqueDocId).get();
      // Must NOT exist in development namespace
      expect(devDoc.exists).toBe(false);
    } finally {
      await deleteApp(devApp);
    }
  });

  it('enforces production safeguard: blocks initialization when emulator host is missing', () => {
    const originalEmulatorHost = process.env['FIRESTORE_EMULATOR_HOST'];
    try {
      resetFirebaseAdminForTesting();
      delete process.env['FIRESTORE_EMULATOR_HOST'];

      expect(() => {
        getFirebaseAdmin();
      }).toThrow(/FATAL PRODUCTION SAFEGUARD/);
    } finally {
      process.env['FIRESTORE_EMULATOR_HOST'] = originalEmulatorHost;
      resetFirebaseAdminForTesting();
    }
  });

  it('validates TestDocumentTracker cleans up test documents reliably', async () => {
    const { adminDb } = getFirebaseAdmin();
    const tempTracker = new TestDocumentTracker();
    const tempDocId = `temp_cleanup_doc_${Date.now()}`;

    tempTracker.trackOrder(tempDocId, `key_${tempDocId}`);
    await adminDb.collection('orders').doc(tempDocId).set({
      customer_name: 'طلب للتأكد من الحذف',
      total: 50,
    });
    await adminDb.collection('idempotency_records').doc(`key_${tempDocId}`).set({
      order_id: tempDocId,
    });

    // Verify written
    expect((await adminDb.collection('orders').doc(tempDocId).get()).exists).toBe(true);
    expect((await adminDb.collection('idempotency_records').doc(`key_${tempDocId}`).get()).exists).toBe(true);

    // Run cleanup
    const result = await tempTracker.cleanup(adminDb);
    expect(result.deletedOrders).toBe(1);
    expect(result.deletedKeys).toBe(1);

    // Verify deleted
    expect((await adminDb.collection('orders').doc(tempDocId).get()).exists).toBe(false);
    expect((await adminDb.collection('idempotency_records').doc(`key_${tempDocId}`).get()).exists).toBe(false);
  });
});

