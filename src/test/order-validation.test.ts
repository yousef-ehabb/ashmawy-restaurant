import { describe, expect, it } from 'vitest';
import { orderCreateInputSchema } from '../server/orderValidation';

describe('Order Schema & Input Validation', () => {
  const validBaseOrder = {
    customer_name: 'أحمد محمود',
    customer_phone: '01012345678',
    type: 'delivery' as const,
    address: 'شارع كورنيش النيل، عمارة 4، الدور الثاني، أسوان',
    branch: 'فرع المطار' as const,
    notes: 'بدون شطة',
    idempotency_key: 'test-key-1234',
    items: [
      {
        product_id: 'c1',
        quantity: 2,
        size_id: 'c1_size_large',
        selected_options: ['c1_extra_x-bigtasty'],
      },
    ],
  };

  it('validates a complete, legitimate delivery order', () => {
    const result = orderCreateInputSchema.safeParse(validBaseOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_phone).toBe('01012345678');
      expect(result.data.branch).toBe('فرع المطار');
      expect(result.data.type).toBe('delivery');
    }
  });

  it('normalizes phone numbers with spaces and dashes', () => {
    const withFormattedPhone = {
      ...validBaseOrder,
      customer_phone: '011 5000-0000',
    };
    const result = orderCreateInputSchema.safeParse(withFormattedPhone);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_phone).toBe('01150000000');
    }
  });

  it('rejects invalid Egyptian phone numbers', () => {
    const invalidPhones = [
      '01312345678', // 013 is not a mobile prefix (010, 011, 012, 015 only)
      '0101234567', // 10 digits instead of 11
      '010123456789', // 12 digits
      '0212345678', // Landline
      'invalid-phone',
      '',
    ];

    for (const phone of invalidPhones) {
      const result = orderCreateInputSchema.safeParse({
        ...validBaseOrder,
        customer_phone: phone,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects customer name shorter than 2 characters', () => {
    const result = orderCreateInputSchema.safeParse({
      ...validBaseOrder,
      customer_name: 'أ',
    });
    expect(result.success).toBe(false);
  });

  it('requires address for delivery orders and rejects short addresses', () => {
    const missingAddress = {
      ...validBaseOrder,
      type: 'delivery' as const,
      address: '',
    };
    expect(orderCreateInputSchema.safeParse(missingAddress).success).toBe(false);

    const shortAddress = {
      ...validBaseOrder,
      type: 'delivery' as const,
      address: 'بيت',
    };
    expect(orderCreateInputSchema.safeParse(shortAddress).success).toBe(false);
  });

  it('allows pickup order without delivery address', () => {
    const pickupOrder = {
      ...validBaseOrder,
      type: 'pickup' as const,
      address: '',
    };
    const result = orderCreateInputSchema.safeParse(pickupOrder);
    expect(result.success).toBe(true);
  });

  it('rejects invalid branches outside known Ashmawy branches', () => {
    const invalidBranch = {
      ...validBaseOrder,
      branch: 'فرع القاهرة' as any,
    };
    expect(orderCreateInputSchema.safeParse(invalidBranch).success).toBe(false);
  });

  it('rejects empty items array', () => {
    const emptyItems = {
      ...validBaseOrder,
      items: [],
    };
    expect(orderCreateInputSchema.safeParse(emptyItems).success).toBe(false);
  });

  it('rejects invalid item quantities (0, negative, or > 50)', () => {
    const zeroQty = {
      ...validBaseOrder,
      items: [{ product_id: 'c1', quantity: 0 }],
    };
    expect(orderCreateInputSchema.safeParse(zeroQty).success).toBe(false);

    const negQty = {
      ...validBaseOrder,
      items: [{ product_id: 'c1', quantity: -3 }],
    };
    expect(orderCreateInputSchema.safeParse(negQty).success).toBe(false);

    const excessiveQty = {
      ...validBaseOrder,
      items: [{ product_id: 'c1', quantity: 99 }],
    };
    expect(orderCreateInputSchema.safeParse(excessiveQty).success).toBe(false);
  });
});
