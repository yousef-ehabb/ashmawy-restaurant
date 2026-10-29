import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  MessageCircle,
  Receipt,
  Store,
  Truck,
  PackageSearch,
} from "lucide-react";
import { useCart, type CartLine } from "@/lib/cart";
import { formatEGP } from "@/data/menu";
import { restaurant } from "@/config/restaurant";
import { submitOrderToApi, type CreateOrderResponse } from "@/lib/order-api";
import { QtyControl } from "@/components/site/CartDrawer";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { useOperationalControl } from "@/hooks/useOperationalControl";
import { StoreClosedScreen } from "@/components/site/StoreClosedScreen";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب | عشماوي" },
      { name: "description", content: "أكمل بيانات طلبك من عشماوي واطلبه أونلاين مباشرة." },
      { property: "og:title", content: "إتمام الطلب | عشماوي" },
      { property: "og:description", content: "أكمل بيانات طلبك من عشماوي واطلبه أونلاين مباشرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

type Errors = Partial<Record<"name" | "phone" | "address" | "branch", string>>;

interface ConfirmedOrderState extends CreateOrderResponse {
  customer_name: string;
  customer_phone: string;
  type: "delivery" | "pickup";
  address: string;
  branch: "فرع المطار" | "فرع المحطة";
  notes?: string;
  items: CartLine[];
  date: string;
}

const LAST_ORDER_KEY = "ashmawy_last_confirmed_order";

function Checkout() {
  const { lines, subtotal, setQty, clear } = useCart();
  const { minOrderAmount, deliveryFee: defaultDeliveryFee, branches: settingsBranches } = useRestaurantSettings();
  const { isStoreAccessible, settings: opSettings, checkBranch } = useOperationalControl();

  const [form, setForm] = useState<{
    name: string;
    phone: string;
    orderType: "delivery" | "pickup";
    address: string;
    branch: "فرع المطار" | "فرع المحطة";
    notes: string;
  }>({
    name: "",
    phone: "",
    orderType: "delivery",
    address: "",
    branch: "فرع المطار",
    notes: "",
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = sessionStorage.getItem(LAST_ORDER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Calculate dynamic delivery fee from settings or default
  const matchedBranch = settingsBranches.find((b) => b.label === form.branch);
  const deliveryFee = form.orderType === "delivery" ? (matchedBranch?.deliveryFee ?? defaultDeliveryFee ?? 15) : 0;
  const total = subtotal + deliveryFee;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof Errors]) {
      setErrors((e) => ({ ...e, [k]: undefined }));
    }
    setSubmitError(null);
  };

  const validate = () => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = "من فضلك اكتب اسمك بالكامل (حرفين على الأقل)";
    const phone = form.phone.replace(/[\s-]/g, "");
    if (!/^01[0125]\d{8}$/.test(phone)) e.phone = "رقم موبايل مصري غير صحيح (مثال: 01012345678)";
    if (form.orderType === "delivery" && form.address.trim().length < 5) {
      e.address = "من فضلك اكتب عنوان التوصيل بالتفصيل (الشارع والمنطقة)";
    }
    if (!form.branch) {
      e.branch = "برجاء اختيار الفرع";
    } else {
      const branchStatus = checkBranch(form.branch);
      if (!branchStatus.isOpen) {
        e.branch = branchStatus.reason || `نعتذر، ${form.branch} مغلق حالياً ولا يمكن استقبال طلبات له.`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    if (lines.length === 0) {
      setSubmitError("السلة فارغة. يرجى إضافة منتجات قبل إتمام الطلب.");
      return;
    }

    const minOrder = minOrderAmount || 50;
    if (subtotal < minOrder) {
      setSubmitError(`الحد الأدنى للطلب هو ${minOrder} ج.م (مجموعك الحالي: ${subtotal} ج.م).`);
      return;
    }

    // Check branch open status before submitting
    const currentBranchStatus = checkBranch(form.branch);
    if (!currentBranchStatus.isOpen) {
      setSubmitError(currentBranchStatus.reason || `نعتذر، ${form.branch} مغلق حالياً.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitOrderToApi({
        customer_name: form.name,
        customer_phone: form.phone,
        type: form.orderType,
        address: form.address,
        branch: form.branch,
        notes: form.notes,
        lines,
      });

      const confirmedData: ConfirmedOrderState = {
        ...response,
        customer_name: form.name,
        customer_phone: form.phone.replace(/[\s-]/g, ""),
        type: form.orderType,
        address: form.address,
        branch: form.branch,
        notes: form.notes,
        items: [...lines],
        date: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };

      // Save confirmed state
      setConfirmedOrder(confirmedData);
      try {
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(confirmedData));
      } catch {
        // ignore
      }

      // Clear the cart only after confirmed successful creation
      clear();
    } catch (err: any) {
      console.error("[Checkout] Order submission failed:", err);
      setSubmitError(err.message || "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION RECEIPT SCREEN
  if (confirmedOrder) {
    const branchLabel = confirmedOrder.branch.startsWith("فرع ")
      ? confirmedOrder.branch
      : `فرع ${confirmedOrder.branch}`;

    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 font-bold text-primary text-sm">
              طلب مؤكد وجاري مراجعته
            </span>
            <h1 className="mt-3 font-display text-4xl text-primary sm:text-5xl">تم استلام طلبك بنجاح!</h1>
            <p className="mt-2 text-muted-foreground">
              شكراً لاختيارك عشماوي. رقم طلبك هو:
            </p>
            <div className="my-5 inline-block rounded-2xl bg-secondary px-8 py-3.5 border-2 border-primary/20">
              <span className="font-mono text-4xl font-extrabold text-primary">
                #{confirmedOrder.orderNumber}
              </span>
            </div>

            {/* PROMINENT LIVE TRACKING CTA BUTTON */}
            <div className="my-3">
              <Link
                to="/track"
                search={{
                  orderNumber: String(confirmedOrder.orderNumber),
                  phone: confirmedOrder.customer_phone,
                }}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-gradient-to-l from-red-600 to-orange-500 px-8 py-4 text-base font-extrabold text-white shadow-pop transition hover:brightness-110"
              >
                <PackageSearch className="h-5 w-5" />
                تتبع حالة طلبك مباشرة
              </Link>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              سيتواصل معك {branchLabel} هاتفياً لتأكيد الطلب وتوصيله في أسرع وقت.
            </p>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-lg">
              <Receipt className="h-5 w-5 text-primary" /> تفاصيل الفاتورة
            </h2>
            <ul className="divide-y divide-border rounded-2xl bg-secondary/50 p-4">
              {confirmedOrder.items.map((item, idx) => (
                <li key={idx} className="flex items-start justify-between py-2.5">
                  <div>
                    <span className="font-bold">{item.qty} × {item.nameAr}</span>
                    {item.size && <span className="text-xs text-muted-foreground"> ({item.size.label})</span>}
                    {item.extras.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.extras.map((e) => e.nameAr).join("، ")}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-sm">
                    {formatEGP(item.qty * item.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 rounded-2xl bg-secondary/30 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">الإجمالي الفرعي</dt>
                <dd className="font-mono font-bold">{formatEGP(confirmedOrder.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">خدمة التوصيل</dt>
                <dd className="font-mono font-bold">
                  {confirmedOrder.deliveryFee === 0 ? "مجاناً (استلام من الفرع)" : formatEGP(confirmedOrder.deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold text-primary">
                <dt>الإجمالي النهائي</dt>
                <dd className="font-mono text-lg">{formatEGP(confirmedOrder.total)}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl border border-border p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Store className="h-4 w-4 text-primary" />
                <span>الفرع المجهز: <b>{confirmedOrder.branch}</b></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="h-4 w-4 text-primary" />
                <span>نوع الاستلام: <b>{confirmedOrder.type === "delivery" ? "توصيل للمنزل" : "استلام من الفرع"}</b></span>
              </div>
              {confirmedOrder.type === "delivery" && confirmedOrder.address && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>عنوان التوصيل: <b>{confirmedOrder.address}</b></span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <span>رقم التواصل: <b dir="ltr">{confirmedOrder.customer_phone}</b></span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/track"
              search={{
                orderNumber: String(confirmedOrder.orderNumber),
                phone: confirmedOrder.customer_phone,
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-bold text-primary-foreground shadow-pop transition hover:bg-primary-deep"
            >
              <PackageSearch className="h-5 w-5" />
              تتبع حالة طلبك مباشرة
            </Link>
            <Link
              to="/"
              onClick={() => {
                sessionStorage.removeItem(LAST_ORDER_KEY);
                setConfirmedOrder(null);
              }}
              className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 font-bold text-foreground transition hover:border-primary"
            >
              طلب وجبة جديدة
            </Link>
            <a
              href={`https://wa.me/${restaurant.whatsappNumber}?text=${encodeURIComponent(`مرحباً عشماوي، أستفسر عن طلبي رقم #${confirmedOrder.orderNumber}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 font-bold text-foreground transition hover:border-primary"
            >
              <MessageCircle className="h-5 w-5 text-emerald-500" />
              تواصل معنا للاستفسار
            </a>
          </div>
        </div>
      </div>
    );
  }

  // STORE CLOSED SCREEN (if website closed or all branches closed)
  if (!isStoreAccessible && !confirmedOrder) {
    const isAllBranchesClosed =
      opSettings.isSiteOpen &&
      Object.keys(opSettings.branches || {}).length > 0 &&
      !Object.values(opSettings.branches).some((b) => b.isOpen);

    return (
      <StoreClosedScreen
        customMessage={opSettings.globalClosedMessage}
        isAllBranchesClosed={isAllBranchesClosed}
      />
    );
  }

  // EMPTY CART SCREEN
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-primary">السلة فاضية</h1>
        <p className="mt-2 text-muted-foreground">ضيف أكلاتك المفضلة الأول عشان تكمل طلبك.</p>
        <Link
          to="/"
          hash="menu"
          className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:bg-primary-deep shadow-pop"
        >
          تصفح المنيو
        </Link>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-input bg-card px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-4xl text-primary sm:text-5xl">إتمام الطلب</h1>
        <Link to="/" className="text-sm font-bold text-primary flex items-center gap-1 hover:underline">
          العودة للمنيو <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {submitError && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive" role="alert">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm font-bold leading-relaxed">{submitError}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* CHECKOUT FORM */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7">
          {/* FULFILLMENT METHOD */}
          <fieldset>
            <legend className="mb-2 font-bold">طريقة الاستلام</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["delivery", "pickup"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => set("orderType", t)}
                  aria-pressed={form.orderType === t}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 font-bold transition ${
                    form.orderType === t
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border hover:border-primary bg-secondary/30"
                  }`}
                >
                  {t === "delivery" ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                  {t === "delivery" ? "توصيل للمنزل" : "استلام من الفرع"}
                </button>
              ))}
            </div>
          </fieldset>

          {/* BRANCH SELECTION */}
          <div>
            <label htmlFor="branch" className="mb-1.5 block font-bold">الفرع المجهز للطلب *</label>
            <select
              id="branch"
              className={field}
              value={form.branch}
              onChange={(e) => set("branch", e.target.value as "فرع المطار" | "فرع المحطة")}
            >
              {restaurant.branches.map((b) => {
                const bStatus = checkBranch(b.label);
                return (
                  <option key={b.label} value={b.label}>
                    {b.label} {bStatus.isOpen ? "— متاح للطلبات" : "— (مغلق حالياً)"}
                  </option>
                );
              })}
            </select>
            {(() => {
              const selectedBranchStatus = checkBranch(form.branch);
              if (!selectedBranchStatus.isOpen) {
                return (
                  <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{selectedBranchStatus.reason || `${form.branch} مغلق حالياً، يرجى اختيار فرع آخر.`}</span>
                  </div>
                );
              }
              return null;
            })()}
            {errors.branch && <p className="mt-1 text-sm text-destructive">{errors.branch}</p>}
          </div>

          {/* CUSTOMER NAME */}
          <div>
            <label htmlFor="name" className="mb-1.5 block font-bold">الاسم بالكامل *</label>
            <input
              id="name"
              className={field}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
              placeholder="اكتب اسمك الثلاثي أو الثنائي"
              autoComplete="name"
            />
            {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
          </div>

          {/* CUSTOMER PHONE */}
          <div>
            <label htmlFor="phone" className="mb-1.5 block font-bold">رقم الموبايل (واتساب / اتصال) *</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="01xxxxxxxxx"
              className={`${field} text-right`}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={!!errors.phone}
              autoComplete="tel"
            />
            {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone}</p>}
          </div>

          {/* DELIVERY ADDRESS */}
          {form.orderType === "delivery" && (
            <div>
              <label htmlFor="address" className="mb-1.5 block font-bold">عنوان التوصيل بالتفصيل *</label>
              <textarea
                id="address"
                rows={2}
                className={field}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                aria-invalid={!!errors.address}
                placeholder="اسم المنطقة، الشارع، رقم العمارة والدور، علامة مميزة"
              />
              {errors.address && <p className="mt-1 text-sm text-destructive">{errors.address}</p>}
            </div>
          )}

          {/* NOTES */}
          <div>
            <label htmlFor="notes" className="mb-1.5 block font-bold">
              ملاحظات إضافية <span className="font-normal text-muted-foreground">(اختياري)</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              className={field}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="أي تعليمات خاصة بالطلب أو التوصيل..."
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-lg font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                جاري إرسال وتأكيد الطلب...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-6 w-6" />
                تأكيد وإرسال الطلب ({formatEGP(total)})
              </>
            )}
          </button>
        </form>

        {/* ORDER SUMMARY SIDEBAR */}
        <aside className="h-fit rounded-3xl bg-secondary p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 text-xl font-extrabold">ملخص الطلب</h2>
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {l.nameAr}
                    {l.size && <span className="text-sm text-muted-foreground"> · {l.size.label}</span>}
                  </p>
                  {l.extras.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      + {l.extras.map((e) => `${e.nameAr} (${e.price})`).join("، ")}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <QtyControl qty={l.qty} onChange={(n) => setQty(l.key, n)} name={l.nameAr} />
                  </div>
                </div>
                <span className="shrink-0 font-mono font-bold">{formatEGP(l.qty * l.unitPrice)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>الإجمالي الفرعي</dt>
              <dd className="font-mono font-bold">{formatEGP(subtotal)}</dd>
            </div>
            {form.orderType === "delivery" && (
              <div className="flex justify-between">
                <dt>رسوم التوصيل ({form.branch})</dt>
                <dd className="font-mono font-bold">{formatEGP(deliveryFee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-lg font-extrabold text-primary">
              <dt>الإجمالي النهائي</dt>
              <dd className="font-mono text-xl">{formatEGP(total)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl bg-card p-3 text-xs text-muted-foreground leading-relaxed">
            * يتم حساب الأسعار وتأكيد الحجز آلياً وبشكل لحظي عبر الخادم.
          </div>
        </aside>
      </div>
    </div>
  );
}
