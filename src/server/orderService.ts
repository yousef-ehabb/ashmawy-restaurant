import { getFirebaseAdmin } from './firebaseAdmin.ts';
import {
  orderCreateInputSchema,
  type OrderCreateInput,
  type VerifiedOrderItem,
} from './orderValidation.ts';

interface CachedOrderResponse {
  orderId: string;
  orderNumber: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerPhone: string;
  timestamp: number;
}

const recentOrdersCache = new Map<string, CachedOrderResponse>();
const inFlightPromises = new Map<string, Promise<any>>();

export class OrderValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'OrderValidationError';
    this.statusCode = statusCode;
  }
}

function cleanForFirestore<T>(val: T): T {
  if (val === null || val === undefined) return null as any;
  if (Array.isArray(val)) {
    return val.map((item) => cleanForFirestore(item)) as any;
  }
  if (typeof val === 'object' && !(val instanceof Date) && typeof (val as any).toMillis !== 'function') {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        res[k] = cleanForFirestore(v);
      }
    }
    return res;
  }
  return val;
}

export async function processCreateOrder(rawInput: unknown): Promise<{
  success: true;
  orderId: string;
  orderNumber: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  order: any;
}> {
  // 1. Validate request structure via Zod
  const parseResult = orderCreateInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors.map((e) => e.message).join(' | ');
    throw new OrderValidationError(errorMsg, 400);
  }
  const input: OrderCreateInput = parseResult.data;

  const rawKey = input.idempotency_key?.trim();

  // 2. In-flight deduplication
  if (rawKey && inFlightPromises.has(rawKey)) {
    return await inFlightPromises.get(rawKey)!;
  }

  // 3. Short-term memory cache deduplication (60 seconds)
  // Cross-customer safety: verify that the key belongs to the SAME phone number
  if (rawKey && recentOrdersCache.has(rawKey)) {
    const cached = recentOrdersCache.get(rawKey)!;
    if (Date.now() - cached.timestamp < 60000) {
      if (cached.customerPhone !== input.customer_phone) {
        throw new OrderValidationError(
          'Idempotency key has already been used by another customer or order submission.',
          409
        );
      }
      return {
        success: true,
        orderId: cached.orderId,
        orderNumber: cached.orderNumber,
        subtotal: cached.subtotal,
        deliveryFee: cached.deliveryFee,
        total: cached.total,
        order: null, // Never expose line-item or customer details across requests
      };
    }
  }

  const executionPromise = (async () => {
    const { adminDb, FieldValue } = getFirebaseAdmin();

    // 4. Firestore Idempotency Check
    if (rawKey) {
      try {
        const idempDoc = await adminDb.collection('idempotency_records').doc(rawKey).get();
        if (idempDoc.exists) {
          const data = idempDoc.data() as Record<string, any>;

          // Security check: ensure idempotency key cannot be used by a different customer
          if (data['customer_phone'] && data['customer_phone'] !== input.customer_phone) {
            throw new OrderValidationError(
              'Idempotency key has already been used by another customer or order submission.',
              409
            );
          }
          if (input.user_id && data['user_id'] && data['user_id'] !== input.user_id) {
            throw new OrderValidationError(
              'Idempotency key has already been used by another customer or order submission.',
              409
            );
          }

          const res = {
            success: true as const,
            orderId: String(data['order_id']),
            orderNumber: Number(data['order_number']),
            subtotal: Number(data['subtotal'] ?? 0),
            deliveryFee: Number(data['delivery_fee'] ?? 0),
            total: Number(data['total'] ?? 0),
            order: null, // Never expose customer data or order contents from idempotency lookup
          };
          recentOrdersCache.set(rawKey, {
            ...res,
            customerPhone: input.customer_phone,
            timestamp: Date.now(),
          });
          return res;
        }
      } catch (err) {
        if (err instanceof OrderValidationError) throw err;
        console.warn('[OrderService] Could not check idempotency record:', err);
      }
    }

    // 5. Read Global Settings and Branch Operating State
    const settingsDoc = await adminDb.collection('settings').doc('global').get();
    const settings = settingsDoc.exists ? (settingsDoc.data() as Record<string, any>) : null;

    if (settings) {
      if (settings['is_website_open'] === false) {
        throw new OrderValidationError(
          settings['closed_message'] || 'المطعم مغلق حالياً، نعتذر عن استقبال الطلبات.',
          422
        );
      }
      const branches = settings['branches'] as Record<string, any> | undefined;
      const branchConfig = branches?.[input.branch];
      if (branchConfig && branchConfig['is_open'] === false) {
        throw new OrderValidationError(`نعتذر، ${input.branch} مغلق حالياً.`, 422);
      }
    }

    // 6. Fetch products and options authoritatively from Firestore
    const productIds = Array.from(new Set(input.items.map((i) => i.product_id)));
    const productDocs = await Promise.all(
      productIds.map((id) => adminDb.collection('products').doc(id).get())
    );
    const productMap = new Map<string, Record<string, any>>();
    for (const docSnap of productDocs) {
      if (docSnap.exists) {
        productMap.set(docSnap.id, docSnap.data() as Record<string, any>);
      }
    }

    // Fetch all requested option / size documents
    const optionIds = new Set<string>();
    for (const item of input.items) {
      if (item.size_id) optionIds.add(item.size_id);
      if (item.selected_options) {
        item.selected_options.forEach((optId) => optionIds.add(optId));
      }
    }
    const optionDocs = await Promise.all(
      Array.from(optionIds).map((id) => adminDb.collection('options').doc(id).get())
    );
    const optionMap = new Map<string, Record<string, any>>();
    for (const optSnap of optionDocs) {
      if (optSnap.exists) {
        optionMap.set(optSnap.id, optSnap.data() as Record<string, any>);
      }
    }

    // 7. Validate and authoritatively calculate each item
    let calculatedSubtotal = 0;
    const verifiedItems: VerifiedOrderItem[] = [];

    for (const item of input.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new OrderValidationError(`المنتج ذو المعرف (${item.product_id}) غير موجود بالمنيو.`, 404);
      }
      if (product['is_active'] === false || product['is_available'] === false) {
        throw new OrderValidationError(`المنتج "${product['name_ar']}" غير متاح حالياً.`, 422);
      }
      const branchAvail = product['branch_availability'] as Record<string, boolean> | undefined;
      if (branchAvail?.[input.branch] === false) {
        throw new OrderValidationError(`المنتج "${product['name_ar']}" غير متاح في ${input.branch}.`, 422);
      }

      let baseUnitPrice = Number(product['price']) || 0;
      let verifiedSize: VerifiedOrderItem['size'] = undefined;

      // Validate Size if specified
      if (item.size_id) {
        const sizeDoc = optionMap.get(item.size_id);
        if (!sizeDoc || sizeDoc['product_id'] !== item.product_id || sizeDoc['is_active'] === false) {
          throw new OrderValidationError(`الحجم المختار للمنتج "${product['name_ar']}" غير متاح.`, 422);
        }
        const sizeBranchAvail = sizeDoc['branch_availability'] as Record<string, boolean> | undefined;
        if (sizeBranchAvail?.[input.branch] === false) {
          throw new OrderValidationError(`الحجم المختار للمنتج "${product['name_ar']}" غير متاح في ${input.branch}.`, 422);
        }
        baseUnitPrice = (Number(product['price']) || 0) + (Number(sizeDoc['price_delta']) || 0);
        verifiedSize = {
          id: sizeDoc['id'] || item.size_id,
          label: String(sizeDoc['name_ar']),
          price: baseUnitPrice,
        };
      }

      // Validate Extras
      const verifiedExtras: VerifiedOrderItem['extras'] = [];
      let extrasDeltaSum = 0;

      if (item.selected_options && item.selected_options.length > 0) {
        for (const extraId of item.selected_options) {
          const extraDoc = optionMap.get(extraId);
          if (!extraDoc || extraDoc['product_id'] !== item.product_id || extraDoc['is_active'] === false) {
            throw new OrderValidationError(`الإضافة المختارة (${extraId}) غير متوفرة مع هذا الصنف.`, 422);
          }
          const extraBranchAvail = extraDoc['branch_availability'] as Record<string, boolean> | undefined;
          if (extraBranchAvail?.[input.branch] === false) {
            throw new OrderValidationError(`الإضافة "${extraDoc['name_ar']}" غير متوفرة في ${input.branch}.`, 422);
          }
          const delta = Number(extraDoc['price_delta']) || 0;
          extrasDeltaSum += delta;
          verifiedExtras.push({
            id: extraDoc['id'] || extraId,
            name_ar: String(extraDoc['name_ar']),
            name_en: extraDoc['name_en'] ? String(extraDoc['name_en']) : undefined,
            price: delta,
          });
        }
      }

      const itemUnitPrice = baseUnitPrice + extrasDeltaSum;
      const itemTotalPrice = itemUnitPrice * item.quantity;
      calculatedSubtotal += itemTotalPrice;

      verifiedItems.push({
        product_id: String(product['id'] || item.product_id),
        name_ar: String(product['name_ar']),
        name_en: product['name_en'] ? String(product['name_en']) : undefined,
        quantity: item.quantity,
        unit_price: itemUnitPrice,
        total_price: itemTotalPrice,
        size: verifiedSize,
        extras: verifiedExtras,
        special_instructions: item.special_instructions?.trim() || undefined,
      });
    }

    // 8. Enforce Minimum Order Amount
    const minOrder = Number(settings?.['min_order_amount'] ?? 50);
    if (calculatedSubtotal < minOrder) {
      throw new OrderValidationError(
        `الحد الأدنى للطلب هو ${minOrder} ج.م (الإجمالي الحالي: ${calculatedSubtotal} ج.م)`,
        422
      );
    }

    // 9. Delivery Fee calculation
    let deliveryFee = 0;
    if (input.type === 'delivery') {
      const branches = settings?.['branches'] as Record<string, any> | undefined;
      const branchFee = branches?.[input.branch]?.['delivery_fee'];
      deliveryFee = Number(branchFee ?? settings?.['delivery_fee'] ?? 15);
    }
    const calculatedTotal = calculatedSubtotal + deliveryFee;

    // 10. Atomic Sequential Order Numbering and Order Creation Transaction
    const counterRef = adminDb.collection('counters').doc('order_counter');
    const newOrderRef = adminDb.collection('orders').doc();

    const allocatedNumber = await adminDb.runTransaction(async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentNumber = 1000;
      if (counterSnap.exists) {
        const val = (counterSnap.data() as Record<string, any> | undefined)?.['current_number'];
        if (typeof val === 'number') currentNumber = val;
      }
      const nextNumber = currentNumber + 1;

      // Update counter
      transaction.set(
        counterRef,
        {
          current_number: nextNumber,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Create authoritative order document
      const orderPayload = {
        id: newOrderRef.id,
        order_number: nextNumber,
        status: 'new',
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        address: input.type === 'delivery' ? input.address : '',
        type: input.type,
        branch: input.branch,
        notes: input.notes || '',
        items: verifiedItems,
        subtotal: calculatedSubtotal,
        delivery_fee: deliveryFee,
        total: calculatedTotal,
        idempotency_key: rawKey || null,
        user_id: input.user_id || null,
        created_at: new Date().toISOString(),
        server_timestamp: FieldValue.serverTimestamp(),
      };

      transaction.set(newOrderRef, cleanForFirestore(orderPayload));

      // Write idempotency record if key exists
      if (rawKey) {
        const idempRef = adminDb.collection('idempotency_records').doc(rawKey);
        transaction.set(idempRef, {
          order_id: newOrderRef.id,
          order_number: nextNumber,
          customer_phone: input.customer_phone,
          user_id: input.user_id || null,
          subtotal: calculatedSubtotal,
          delivery_fee: deliveryFee,
          total: calculatedTotal,
          created_at: FieldValue.serverTimestamp(),
        });
      }

      return nextNumber;
    });

    const responseData = {
      success: true as const,
      orderId: newOrderRef.id,
      orderNumber: allocatedNumber,
      subtotal: calculatedSubtotal,
      deliveryFee,
      total: calculatedTotal,
      order: {
        id: newOrderRef.id,
        order_number: allocatedNumber,
        status: 'new',
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        address: input.type === 'delivery' ? input.address : '',
        type: input.type,
        branch: input.branch,
        notes: input.notes || '',
        items: verifiedItems,
        subtotal: calculatedSubtotal,
        delivery_fee: deliveryFee,
        total: calculatedTotal,
        created_at: new Date().toISOString(),
      },
    };

    if (rawKey) {
      recentOrdersCache.set(rawKey, {
        orderId: responseData.orderId,
        orderNumber: responseData.orderNumber,
        subtotal: responseData.subtotal,
        deliveryFee: responseData.deliveryFee,
        total: responseData.total,
        customerPhone: input.customer_phone,
        timestamp: Date.now(),
      });
    }

    return responseData;
  })();

  if (rawKey) {
    inFlightPromises.set(rawKey, executionPromise);
  }

  try {
    return await executionPromise;
  } finally {
    if (rawKey) {
      inFlightPromises.delete(rawKey);
    }
  }
}

export const VALID_ORDER_STATUSES = [
  'new',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = typeof VALID_ORDER_STATUSES[number];

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function processUpdateOrderStatus(params: {
  orderId: string;
  status: string;
  notes?: string | undefined;
}): Promise<{ success: true; orderId: string; status: OrderStatus }> {
  const { orderId, status, notes } = params;

  if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
    throw new OrderValidationError('Missing or invalid orderId', 400);
  }

  if (!VALID_ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new OrderValidationError(
      `Invalid status "${status}". Allowed values: ${VALID_ORDER_STATUSES.join(', ')}`,
      422
    );
  }

  const targetStatus = status as OrderStatus;

  // Validate notes
  if (notes !== undefined && typeof notes !== 'string') {
    throw new OrderValidationError('Kitchen notes must be a string', 400);
  }
  if (notes && notes.length > 500) {
    throw new OrderValidationError('Kitchen notes must not exceed 500 characters', 400);
  }

  const { adminDb, FieldValue } = getFirebaseAdmin();
  const orderRef = adminDb.collection('orders').doc(orderId);
  const existing = await orderRef.get();

  if (!existing.exists) {
    throw new OrderValidationError(`Order not found (${orderId})`, 404);
  }

  const orderData = existing.data() as Record<string, any>;
  const currentStatus = (orderData['status'] || 'new') as OrderStatus;

  // Validate status transition
  if (currentStatus !== targetStatus) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new OrderValidationError(
        `Cannot transition order from status "${currentStatus}" to "${targetStatus}". Allowed next statuses: ${allowed.length ? allowed.join(', ') : 'none (terminal status)'}`,
        422
      );
    }
  }

  const updatePayload: Record<string, any> = {
    status: targetStatus,
    updated_at: new Date().toISOString(),
    server_updated_at: FieldValue.serverTimestamp(),
  };

  if (notes !== undefined) {
    updatePayload['kitchen_notes'] = notes.trim();
  }

  await orderRef.update(updatePayload);

  return {
    success: true,
    orderId,
    status: targetStatus,
  };
}
