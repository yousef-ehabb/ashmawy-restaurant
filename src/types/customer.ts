export interface CustomerProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  defaultAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomerType = 'registered' | 'guest';

export interface CustomerOrderSummary {
  id: string;
  order_number: number;
  status: string;
  type: 'delivery' | 'pickup';
  branch: string;
  address?: string;
  items: Array<{
    product_id: string;
    name_ar: string;
    name_en?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    size?: { id: string; label: string; price: number };
    extras?: Array<{ id: string; name_ar: string; price: number }>;
  }>;
  subtotal: number;
  delivery_fee: number;
  total: number;
  customer_name: string;
  customer_phone: string;
  customerUid?: string | null;
  customerType?: CustomerType;
  created_at: string;
  updated_at?: string;
}

