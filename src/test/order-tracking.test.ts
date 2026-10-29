import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../server/apiRouter';

describe('Order Tracking API & Validation', () => {
  it('rejects unsupported HTTP methods with 405', async () => {
    const req = new Request('http://localhost/api/orders/track', {
      method: 'DELETE',
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects GET /api/orders/track without orderNumber or phone with 400', async () => {
    const req = new Request('http://localhost/api/orders/track', {
      method: 'GET',
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('لم يتم العثور على طلب بهذه البيانات');
  });

  it('rejects GET /api/orders/track with empty orderNumber with 400', async () => {
    const req = new Request('http://localhost/api/orders/track?orderNumber=&phone=01012345678', {
      method: 'GET',
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects POST /api/orders/track with empty body with 400', async () => {
    const req = new Request('http://localhost/api/orders/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

