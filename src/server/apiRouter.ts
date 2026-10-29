import { z } from 'zod';
import {
  processCreateOrder,
  processUpdateOrderStatus,
  trackOrder,
  OrderValidationError,
} from './orderService';
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

const trackOrderSchema = z.object({
  orderNumber: z.string().min(1, 'رقم الطلب مطلوب'),
  phone: z.string().min(1, 'رقم الهاتف مطلوب'),
});

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

  // 2. Order Tracking Endpoint: GET or POST /api/orders/track
  if (pathname === '/api/orders/track') {
    if (method !== 'GET' && method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    try {
      let rawData: { orderNumber?: string; phone?: string } = {};

      if (method === 'GET') {
        rawData = {
          orderNumber: url.searchParams.get('orderNumber') || '',
          phone: url.searchParams.get('phone') || '',
        };
      } else {
        rawData = (await request.json().catch(() => ({}))) as Record<string, any>;
      }

      const parseResult = trackOrderSchema.safeParse(rawData);
      if (!parseResult.success) {
        return jsonResponse(
          {
            success: false,
            error: 'لم يتم العثور على طلب بهذه البيانات، يرجى التأكد من رقم الطلب ورقم الهاتف',
          },
          400
        );
      }

      const result = await trackOrder(parseResult.data.orderNumber, parseResult.data.phone);
      return jsonResponse(result, 200);
    } catch (error: any) {
      const statusCode = error instanceof OrderValidationError ? error.statusCode : 404;
      const message =
        error instanceof OrderValidationError
          ? error.message
          : 'لم يتم العثور على طلب بهذه البيانات، يرجى التأكد من رقم الطلب ورقم الهاتف';
      return jsonResponse({ success: false, error: message }, statusCode);
    }
  }

  // 3. Admin Orders List Endpoint: GET /api/admin/orders
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
          order_number: Number(data['order_number'] ?? data['orderNumber']) || 1000,
          status: data['status'] || 'pending',
          customer_name: String(data['customer_name'] || data['customerName'] || ''),
          customer_phone: String(data['customer_phone'] || data['customerPhone'] || ''),
          address: data['address'] ? String(data['address']) : '',
          type: data['type'] || 'delivery',
          branch: String(data['branch'] || 'فرع المطار'),
          notes: data['notes'] ? String(data['notes']) : '',
          items: Array.isArray(data['items']) ? data['items'] : [],
          subtotal: Number(data['subtotal']) || 0,
          delivery_fee: Number(data['delivery_fee'] ?? data['deliveryFee']) || 0,
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

  // 4. Admin Order Status Update: POST /api/admin/orders/update
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

  // 5. Menu Availability Public Endpoint: GET /api/menu/availability
  if (pathname === '/api/menu/availability') {
    if (method !== 'GET') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    try {
      const { adminDb } = getFirebaseAdmin();
      const availDoc = await adminDb.collection('menu_availability').doc('current').get();

      if (!availDoc.exists) {
        return jsonResponse({ success: true, items: {}, extras: {}, updatedAt: null }, 200);
      }

      const data = availDoc.data() as Record<string, any>;
      return jsonResponse(
        {
          success: true,
          items: data['items'] || {},
          extras: data['extras'] || {},
          updatedAt: data['updated_at'] || null,
        },
        200
      );
    } catch (err: any) {
      console.error('[API /api/menu/availability] Error:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
    }
  }

  // 6. Admin Menu Availability Management: POST /api/admin/menu/availability
  if (pathname === '/api/admin/menu/availability') {
    if (method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyAdminRequest(request);
    if (!authResult.authorized) {
      return jsonResponse({ success: false, error: authResult.error }, authResult.statusCode);
    }

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const { action } = body;

      const { adminDb, FieldValue } = getFirebaseAdmin();
      const availRef = adminDb.collection('menu_availability').doc('current');

      if (action === 'toggle_item') {
        const { itemId, field, value } = body;
        if (!itemId || !field) {
          return jsonResponse({ success: false, error: 'Missing itemId or field' }, 400);
        }

        const updatePath = field === 'global'
          ? `items.${itemId}.isAvailableGlobal`
          : `items.${itemId}.branchAvailability.${field}`;

        await availRef.set(
          {
            [`items.${itemId}`]: field === 'global'
              ? { isAvailableGlobal: Boolean(value), branchAvailability: body['branchAvailability'] || {} }
              : undefined,
            [updatePath]: Boolean(value),
            updated_at: new Date().toISOString(),
          } as any,
          { merge: true }
        );

        // More precise update using dot notation
        if (field !== 'global') {
          await availRef.update({
            [updatePath]: Boolean(value),
            updated_at: new Date().toISOString(),
          });
        } else {
          await availRef.update({
            [`items.${itemId}.isAvailableGlobal`]: Boolean(value),
            updated_at: new Date().toISOString(),
          });
        }

        return jsonResponse({ success: true }, 200);
      }

      if (action === 'toggle_extra') {
        const { extraId, field, value } = body;
        if (!extraId || !field) {
          return jsonResponse({ success: false, error: 'Missing extraId or field' }, 400);
        }

        if (field === 'global') {
          await availRef.set(
            { extras: { [extraId]: { isAvailableGlobal: Boolean(value), branchAvailability: body['branchAvailability'] || {} } } },
            { merge: true }
          );
        } else {
          // Initialize extra record if needed, then update branch
          await availRef.set(
            { extras: { [extraId]: { isAvailableGlobal: true, branchAvailability: {} } } },
            { merge: true }
          );
          await availRef.update({
            [`extras.${extraId}.branchAvailability.${field}`]: Boolean(value),
            updated_at: new Date().toISOString(),
          });
        }

        return jsonResponse({ success: true }, 200);
      }

      if (action === 'bulk_update') {
        const { items, extras } = body;
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (items) updateData['items'] = items;
        if (extras) updateData['extras'] = extras;
        await availRef.set(updateData, { merge: true });
        return jsonResponse({ success: true }, 200);
      }

      if (action === 'add_extra') {
        const { extraId, nameAr, nameEn, price } = body;
        if (!extraId || !nameAr) {
          return jsonResponse({ success: false, error: 'Missing extra data' }, 400);
        }
        // Store custom extra definition
        await adminDb.collection('custom_extras').doc(extraId).set({
          id: extraId,
          name_ar: nameAr,
          name_en: nameEn || '',
          price: Number(price) || 0,
          is_active: true,
          created_at: new Date().toISOString(),
        }, { merge: true });

        // Also set availability
        await availRef.set(
          { extras: { [extraId]: { isAvailableGlobal: true, branchAvailability: {} } } },
          { merge: true }
        );

        return jsonResponse({ success: true }, 200);
      }

      if (action === 'edit_extra') {
        const { extraId, nameAr, nameEn, price } = body;
        if (!extraId) {
          return jsonResponse({ success: false, error: 'Missing extraId' }, 400);
        }
        await adminDb.collection('custom_extras').doc(extraId).update({
          name_ar: nameAr,
          name_en: nameEn || '',
          price: Number(price) || 0,
          updated_at: new Date().toISOString(),
        });
        return jsonResponse({ success: true }, 200);
      }

      if (action === 'delete_extra') {
        const { extraId } = body;
        if (!extraId) {
          return jsonResponse({ success: false, error: 'Missing extraId' }, 400);
        }
        await adminDb.collection('custom_extras').doc(extraId).delete();
        // Remove from availability doc
        await availRef.update({
          [`extras.${extraId}`]: FieldValue.delete(),
          updated_at: new Date().toISOString(),
        });
        return jsonResponse({ success: true }, 200);
      }

      return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
    } catch (err: any) {
      console.error('[API /api/admin/menu/availability] Error:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
    }
  }

  // 7. Insecure / Deprecated authorize endpoint: POST /api/admin/authorize -> Disabled
  if (pathname === '/api/admin/authorize') {
    return jsonResponse(
      {
        success: false,
        error: 'This endpoint has been permanently disabled for security.',
      },
      404
    );
  }

  // 8. Fallback for undefined /api/* routes
  return jsonResponse({ success: false, error: `API route not found: ${pathname}` }, 404);
}
