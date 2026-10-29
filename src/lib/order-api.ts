import type { CartLine } from './cart';

export interface CreateOrderParams {
  customer_name: string;
  customer_phone: string;
  type: 'delivery' | 'pickup';
  address?: string;
  branch: 'فرع المطار' | 'فرع المحطة';
  notes?: string;
  lines: CartLine[];
  idempotency_key?: string;
  user_id?: string | null;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  orderNumber: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
}

// --- Order Tracking Types ---

export interface TrackedOrderItem {
  product_id: string;
  name_ar: string;
  name_en?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  size?: { id: string; label: string; price: number };
  extras?: Array<{ id: string; name_ar: string; price: number }>;
}

export interface TrackedOrder {
  order_number: number;
  status: string;
  type: 'delivery' | 'pickup';
  branch: string;
  address?: string;
  items: TrackedOrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  updated_at?: string;
}

export interface TrackOrderResponse {
  success: boolean;
  order: TrackedOrder;
}

/**
 * Track an order by its sequential order number and customer phone.
 * The phone is used as a privacy verification check on the server.
 */
export async function trackOrderByApi(orderNumber: string, phone: string): Promise<TrackOrderResponse> {
  const params = new URLSearchParams({
    orderNumber: orderNumber.replace(/^#/, '').trim(),
    phone: phone.replace(/[\s-]/g, ''),
  });

  const response = await fetch(`/api/orders/track?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error || 'لم يتم العثور على طلب بهذه البيانات، يرجى التأكد من رقم الطلب ورقم الهاتف'
    );
  }

  return data as TrackOrderResponse;
}

export async function submitOrderToApi(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const idempotencyKey =
    params.idempotency_key ||
    `ash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Map CartLine items to server-expected item structure
  const items = params.lines.map((line) => {
    // If the product has a size, reconstruct size_id
    // In Stage 2, size.id was stripped of the prefix, so size_id is `${line.productId}_size_${line.size.id}`
    const size_id = line.size ? `${line.productId}_size_${line.size.id}` : undefined;

    // Extras IDs in CartLine
    const selected_options = line.extras.map((e) => e.id);

    return {
      product_id: line.productId,
      quantity: line.qty,
      size_id,
      selected_options,
    };
  });

  const payload = {
    customer_name: params.customer_name.trim(),
    customer_phone: params.customer_phone.replace(/[\s-]/g, ''),
    type: params.type,
    address: params.type === 'delivery' ? params.address?.trim() : '',
    branch: params.branch,
    notes: params.notes?.trim() || '',
    idempotency_key: idempotencyKey,
    user_id: params.user_id || null,
    items,
  };

  const response = await fetch('/api/orders/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    const errorMsg =
      data?.error ||
      `فشل إرسال الطلب (كود الخطأ: ${response.status}). برجاء المحاولة مرة أخرى.`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    subtotal: data.subtotal,
    deliveryFee: data.deliveryFee,
    total: data.total,
  };
}
