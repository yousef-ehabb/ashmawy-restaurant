import { processCreateOrder, processUpdateOrderStatus, OrderValidationError } from './orderService';
import { verifyAdminRequest } from './auth';
import { getFirebaseAdmin } from './firebaseAdmin';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function handleCorsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // 1. Order Creation Endpoint: POST /api/orders/create
  if (pathname === '/api/orders/create') {
    if (method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    try {
      const body = await request.json().catch(() => ({}));
      const result = await processCreateOrder(body);
      return jsonResponse(result, 201);
    } catch (error: any) {
      console.error('[API /api/orders/create] Order creation error:', error);
      const statusCode = error instanceof OrderValidationError ? error.statusCode : 500;
      const message =
        error instanceof OrderValidationError
          ? error.message
          : 'حدث خطأ في معالجة طلبك، يرجى المحاولة مرة أخرى.';
      return jsonResponse({ success: false, error: message }, statusCode);
    }
  }

  // 2. Admin Orders List Endpoint: GET /api/admin/orders
  if (pathname === '/api/admin/orders') {
    if (method !== 'GET') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyAdminRequest(request);
    if (!authResult.authorized) {
      return jsonResponse({ success: false, error: authResult.error }, authResult.statusCode);
    }

    try {
      const { adminDb } = getFirebaseAdmin();
      const snapshot = await adminDb.collection('orders').get();

      const orders = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          order_number: Number(data['order_number']) || 1000,
          status: data['status'] || 'new',
          customer_name: String(data['customer_name'] || ''),
          customer_phone: String(data['customer_phone'] || ''),
          address: data['address'] ? String(data['address']) : '',
          type: data['type'] || 'delivery',
          branch: String(data['branch'] || 'فرع المطار'),
          notes: data['notes'] ? String(data['notes']) : '',
          items: Array.isArray(data['items']) ? data['items'] : [],
          subtotal: Number(data['subtotal']) || 0,
          delivery_fee: Number(data['delivery_fee']) || 0,
          total: Number(data['total']) || 0,
          created_at: String(data['created_at'] || new Date().toISOString()),
          updated_at: data['updated_at'] ? String(data['updated_at']) : undefined,
        };
      });

      // Sort descending by order_number
      orders.sort((a, b) => b.order_number - a.order_number);

      return jsonResponse({ success: true, count: orders.length, orders }, 200);
    } catch (err: any) {
      console.error('[API /api/admin/orders] Error fetching orders:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
    }
  }

  // 3. Admin Order Status Update: POST /api/admin/orders/update
  if (pathname === '/api/admin/orders/update') {
    if (method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyAdminRequest(request);
    if (!authResult.authorized) {
      return jsonResponse({ success: false, error: authResult.error }, authResult.statusCode);
    }

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const { orderId, status, notes } = body;

      const result = await processUpdateOrderStatus({ orderId, status, notes });
      return jsonResponse(result, 200);
    } catch (err: any) {
      console.error('[API /api/admin/orders/update] Error updating order:', err);
      const statusCode = err instanceof OrderValidationError ? err.statusCode : 500;
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, statusCode);
    }
  }

  // 4. Insecure / Deprecated authorize endpoint: POST /api/admin/authorize -> Disabled
  if (pathname === '/api/admin/authorize') {
    return jsonResponse(
      {
        success: false,
        error: 'This endpoint has been permanently disabled for security.',
      },
      404
    );
  }

  // 5. Fallback for undefined /api/* routes
  return jsonResponse({ success: false, error: `API route not found: ${pathname}` }, 404);
}
