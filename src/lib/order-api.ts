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
