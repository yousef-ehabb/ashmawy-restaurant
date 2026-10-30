import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleApiRequest } from '../server/apiRouter';
import {
  setTokenVerifierForTesting,
  ADMIN_ACCOUNTS_MAP,
  ADMIN_EMAILS,
  verifyAdminRequest,
  type TokenVerifier,
} from '../server/auth';
import { processUpdateOrderStatus, OrderValidationError } from '../server/orderService';
import { deriveAdminProfile } from '../routes/admin';

describe('Role-Based Multi-Branch Admin System', () => {
  beforeEach(() => {
    // Setup mock token verifier that resolves token payloads
    const mockVerifier: TokenVerifier = async (token: string) => {
      if (token === 'super-admin-token') {
        return {
          uid: 'super-admin-uid',
          email: 'admin@ashmawy.com',
          role: 'super_admin',
          branch: 'all',
          email_verified: true,
        };
      }
      if (token === 'station-admin-token') {
        return {
          uid: 'station-admin-uid',
          email: 'station_admin@ashmawy.com',
          role: 'branch_admin',
          branch: 'فرع المحطة',
          email_verified: true,
        };
      }
      if (token === 'station-typo-admin-token') {
        return {
          uid: 'station-typo-admin-uid',
          email: 'station_admin@ashmayw.com',
          role: 'branch_admin',
          branch: 'فرع المحطة',
          email_verified: true,
        };
      }
      if (token === 'airport-admin-token') {
        return {
          uid: 'airport-admin-uid',
          email: 'elmatar_st_admin@ashmawy.com',
          role: 'branch_admin',
          branch: 'فرع المطار',
          email_verified: true,
        };
      }
      if (token === 'customer-token') {
        return {
          uid: 'customer-uid',
          email: 'customer@gmail.com',
          role: 'customer',
          email_verified: true,
        };
      }
      throw new Error('Invalid token');
    };

    setTokenVerifierForTesting(mockVerifier);
  });

  afterEach(() => {
    setTokenVerifierForTesting(null);
  });

  describe('1. Accounts & Allowlist Configuration', () => {
    it('has correct configurations for Super Admin and Branch Admins in ADMIN_ACCOUNTS_MAP', () => {
      // Super Admin
      const superAdmin = ADMIN_ACCOUNTS_MAP['admin@ashmawy.com'];
      expect(superAdmin).toBeDefined();
      expect(superAdmin.role).toBe('super_admin');
      expect(superAdmin.branch).toBe('all');
      expect(superAdmin.password).toBe('admin@123456');

      // Station Branch Admin
      const stationAdmin = ADMIN_ACCOUNTS_MAP['station_admin@ashmawy.com'];
      expect(stationAdmin).toBeDefined();
      expect(stationAdmin.role).toBe('branch_admin');
      expect(stationAdmin.branch).toBe('فرع المحطة');
      expect(stationAdmin.password).toBe('admin@123456');

      // Station Branch Typo Alias
      const stationTypo = ADMIN_ACCOUNTS_MAP['station_admin@ashmayw.com'];
      expect(stationTypo).toBeDefined();
      expect(stationTypo.role).toBe('branch_admin');
      expect(stationTypo.branch).toBe('فرع المحطة');

      // Airport Branch Admin
      const airportAdmin = ADMIN_ACCOUNTS_MAP['elmatar_st_admin@ashmawy.com'];
      expect(airportAdmin).toBeDefined();
      expect(airportAdmin.role).toBe('branch_admin');
      expect(airportAdmin.branch).toBe('فرع المطار');
      expect(airportAdmin.password).toBe('admin@123456');
    });

    it('recognizes all admin emails in the ADMIN_EMAILS Set', () => {
      expect(ADMIN_EMAILS.has('admin@ashmawy.com')).toBe(true);
      expect(ADMIN_EMAILS.has('station_admin@ashmayw.com')).toBe(true);
      expect(ADMIN_EMAILS.has('station_admin@ashmawy.com')).toBe(true);
      expect(ADMIN_EMAILS.has('elmatar_st_admin@ashmawy.com')).toBe(true);
    });
  });

  describe('2. Authentication Verification & Identity Scoping', () => {
    it('authenticates Super Admin with role super_admin and branch all', async () => {
      const req = new Request('http://localhost/api/admin/orders', {
        headers: { Authorization: 'Bearer super-admin-token' },
      });
      const res = await verifyAdminRequest(req);
      expect(res.authorized).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.user?.role).toBe('super_admin');
      expect(res.user?.branch).toBe('all');
    });

    it('authenticates Station Branch Admin with role branch_admin and branch فرع المحطة', async () => {
      const req = new Request('http://localhost/api/admin/orders', {
        headers: { Authorization: 'Bearer station-admin-token' },
      });
      const res = await verifyAdminRequest(req);
      expect(res.authorized).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.user?.role).toBe('branch_admin');
      expect(res.user?.branch).toBe('فرع المحطة');
    });

    it('authenticates Station Branch Typo Alias with role branch_admin and branch فرع المحطة', async () => {
      const req = new Request('http://localhost/api/admin/orders', {
        headers: { Authorization: 'Bearer station-typo-admin-token' },
      });
      const res = await verifyAdminRequest(req);
      expect(res.authorized).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.user?.role).toBe('branch_admin');
      expect(res.user?.branch).toBe('فرع المحطة');
    });

    it('authenticates Airport Branch Admin with role branch_admin and branch فرع المطار', async () => {
      const req = new Request('http://localhost/api/admin/orders', {
        headers: { Authorization: 'Bearer airport-admin-token' },
      });
      const res = await verifyAdminRequest(req);
      expect(res.authorized).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.user?.role).toBe('branch_admin');
      expect(res.user?.branch).toBe('فرع المطار');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const req = new Request('http://localhost/api/admin/orders');
      const res = await verifyAdminRequest(req);
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
    });

    it('rejects regular customer requests with 403 Forbidden', async () => {
      const req = new Request('http://localhost/api/admin/orders', {
        headers: { Authorization: 'Bearer customer-token' },
      });
      const res = await verifyAdminRequest(req);
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('3. GET /api/admin/me Endpoint', () => {
    it('returns verified admin identity payload for Station Admin', async () => {
      const req = new Request('http://localhost/api/admin/me', {
        headers: { Authorization: 'Bearer station-admin-token' },
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.admin.role).toBe('branch_admin');
      expect(data.admin.branch).toBe('فرع المحطة');
    });

    it('returns verified admin identity payload for Airport Admin', async () => {
      const req = new Request('http://localhost/api/admin/me', {
        headers: { Authorization: 'Bearer airport-admin-token' },
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.admin.role).toBe('branch_admin');
      expect(data.admin.branch).toBe('فرع المطار');
    });

    it('rejects non-admin requests to /api/admin/me with 403', async () => {
      const req = new Request('http://localhost/api/admin/me', {
        headers: { Authorization: 'Bearer customer-token' },
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(403);
    });
  });

  describe('4. Menu Availability Authorization Enforcement', () => {
    it('rejects branch admin attempting to toggle global availability with 403', async () => {
      const req = new Request('http://localhost/api/admin/menu/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer station-admin-token',
        },
        body: JSON.stringify({
          action: 'toggle_item',
          itemId: 'meal-crispy-strips',
          field: 'global',
          value: false,
        }),
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('global availability');
    });

    it('rejects branch admin attempting to toggle availability for another branch with 403', async () => {
      // Station Admin attempting to disable Airport Branch
      const req = new Request('http://localhost/api/admin/menu/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer station-admin-token',
        },
        body: JSON.stringify({
          action: 'toggle_item',
          itemId: 'meal-crispy-strips',
          field: 'فرع المطار',
          value: false,
        }),
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('other branches');
    });

    it('rejects branch admin attempting to add or delete custom extras with 403', async () => {
      const req = new Request('http://localhost/api/admin/menu/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer airport-admin-token',
        },
        body: JSON.stringify({
          action: 'add_extra',
          extraId: 'x-test',
          nameAr: 'إضافة تجريبية',
          price: 15,
        }),
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(403);
    });
  });

  describe('5. Operational Control Authorization Enforcement', () => {
    it('rejects branch admin attempting to toggle global website open state with 403', async () => {
      const req = new Request('http://localhost/api/admin/settings/operational', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer station-admin-token',
        },
        body: JSON.stringify({
          isSiteOpen: false, // Trying to close the whole restaurant
        }),
      });
      const res = await handleApiRequest(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('global website open status');
    });
  });

  describe('6. Frontend Profile Derivation Logic', () => {
    it('derives station_admin profile correctly', () => {
      const p1 = deriveAdminProfile('station_admin@ashmawy.com');
      expect(p1.role).toBe('branch_admin');
      expect(p1.branch).toBe('فرع المحطة');

      const p2 = deriveAdminProfile('station_admin@ashmayw.com');
      expect(p2.role).toBe('branch_admin');
      expect(p2.branch).toBe('فرع المحطة');
    });

    it('derives elmatar_st_admin profile correctly', () => {
      const p = deriveAdminProfile('elmatar_st_admin@ashmawy.com');
      expect(p.role).toBe('branch_admin');
      expect(p.branch).toBe('فرع المطار');
    });

    it('derives super_admin profile for admin@ashmawy.com', () => {
      const p = deriveAdminProfile('admin@ashmawy.com');
      expect(p.role).toBe('super_admin');
      expect(p.branch).toBe('all');
    });
  });
});

