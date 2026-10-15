import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, AlertTriangle } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatEGP } from "@/data/menu";
import { restaurant } from "@/config/restaurant";
import { buildOrderMessage, isWhatsappEnabled, whatsappUrl, type OrderDetails } from "@/lib/order-service";
import { QtyControl } from "@/components/site/CartDrawer";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب | عشماوي" },
      { name: "description", content: "أكمل بيانات طلبك من عشماوي وابعته على واتساب." },
      { property: "og:title", content: "إتمام الطلب | عشماوي" },
      { property: "og:description", content: "أكمل بيانات طلبك من عشماوي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

type Errors = Partial<Record<"name" | "phone" | "address", string>>;

function Checkout() {
  const { lines, subtotal, setQty } = useCart();
  const [form, setForm] = useState<OrderDetails>({ name: "", phone: "", orderType: "delivery", address: "", branch: restaurant.branches[0]?.label, notes: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const fee = form.orderType === "delivery" ? restaurant.deliveryFee : 0;
  const total = subtotal + (fee ?? 0);
  const set = <K extends keyof OrderDetails>(k: K, v: OrderDetails[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = "من فضلك اكتب اسمك";
    const phone = form.phone.replace(/\s|-/g, "");
    if (!/^01[0125]\d{8}$/.test(phone)) e.phone = "رقم موبايل مصري غير صحيح (مثال: 01012345678)";
    if (form.orderType === "delivery" && form.address.trim().length < 6) e.address = "من فضلك اكتب عنوان التوصيل بالتفصيل";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || !isWhatsappEnabled()) return;
    const msg = buildOrderMessage({ ...form, phone: form.phone.replace(/\s|-/g, "") }, lines, subtotal);
    window.open(whatsappUrl(msg), "_blank", "noopener");
    setSent(true);
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-primary">السلة فاضية</h1>
        <p className="mt-2 text-muted-foreground">ضيف منتجات الأول عشان تكمل طلبك.</p>
        <Link to="/" hash="menu" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">تصفح المنيو</Link>
      </div>
    );
  }

  const field = "w-full rounded-xl border border-input bg-card px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl text-primary sm:text-5xl">إتمام الطلب</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <form onSubmit={submit} noValidate className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7">
          <fieldset>
            <legend className="mb-2 font-bold">نوع الطلب</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["delivery", ...(restaurant.supportsPickup ? ["pickup"] : [])] as const).map((t) => (
                <button type="button" key={t} onClick={() => set("orderType", t as OrderDetails["orderType"])} aria-pressed={form.orderType === t} className={`rounded-xl border py-3 font-bold transition ${form.orderType === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
                  {t === "delivery" ? "توصيل" : "استلام من الفرع"}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="name" className="mb-1.5 block font-bold">الاسم بالكامل *</label>
            <input id="name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} autoComplete="name" />
            {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block font-bold">رقم الموبايل *</label>
            <input id="phone" type="tel" inputMode="numeric" dir="ltr" placeholder="01xxxxxxxxx" className={`${field} text-right`} value={form.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} autoComplete="tel" />
            {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone}</p>}
          </div>
          {form.orderType === "delivery" ? (
            <div>
              <label htmlFor="address" className="mb-1.5 block font-bold">عنوان التوصيل *</label>
              <textarea id="address" rows={2} className={field} value={form.address} onChange={(e) => set("address", e.target.value)} aria-invalid={!!errors.address} placeholder="الشارع، المنطقة، علامة مميزة" />
              {errors.address && <p className="mt-1 text-sm text-destructive">{errors.address}</p>}
            </div>
          ) : (
            <div>
              <label htmlFor="branch" className="mb-1.5 block font-bold">الفرع</label>
              <select id="branch" className={field} value={form.branch} onChange={(e) => set("branch", e.target.value)}>
                {restaurant.branches.map((b) => <option key={b.label} value={b.label}>{b.label} – {b.address}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="notes" className="mb-1.5 block font-bold">ملاحظات <span className="font-normal text-muted-foreground">(اختياري)</span></label>
            <textarea id="notes" rows={2} className={field} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          {!isWhatsappEnabled() && (
            <p className="flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm"><AlertTriangle className="h-4 w-4 text-primary" />الطلب أونلاين مش متاح حاليًا. اتصل بينا على {restaurant.phones[0]}.</p>
          )}
          <button type="submit" disabled={!isWhatsappEnabled()} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-lg font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-50">
            <MessageCircle className="h-5 w-5" />ابعت الطلب على واتساب
          </button>
          {sent && (
            <div className="rounded-xl border border-accent bg-secondary p-4 text-sm leading-7" role="status">
              جهزنا رسالة طلبك في واتساب. <b>الطلب مش متأكد لحد ما تضغط "إرسال" في واتساب</b> ويرد عليك المطعم بالتأكيد.
            </div>
          )}
        </form>

        <aside className="h-fit rounded-3xl bg-secondary p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 text-xl font-extrabold">ملخص الطلب</h2>
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <p className="font-bold">{l.nameAr}{l.size && <span className="text-sm text-muted-foreground"> · {l.size.label}</span>}</p>
                  {l.extras.length > 0 && <p className="text-xs text-muted-foreground">+ {l.extras.map((e) => `${e.nameAr} (${e.price})`).join("، ")}</p>}
                  <div className="mt-1.5"><QtyControl qty={l.qty} onChange={(n) => setQty(l.key, n)} name={l.nameAr} /></div>
                </div>
                <span className="shrink-0 font-bold">{formatEGP(l.qty * l.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>الإجمالي الفرعي</dt><dd className="font-bold">{formatEGP(subtotal)}</dd></div>
            {form.orderType === "delivery" && (
              <div className="flex justify-between"><dt>التوصيل</dt><dd className="font-bold">{fee == null ? "يُحدد عند التأكيد" : formatEGP(fee)}</dd></div>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-lg font-extrabold text-primary"><dt>الإجمالي</dt><dd>{formatEGP(total)}{form.orderType === "delivery" && fee == null && <span className="text-xs text-muted-foreground"> + التوصيل</span>}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
