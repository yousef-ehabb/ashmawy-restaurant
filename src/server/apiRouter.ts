import { z } from 'zod';
import {
  processCreateOrder,
  processUpdateOrderStatus,
  trackOrder,
  OrderValidationError,
} from './orderService';
import { verifyAdminRequest, verifyCustomerRequest, extractVerifiedCustomer } from './auth';
import { getFirebaseAdmin } from './firebaseAdmin';
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  type OperationalControlSettings,
} from '../types/operational';

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
      // Authenticate customer if token provided in Authorization header
      let authenticatedUid: string | null = null;
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader && authHeader.trim().startsWith('Bearer ')) {
        const verified = await extractVerifiedCustomer(request);
        if (verified?.uid) {
          authenticatedUid = verified.uid;
        }
      }

      const body = await request.json().catch(() => ({}));
      const result = await processCreateOrder(body, authenticatedUid);
      return jsonResponse(result, 201);
    } catch (error: any) {
      console.error('[API /api/orders/create] Order creation error:', error);
      const isAuthError = error?.message?.includes('Invalid or expired authentication token');
      const statusCode = isAuthError ? 401 : (error instanceof OrderValidationError ? error.statusCode : 500);
      const message =
        error instanceof OrderValidationError || isAuthError
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

  // 4b. Admin Order Delete Endpoint: POST /api/admin/orders/delete
  if (pathname === '/api/admin/orders/delete') {
    if (method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyAdminRequest(request);
    if (!authResult.authorized) {
      return jsonResponse({ success: false, error: authResult.error }, authResult.statusCode);
    }

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const { orderId, deleteAll } = body;
      const { adminDb } = getFirebaseAdmin();

      if (deleteAll === true || orderId === 'all') {
        const snapshot = await adminDb.collection('orders').get();
        const totalCount = snapshot.size;

        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const chunk = docs.slice(i, i + 400);
          const batch = adminDb.batch();
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }

        // Also clean up idempotency records
        try {
          const idempSnap = await adminDb.collection('idempotency_records').get();
          for (let i = 0; i < idempSnap.docs.length; i += 400) {
            const chunk = idempSnap.docs.slice(i, i + 400);
            const batch = adminDb.batch();
            chunk.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        } catch {}

        return jsonResponse({ success: true, deletedCount: totalCount }, 200);
      }

      if (!orderId || typeof orderId !== 'string') {
        return jsonResponse({ success: false, error: 'Missing orderId or deleteAll flag' }, 400);
      }

      await adminDb.collection('orders').doc(orderId).delete();
      return jsonResponse({ success: true, deletedId: orderId }, 200);
    } catch (err: any) {
      console.error('[API /api/admin/orders/delete] Error deleting orders:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
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

  // 7. Operational Settings Public Endpoint: GET /api/settings/operational
  if (pathname === '/api/settings/operational') {
    if (method !== 'GET') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    try {
      const { adminDb } = getFirebaseAdmin();
      const opDoc = await adminDb.collection('settings').doc('operational_control').get();

      if (!opDoc.exists) {
        // Return default operational settings if not initialized yet
        return jsonResponse(
          {
            success: true,
            settings: DEFAULT_OPERATIONAL_SETTINGS,
            isDefault: true,
          },
          200
        );
      }

      const data = opDoc.data() as OperationalControlSettings;
      const branchesData = data.branches || {};
      const defMatar = DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المطار"]!;
      const defMahatta = DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المحطة"]!;

      // Merge with default to guarantee all expected fields exist
      const mergedSettings: OperationalControlSettings = {
        isSiteOpen: data.isSiteOpen ?? DEFAULT_OPERATIONAL_SETTINGS.isSiteOpen,
        globalClosedMessage: data.globalClosedMessage || DEFAULT_OPERATIONAL_SETTINGS.globalClosedMessage,
        workingHours: {
          start: data.workingHours?.start || DEFAULT_OPERATIONAL_SETTINGS.workingHours.start,
          end: data.workingHours?.end || DEFAULT_OPERATIONAL_SETTINGS.workingHours.end,
          label: data.workingHours?.label || DEFAULT_OPERATIONAL_SETTINGS.workingHours.label,
        },
        branches: {
          "فرع المطار": {
            isOpen: branchesData["فرع المطار"]?.isOpen ?? defMatar.isOpen,
            autoCloseAfterHours: branchesData["فرع المطار"]?.autoCloseAfterHours ?? defMatar.autoCloseAfterHours,
            closedMessage: branchesData["فرع المطار"]?.closedMessage || defMatar.closedMessage,
          },
          "فرع المحطة": {
            isOpen: branchesData["فرع المحطة"]?.isOpen ?? defMahatta.isOpen,
            autoCloseAfterHours: branchesData["فرع المحطة"]?.autoCloseAfterHours ?? defMahatta.autoCloseAfterHours,
            closedMessage: branchesData["فرع المحطة"]?.closedMessage || defMahatta.closedMessage,
          },
        },
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };

      return jsonResponse({ success: true, settings: mergedSettings }, 200);
    } catch (err: any) {
      console.error('[API /api/settings/operational] Error:', err);
      // Fallback gracefully to default settings on error
      return jsonResponse({ success: true, settings: DEFAULT_OPERATIONAL_SETTINGS, fallback: true }, 200);
    }
  }

  // 8. Admin Operational Settings Management: POST /api/admin/settings/operational
  if (pathname === '/api/admin/settings/operational') {
    if (method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyAdminRequest(request);
    if (!authResult.authorized) {
      return jsonResponse({ success: false, error: authResult.error }, authResult.statusCode);
    }

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const { adminDb, FieldValue } = getFirebaseAdmin();
      const opRef = adminDb.collection('settings').doc('operational_control');

      const existingDoc = await opRef.get();
      const existingData = existingDoc.exists ? (existingDoc.data() as OperationalControlSettings) : DEFAULT_OPERATIONAL_SETTINGS;
      const existingBranches = existingData.branches || DEFAULT_OPERATIONAL_SETTINGS.branches;
      const fallbackMatar = DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المطار"]!;
      const fallbackMahatta = DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المحطة"]!;

      // Prepare updated payload
      const updatedSettings: OperationalControlSettings = {
        isSiteOpen: typeof body['isSiteOpen'] === 'boolean' ? body['isSiteOpen'] : existingData.isSiteOpen,
        globalClosedMessage: typeof body['globalClosedMessage'] === 'string' && body['globalClosedMessage'].trim()
          ? body['globalClosedMessage'].trim()
          : existingData.globalClosedMessage,
        workingHours: {
          start: body['workingHours']?.start || existingData.workingHours.start,
          end: body['workingHours']?.end || existingData.workingHours.end,
          label: body['workingHours']?.label || existingData.workingHours.label,
        },
        branches: {
          "فرع المطار": {
            isOpen: typeof body['branches']?.["فرع المطار"]?.isOpen === 'boolean'
              ? body['branches']["فرع المطار"].isOpen
              : (existingBranches["فرع المطار"]?.isOpen ?? fallbackMatar.isOpen),
            autoCloseAfterHours: typeof body['branches']?.["فرع المطار"]?.autoCloseAfterHours === 'boolean'
              ? body['branches']["فرع المطار"].autoCloseAfterHours
              : (existingBranches["فرع المطار"]?.autoCloseAfterHours ?? fallbackMatar.autoCloseAfterHours),
            closedMessage: body['branches']?.["فرع المطار"]?.closedMessage?.trim() ||
              (existingBranches["فرع المطار"]?.closedMessage || fallbackMatar.closedMessage),
          },
          "فرع المحطة": {
            isOpen: typeof body['branches']?.["فرع المحطة"]?.isOpen === 'boolean'
              ? body['branches']["فرع المحطة"].isOpen
              : (existingBranches["فرع المحطة"]?.isOpen ?? fallbackMahatta.isOpen),
            autoCloseAfterHours: typeof body['branches']?.["فرع المحطة"]?.autoCloseAfterHours === 'boolean'
              ? body['branches']["فرع المحطة"].autoCloseAfterHours
              : (existingBranches["فرع المحطة"]?.autoCloseAfterHours ?? fallbackMahatta.autoCloseAfterHours),
            closedMessage: body['branches']?.["فرع المحطة"]?.closedMessage?.trim() ||
              (existingBranches["فرع المحطة"]?.closedMessage || fallbackMahatta.closedMessage),
          },
        },
        updatedAt: new Date().toISOString(),
        updatedBy: authResult.user?.email || authResult.user?.uid || 'admin',
      };

      await opRef.set({
        ...updatedSettings,
        serverTimestamp: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Also mirror the master is_website_open flag to legacy settings/global for backward compatibility
      try {
        const legacyRef = adminDb.collection('settings').doc('global');
        await legacyRef.set({
          is_website_open: updatedSettings.isSiteOpen,
          closed_message: updatedSettings.globalClosedMessage,
          updated_at: new Date().toISOString(),
        }, { merge: true });
      } catch (mirrorErr) {
        console.warn('[API /api/admin/settings/operational] Mirroring to legacy doc failed:', mirrorErr);
      }

      return jsonResponse({ success: true, settings: updatedSettings }, 200);
    } catch (err: any) {
      console.error('[API /api/admin/settings/operational] Error:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
    }
  }

  // 8b. Customer Orders List Endpoint: GET /api/customer/orders
  if (pathname === '/api/customer/orders') {
    if (method !== 'GET') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyCustomerRequest(request);
    if (!authResult.authenticated || !authResult.user?.uid) {
      return jsonResponse({ success: false, error: authResult.error || 'Unauthorized' }, authResult.statusCode);
    }

    const customerUid = authResult.user.uid;

    try {
      const { adminDb } = getFirebaseAdmin();
      // Query both customerUid and user_id for complete backward compatibility
      const [snapCustomerUid, snapUserId] = await Promise.all([
        adminDb.collection('orders').where('customerUid', '==', customerUid).get(),
        adminDb.collection('orders').where('user_id', '==', customerUid).get(),
      ]);

      const docMap = new Map<string, any>();
      snapCustomerUid.docs.forEach((doc) => docMap.set(doc.id, doc));
      snapUserId.docs.forEach((doc) => docMap.set(doc.id, doc));

      const orders = Array.from(docMap.values()).map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          order_number: Number(data['order_number'] ?? data['orderNumber']) || 1000,
          status: data['status'] || 'pending',
          customer_name: String(data['customer_name'] || data['customerName'] || ''),
          customer_phone: String(data['customer_phone'] || data['customerPhone'] || ''),
          address: data['address'] ? String(data['address']) : '',
          type: data['type'] || 'delivery',
          branch: String(data['branch'] || ''),
          notes: data['notes'] ? String(data['notes']) : '',
          items: Array.isArray(data['items']) ? data['items'] : [],
          subtotal: Number(data['subtotal']) || 0,
          delivery_fee: Number(data['delivery_fee'] ?? data['deliveryFee']) || 0,
          total: Number(data['total']) || 0,
          created_at: String(data['created_at'] || ''),
          updated_at: data['updated_at'] ? String(data['updated_at']) : undefined,
        };
      });

      // Sort descending by order number
      orders.sort((a, b) => b.order_number - a.order_number);

      return jsonResponse({ success: true, count: orders.length, orders }, 200);
    } catch (err: any) {
      console.error('[API /api/customer/orders] Error fetching customer orders:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
    }
  }

  // 8c. Customer Profile Endpoint: GET or POST /api/customer/profile
  if (pathname === '/api/customer/profile') {
    if (method !== 'GET' && method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const authResult = await verifyCustomerRequest(request);
    if (!authResult.authenticated || !authResult.user?.uid) {
      return jsonResponse({ success: false, error: authResult.error || 'Unauthorized' }, authResult.statusCode);
    }

    const customerUid = authResult.user.uid;
    const { adminDb, FieldValue } = getFirebaseAdmin();

    try {
      if (method === 'GET') {
        let userDoc = await adminDb.collection('users').doc(customerUid).get();
        if (!userDoc.exists) {
          // Check legacy user_profiles
          const legacyDoc = await adminDb.collection('user_profiles').doc(customerUid).get();
          if (legacyDoc.exists) {
            userDoc = legacyDoc;
          }
        }

        if (userDoc.exists) {
          const data = userDoc.data() as Record<string, any>;
          return jsonResponse({
            success: true,
            profile: {
              uid: customerUid,
              displayName: data['displayName'] || data['name'] || authResult.user.displayName || '',
              email: data['email'] || authResult.user.email || '',
              phone: data['phone'] || '',
              defaultAddress: data['defaultAddress'] || data['address'] || '',
              createdAt: data['createdAt'] || data['created_at'] || new Date().toISOString(),
              updatedAt: data['updatedAt'] || data['updated_at'] || new Date().toISOString(),
            },
          }, 200);
        }

        // Return initial profile if document not yet created
        const initialProfile = {
          uid: customerUid,
          displayName: authResult.user.displayName || '',
          email: authResult.user.email || '',
          phone: '',
          defaultAddress: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Seed doc in Firestore
        await adminDb.collection('users').doc(customerUid).set(initialProfile, { merge: true });

        return jsonResponse({ success: true, profile: initialProfile }, 200);
      }

      if (method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, any>;
        const updatePayload: Record<string, any> = {
          updatedAt: new Date().toISOString(),
          serverTimestamp: FieldValue.serverTimestamp(),
        };

        if (typeof body['displayName'] === 'string') {
          const name = body['displayName'].trim();
          if (name.length >= 2) updatePayload['displayName'] = name;
        }

        if (typeof body['phone'] === 'string') {
          const cleanedPhone = body['phone'].replace(/[\s-]/g, '');
          updatePayload['phone'] = cleanedPhone;
        }

        if (typeof body['defaultAddress'] === 'string') {
          updatePayload['defaultAddress'] = body['defaultAddress'].trim();
        }

        if (authResult.user.email) {
          updatePayload['email'] = authResult.user.email;
        }

        await adminDb.collection('users').doc(customerUid).set(updatePayload, { merge: true });

        // Also sync to legacy user_profiles for consistency
        try {
          await adminDb.collection('user_profiles').doc(customerUid).set(updatePayload, { merge: true });
        } catch {}

        const updatedDoc = await adminDb.collection('users').doc(customerUid).get();
        const data = updatedDoc.data() as Record<string, any>;

        return jsonResponse({
          success: true,
          profile: {
            uid: customerUid,
            displayName: data['displayName'] || '',
            email: data['email'] || authResult.user.email || '',
            phone: data['phone'] || '',
            defaultAddress: data['defaultAddress'] || '',
            createdAt: data['createdAt'] || new Date().toISOString(),
            updatedAt: data['updatedAt'] || new Date().toISOString(),
          },
        }, 200);
      }
    } catch (err: any) {
      console.error('[API /api/customer/profile] Error:', err);
      return jsonResponse({ success: false, error: err.message || 'Internal server error' }, 500);
    }
  }

  // 9. Insecure / Deprecated authorize endpoint: POST /api/admin/authorize -> Disabled
  if (pathname === '/api/admin/authorize') {
    return jsonResponse(
      {
        success: false,
        error: 'This endpoint has been permanently disabled for security.',
      },
      404
    );
  }

  // 10. Fallback for undefined /api/* routes
  return jsonResponse({ success: false, error: `API route not found: ${pathname}` }, 404);
}
