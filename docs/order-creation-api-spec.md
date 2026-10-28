# Ashmawy Order Creation API: Security & Integrity Specification (`/api/orders/create`)

## 1. Overview & Threat Model
Direct client order creation is strictly disabled in Firestore security rules (`allow create: if false`). All customer orders MUST pass through the serverless endpoint `/api/orders/create`. This architecture guarantees:
1. **Zero Client Price Trust**: Client-submitted totals or unit prices are discarded. Every item and option is priced from live Firestore catalog snapshots.
2. **Atomic Monotonic Order Numbering**: Sequential order numbers (1001, 1002, ...) are allocated within an atomic Firestore transaction alongside order creation.
3. **Branch & Operating Enforcement**: Only active branches (`فرع المطار`, `فرع المحطة`) and valid catalog items are accepted.
4. **Credential Isolation**: `firebase-admin` and GCP Service Account credentials exist solely in server-side environment variables and are never bundled into client JavaScript.

---

## 2. Server Environment & Runtime Isolation
* **Runtime**: Vercel Serverless Function (Node.js 20+ runtime).
* **Location**: `api/orders/create.ts` (or `/api/orders/create`).
* **SDK**: `firebase-admin` v12+.
* **Credentials Management**:
  * Server reads `FIREBASE_SERVICE_ACCOUNT_KEY` (or `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`).
  * Never prefixed with `VITE_` to ensure Vite never bundles it to client browser assets.
  * Checked by `.gitignore` so secrets are never committed.

---

## 3. Order Processing Pipeline (Step-by-Step)

```
[Customer Client]
       │
       ▼ POST /api/orders/create { items: [...], customer: {...}, branch: "..." }
[Rate Limiter] (IP & Phone based: max 5 orders / 10 mins)
       │
[Request Schema Validation] (Zod schema checking phone, names, branch, item structures)
       │
[Firestore Transaction] ────────────────────────────────────────────────────────┐
       │                                                                        │
       ├─► 1. Read Product Documents & Option Groups for all item IDs           │
       │      Verify:                                                           │
       │      - Product exists & is_available == true                           │
       │      - Product is enabled in the selected branch                      │
       │      - Option group min/max selection constraints are satisfied        │
       │      - Re-compute true unit prices & options deltas                    │
       │                                                                        │
       ├─► 2. Read `settings/global`                                            │
       │      Verify:                                                           │
       │      - is_website_open == true                                         │
       │      - Selected branch is_open == true                                 │
       │      - Subtotal >= min_order_amount                                    │
       │      - Apply authoritative delivery_fee from branch config             │
       │                                                                        │
       ├─► 3. Read `counters/order_counter` within Transaction                  │
       │      - currentNumber = snapshot.data().current_number + 1              │
       │      - Transaction.update(orderCounterRef, { current_number: currentNumber })
       │                                                                        │
       ├─► 4. Generate Order Record within Transaction                          │
       │      - Set order_number: currentNumber                                 │
       │      - Set status: "new"                                               │
       │      - Set subtotal, delivery_fee, total from server calculation       │
       │      - Set created_at: FieldValue.serverTimestamp()                    │
       │      - Transaction.set(orderRef, verifiedOrderData)                    │
       │                                                                        │
       └─► 5. Commit Transaction Atomically ◄───────────────────────────────────┘
       │
       ▼
[Response to Client] 201 Created { success: true, orderId: "...", orderNumber: 1001 }
```

---

## 4. Price & Validation Invariants

### A. Catalog Price Recalculation
```typescript
let calculatedSubtotal = 0;

for (const clientItem of body.items) {
  const productDoc = productSnapshots.get(clientItem.productId);
  if (!productDoc || !productDoc.is_available) {
    throw new ValidationError(`Product ${clientItem.productId} is unavailable`);
  }

  // Verify branch availability
  if (productDoc.branch_availability?.[body.branch] === false) {
    throw new ValidationError(`Product ${productDoc.name_ar} is unavailable at ${body.branch}`);
  }

  let itemPrice = productDoc.price;

  // Validate and price each option group
  if (clientItem.selectedOptions && clientItem.selectedOptions.length > 0) {
    for (const opt of clientItem.selectedOptions) {
      const optionDoc = optionSnapshots.get(opt.optionId);
      if (!optionDoc || !optionDoc.is_active) {
        throw new ValidationError(`Option ${opt.optionId} is invalid`);
      }
      itemPrice += optionDoc.price_delta;
    }
  }

  calculatedSubtotal += itemPrice * clientItem.quantity;
}

const deliveryFee = settingsDoc.branches[body.branch].delivery_fee || settingsDoc.delivery_fee;
const calculatedTotal = calculatedSubtotal + deliveryFee;
```

### B. Atomic Counter Increment
```typescript
await db.runTransaction(async (transaction) => {
  const counterRef = db.doc('counters/order_counter');
  const counterDoc = await transaction.get(counterRef);
  const nextOrderNumber = (counterDoc.data()?.current_number || 1000) + 1;

  transaction.update(counterRef, {
    current_number: nextOrderNumber,
    updated_at: FieldValue.serverTimestamp(),
  });

  const orderRef = db.collection('orders').doc();
  transaction.set(orderRef, {
    id: orderRef.id,
    order_number: nextOrderNumber,
    status: 'new',
    items: verifiedItems,
    subtotal: calculatedSubtotal,
    delivery_fee: deliveryFee,
    total: calculatedTotal,
    branch: body.branch,
    customer_name: body.customer.name,
    customer_phone: body.customer.phone,
    address: body.customer.address,
    user_id: authenticatedUserId || null,
    created_at: FieldValue.serverTimestamp(),
  });

  return { orderId: orderRef.id, orderNumber: nextOrderNumber };
});
```

---

## 5. Client Bundle Safety
1. `firebase-admin` must **only** be imported in files located under `/api/` or `src/server/`.
2. `vite.config.ts` must exclude server directories from browser bundle building.
3. Client uses only `src/lib/firebase.ts` (Firebase Client SDK) with public `VITE_FIREBASE_*` configuration.
