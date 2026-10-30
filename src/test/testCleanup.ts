import type { Firestore } from 'firebase-admin/firestore';

export class TestDocumentTracker {
  private orderIds = new Set<string>();
  private idempotencyKeys = new Set<string>();
  private genericDocs = new Map<string, Set<string>>();

  trackOrder(orderId?: string | null, idempotencyKey?: string | null): void {
    if (orderId && typeof orderId === 'string') {
      this.orderIds.add(orderId);
    }
    if (idempotencyKey && typeof idempotencyKey === 'string') {
      this.idempotencyKeys.add(idempotencyKey);
    }
  }

  trackDoc(collectionName: string, docId: string): void {
    if (!collectionName || !docId) return;
    if (!this.genericDocs.has(collectionName)) {
      this.genericDocs.set(collectionName, new Set());
    }
    this.genericDocs.get(collectionName)!.add(docId);
  }

  getTrackedOrderIds(): string[] {
    return Array.from(this.orderIds);
  }

  getTrackedKeys(): string[] {
    return Array.from(this.idempotencyKeys);
  }

  async cleanup(db: Firestore): Promise<{ deletedOrders: number; deletedKeys: number; deletedDocs: number }> {
    let deletedOrders = 0;
    let deletedKeys = 0;
    let deletedDocs = 0;

    // 1. Delete tracked orders
    if (this.orderIds.size > 0) {
      const batch = db.batch();
      for (const orderId of this.orderIds) {
        batch.delete(db.collection('orders').doc(orderId));
        deletedOrders++;
      }
      await batch.commit().catch((err) => {
        console.warn('[testCleanup] Error batch-deleting orders:', err.message);
      });
      this.orderIds.clear();
    }

    // 2. Delete tracked idempotency records
    if (this.idempotencyKeys.size > 0) {
      const batch = db.batch();
      for (const key of this.idempotencyKeys) {
        batch.delete(db.collection('idempotency_records').doc(key));
        deletedKeys++;
      }
      await batch.commit().catch((err) => {
        console.warn('[testCleanup] Error batch-deleting idempotency records:', err.message);
      });
      this.idempotencyKeys.clear();
    }

    // 3. Delete other generic tracked documents
    for (const [colName, ids] of this.genericDocs.entries()) {
      if (ids.size > 0) {
        const batch = db.batch();
        for (const id of ids) {
          batch.delete(db.collection(colName).doc(id));
          deletedDocs++;
        }
        await batch.commit().catch((err) => {
          console.warn(`[testCleanup] Error batch-deleting ${colName}:`, err.message);
        });
        ids.clear();
      }
    }
    this.genericDocs.clear();

    return { deletedOrders, deletedKeys, deletedDocs };
  }
}

