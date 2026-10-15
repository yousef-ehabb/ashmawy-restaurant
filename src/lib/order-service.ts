import { restaurant } from "@/config/restaurant";
import type { CartLine } from "@/lib/cart";

export interface OrderDetails {
  name: string;
  phone: string;
  orderType: "delivery" | "pickup";
  address: string;
  branch?: string | undefined;
  notes?: string;
}

export const isWhatsappEnabled = () => restaurant.whatsappNumber.trim().length > 0;

export function buildOrderMessage(d: OrderDetails, lines: CartLine[], subtotal: number) {
  const fee = d.orderType === "delivery" ? restaurant.deliveryFee : 0;
  const rows = lines.map((l) => {
    const size = l.size ? ` (${l.size.label})` : "";
    const ex = l.extras.length ? `\n   + إضافات: ${l.extras.map((e) => e.nameAr).join("، ")}` : "";
    return `• ${l.qty} × ${l.nameAr}${size} = ${l.qty * l.unitPrice} ج.م${ex}`;
  });
  const parts = [
    `طلب جديد من موقع ${restaurant.nameAr}`,
    "",
    `الاسم: ${d.name}`,
    `الموبايل: ${d.phone}`,
    `نوع الطلب: ${d.orderType === "delivery" ? "توصيل" : "استلام من الفرع"}`,
    d.orderType === "delivery" ? `العنوان: ${d.address}` : `الفرع: ${d.branch ?? ""}`,
    d.notes ? `ملاحظات: ${d.notes}` : "",
    "",
    "الطلبات:",
    ...rows,
    "",
    `الإجمالي الفرعي: ${subtotal} ج.م`,
    d.orderType === "delivery"
      ? fee == null
        ? "التوصيل: يُحدد عند التأكيد"
        : `التوصيل: ${fee} ج.م`
      : "",
    `الإجمالي: ${subtotal + (fee ?? 0)} ج.م${d.orderType === "delivery" && fee == null ? " + التوصيل" : ""}`,
  ];
  return parts.filter((p, i) => p !== "" || parts[i - 1] !== "").join("\n");
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${restaurant.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
