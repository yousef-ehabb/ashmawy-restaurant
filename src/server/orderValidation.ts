import { z } from 'zod';

export const EGYPTIAN_PHONE_REGEX = /^01[0125]\d{8}$/;

export const orderItemInputSchema = z.object({
  product_id: z.string().min(1, 'معرف المنتج مطلوب'),
  quantity: z.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل').max(50, 'الكمية لا يمكن أن تتجاوز 50'),
  size_id: z.string().optional(),
  selected_options: z.array(z.string()).optional().default([]),
  special_instructions: z.string().max(200, 'التعليمات الخاصة طويلة للغاية').optional(),
});

export const orderCreateInputSchema = z
  .object({
    customer_name: z
      .string()
      .trim()
      .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
      .max(100, 'الاسم لا يمكن أن يتجاوز 100 حرف'),
    customer_phone: z
      .string()
      .trim()
      .transform((val) => val.replace(/[\s-]/g, ''))
      .refine((val) => EGYPTIAN_PHONE_REGEX.test(val), {
        message: 'رقم الموبايل يجب أن يكون رقم مصري صحيح (مثال: 01012345678)',
      }),
    type: z.enum(['delivery', 'pickup'], {
      errorMap: () => ({ message: 'نوع الطلب يجب أن يكون إما توصيل أو استلام من الفرع' }),
    }),
    address: z.string().trim().optional().default(''),
    branch: z.enum(['فرع المطار', 'فرع المحطة'], {
      errorMap: () => ({ message: 'يجب اختيار فرع متاح (فرع المطار أو فرع المحطة)' }),
    }),
    notes: z.string().max(500, 'الملاحظات لا يمكن أن تتجاوز 500 حرف').optional().default(''),
    idempotency_key: z.string().trim().optional(),
    user_id: z.string().optional().nullable(),
    items: z.array(orderItemInputSchema).min(1, 'يجب إضافة منتج واحد على الأقل للسلة'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'delivery') {
      if (!data.address || data.address.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['address'],
          message: 'عنوان التوصيل بالتفصيل مطلوب لطلبات التوصيل (5 أحرف على الأقل)',
        });
      }
    }
  });

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateInputSchema>;

export interface VerifiedOrderItem {
  product_id: string;
  name_ar: string;
  name_en?: string | undefined;
  quantity: number;
  unit_price: number;
  total_price: number;
  size?: {
    id: string;
    label: string;
    price: number;
  } | undefined;
  extras: Array<{
    id: string;
    name_ar: string;
    name_en?: string | undefined;
    price: number;
  }>;
  special_instructions?: string | undefined;
}

export interface VerifiedOrderResult {
  items: VerifiedOrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  branch: 'فرع المطار' | 'فرع المحطة';
}
