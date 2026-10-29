import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  PackageSearch,
  Clock,
  ChefHat,
  Truck,
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Receipt,
  Phone,
  MapPin,
  ArrowRight,
  Search,
} from "lucide-react";
import { trackOrderByApi } from "@/lib/order-api";
import { formatEGP } from "@/data/menu";

const trackSearchSchema = z.object({
  orderNumber: z.string().optional().catch(undefined),
  phone: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "تتبع طلبك | عشماوي" },
      { name: "description", content: "تتبع حالة طلبك من عشماوي لحظة بلحظة." },
      { property: "og:title", content: "تتبع طلبك | عشماوي" },
      { property: "og:description", content: "تتبع حالة طلبك من عشماوي لحظة بلحظة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: trackSearchSchema,
  component: TrackOrder,
});

// Phone validation schema (Egyptian mobile numbers)
const phoneSchema = z
  .string()
  .regex(/^01[0125]\d{8}$/, "رقم موبايل مصري غير صحيح (مثال: 01012345678)");

// Check if an order is still in an active (non-terminal) state
function isActiveOrder(status: string): boolean {
  return status !== "completed" && status !== "delivered" && status !== "cancelled";
}

// Stepper configuration based on fulfillment method
function getSteps(fulfillmentType: "delivery" | "pickup") {
  return [
    {
      key: "received",
      statuses: ["pending", "confirmed", "new"],
      label: "استلام الطلب",
      description: "تم استلام الطلب وجارٍ المراجعة من الفرع",
      icon: Clock,
    },
    {
      key: "preparing",
      statuses: ["preparing"],
      label: "قيد التحضير",
      description: "قيد التحضير في المطبخ",
      icon: ChefHat,
    },
    fulfillmentType === "pickup"
      ? {
          key: "ready_for_pickup",
          statuses: ["ready_for_pickup", "ready"],
          label: "جاهز للاستلام",
          description: "جاهز للاستلام من الفرع! يمكنك التوجه لاستلام طلبك الآن",
          icon: Store,
        }
      : {
          key: "out_for_delivery",
          statuses: ["out_for_delivery", "ready"],
          label: "خرج للتوصيل",
          description: "خرج للتوصيل - طلبك في الطريق إليك",
          icon: Truck,
        },
    {
      key: "completed",
      statuses: ["completed", "delivered"],
      label: "تم التسليم",
      description: "تم تسليم الطلب بنجاح - بالهنا والشفا!",
      icon: CheckCircle2,
    },
  ];
}

function getStepIndex(status: string, fulfillmentType: "delivery" | "pickup"): number {
  const steps = getSteps(fulfillmentType);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step && step.statuses.includes(status)) return i;
  }
  return -1;
}

function TrackOrder() {
  const { orderNumber: qsOrderNumber, phone: qsPhone } = Route.useSearch();
  const navigate = useNavigate();

  const [orderNumberInput, setOrderNumberInput] = useState(
    qsOrderNumber ? qsOrderNumber.replace(/^#/, "").trim() : ""
  );
  const [phoneInput, setPhoneInput] = useState(qsPhone ? qsPhone.trim() : "");
  const [errors, setErrors] = useState<{ orderNumber?: string; phone?: string }>({});

  const [searchParams, setSearchParams] = useState<{ orderNumber: string; phone: string } | null>(() => {
    // Auto-trigger if valid params in URL
    const cleanNum = qsOrderNumber ? qsOrderNumber.replace(/^#/, "").trim() : "";
    const cleanPhone = qsPhone ? qsPhone.replace(/[\s-]/g, "").trim() : "";
    if (cleanNum && /^\d+$/.test(cleanNum) && cleanPhone && /^01[0125]\d{8}$/.test(cleanPhone)) {
      return { orderNumber: cleanNum, phone: cleanPhone };
    }
    return null;
  });

  // Tracking query with 10s auto-polling while order is active
  const {
    data: trackingResult,
    isLoading,
    isError,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["track-order", searchParams?.orderNumber, searchParams?.phone],
    queryFn: () => trackOrderByApi(searchParams!.orderNumber, searchParams!.phone),
    enabled: !!searchParams,
    refetchInterval: (query) => {
      const order = query.state.data?.order;
      if (order && isActiveOrder(order.status)) {
        return 10_000; // Poll every 10 seconds while active
      }
      return false;
    },
    retry: false,
    staleTime: 4000,
  });

  const validate = useCallback(() => {
    const e: { orderNumber?: string; phone?: string } = {};
    const cleanNum = orderNumberInput.replace(/^#/, "").trim();
    if (!cleanNum || !/^\d+$/.test(cleanNum)) {
      e.orderNumber = "من فضلك أدخل رقم طلب صحيح (مثال: 1001)";
    }
    const cleanPhone = phoneInput.replace(/[\s-]/g, "").trim();
    const phoneResult = phoneSchema.safeParse(cleanPhone);
    if (!phoneResult.success) {
      e.phone = "رقم موبايل مصري غير صحيح (مثال: 01012345678)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [orderNumberInput, phoneInput]);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const cleanNum = orderNumberInput.replace(/^#/, "").trim();
    const cleanPhone = phoneInput.replace(/[\s-]/g, "").trim();

    // Update URL search params
    navigate({
      to: "/track",
      search: { orderNumber: cleanNum, phone: cleanPhone },
      replace: true,
    });

    setSearchParams({ orderNumber: cleanNum, phone: cleanPhone });
  };

  const order = trackingResult?.order;
  const status = order?.status || "pending";
  const fulfillmentType = (order?.type || "delivery") as "delivery" | "pickup";

  const branchDisplay = order?.branch
    ? order.branch.startsWith("فرع ")
      ? order.branch
      : `فرع ${order.branch}`
    : "";

  const field =
    "w-full rounded-xl border border-input bg-card px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:pt-28">
      {/* SEARCH FORM */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PackageSearch className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl text-primary sm:text-4xl">تتبع طلبك</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            أدخل رقم طلبك ورقم هاتفك لمتابعة حالة وتجهيز طلبك لحظة بلحظة
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="orderNumber" className="mb-1.5 block text-sm font-bold">
              رقم الطلب *
            </label>
            <input
              id="orderNumber"
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="مثال: 1001"
              className={`${field} text-right font-mono`}
              value={orderNumberInput}
              onChange={(e) => {
                setOrderNumberInput(e.target.value);
                if (errors.orderNumber) setErrors((prev) => {
                  const { orderNumber: _, ...rest } = prev;
                  return rest;
                });
              }}
              aria-invalid={!!errors.orderNumber}
            />
            {errors.orderNumber && (
              <p className="mt-1 text-sm text-destructive">{errors.orderNumber}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-bold">
              رقم الموبايل المسجل به الطلب *
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="01xxxxxxxxx"
              className={`${field} text-right font-mono`}
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                if (errors.phone) setErrors((prev) => {
                  const { phone: _, ...rest } = prev;
                  return rest;
                });
              }}
              aria-invalid={!!errors.phone}
              autoComplete="tel"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-lg font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري البحث عن الطلب...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                تتبع الآن
              </>
            )}
          </button>
        </form>
      </div>

      {/* ERROR STATE */}
      {isError && (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="font-bold text-destructive">
            {(queryError as Error)?.message ||
              "لم يتم العثور على طلب بهذه البيانات، يرجى التأكد من رقم الطلب ورقم الهاتف"}
          </p>
        </div>
      )}

      {/* ORDER TRACKING RESULT */}
      {order && (
        <div className="mt-6 space-y-5">
          {/* CANCELLED STATE BANNER */}
          {status === "cancelled" ? (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
              <XCircle className="h-8 w-8 shrink-0 text-destructive" />
              <div>
                <p className="font-bold text-destructive text-lg">تم إلغاء هذا الطلب</p>
                <p className="text-sm text-destructive/80 mt-0.5">
                  للأسف تم إلغاء طلبك. إذا كان لديك أي استفسار أو ترغب في تعديل الطلب، يرجى التواصل مع الفرع مباشرة.
                </p>
              </div>
            </div>
          ) : (
            /* DYNAMIC VISUAL PROGRESS STEPPER */
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-6 font-bold text-lg">حالة الطلب الحالية</h2>
              <div className="space-y-0">
                {getSteps(fulfillmentType).map((step, idx) => {
                  const currentIdx = getStepIndex(status, fulfillmentType);
                  const isCompleted = currentIdx !== -1 && idx < currentIdx;
                  const isCurrent = idx === currentIdx;

                  const StepIcon = step.icon;
                  const isLastStep = idx === getSteps(fulfillmentType).length - 1;

                  return (
                    <div key={step.key} className="flex items-start gap-4">
                      {/* Timeline Indicator */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            isCompleted
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isCurrent
                                ? "border-primary bg-primary text-primary-foreground shadow-pop ring-4 ring-primary/20"
                                : "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <StepIcon className="h-5 w-5" />
                          )}
                        </div>
                        {!isLastStep && (
                          <div
                            className={`w-0.5 h-12 transition-all ${
                              isCompleted ? "bg-emerald-500" : "bg-border"
                            }`}
                          />
                        )}
                      </div>

                      {/* Step Description */}
                      <div className={`pb-6 ${isLastStep ? "pb-0" : ""}`}>
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-bold text-base ${
                              isCompleted
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isCurrent
                                  ? "text-primary font-extrabold"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary animate-pulse">
                              الحالة الحالية
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-1 text-sm leading-relaxed ${
                            isCurrent
                              ? "text-foreground font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ORDER SUMMARY & RECEIPT DETAILS CARD */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-lg">
              <Receipt className="h-5 w-5 text-primary" /> تفاصيل الطلب والفاتورة
            </h2>

            {/* Order Meta Info */}
            <div className="mb-4 rounded-2xl border border-border bg-secondary/30 p-4 text-sm space-y-2.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">رقم الطلب</span>
                <span className="font-mono font-extrabold text-primary text-xl">
                  #{order.order_number}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Store className="h-4 w-4 text-primary shrink-0" />
                <span>
                  الفرع المجهز: <b>{branchDisplay}</b>
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {order.type === "delivery" ? (
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Store className="h-4 w-4 text-primary shrink-0" />
                )}
                <span>
                  طريقة الاستلام: <b>{order.type === "delivery" ? "توصيل للمنزل" : "استلام من الفرع"}</b>
                </span>
              </div>
              {order.address && order.type === "delivery" && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    عنوان التوصيل: <b>{order.address}</b>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>
                  تاريخ وتوقيت الطلب:{" "}
                  <b dir="ltr">
                    {new Date(order.created_at).toLocaleString("ar-EG", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </b>
                </span>
              </div>
            </div>

            {/* Itemized List */}
            <div className="mb-2 text-xs font-bold text-muted-foreground">الأصناف المطلوبة:</div>
            <ul className="divide-y divide-border rounded-2xl bg-secondary/50 p-4">
              {order.items.map((item: any, idx: number) => (
                <li key={idx} className="flex items-start justify-between py-2.5">
                  <div>
                    <span className="font-bold">
                      {item.quantity} × {item.name_ar}
                    </span>
                    {item.size && (
                      <span className="text-xs text-muted-foreground"> ({item.size.label})</span>
                    )}
                    {item.extras && item.extras.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.extras.map((e: any) => e.name_ar).join("، ")}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-sm">{formatEGP(item.total_price)}</span>
                </li>
              ))}
            </ul>

            {/* Price Breakdown */}
            <dl className="mt-4 space-y-2 rounded-2xl bg-secondary/30 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">الإجمالي الفرعي</dt>
                <dd className="font-mono font-bold">{formatEGP(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">خدمة التوصيل</dt>
                <dd className="font-mono font-bold">
                  {order.delivery_fee === 0 ? "مجاناً (استلام من الفرع)" : formatEGP(order.delivery_fee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold text-primary">
                <dt>الإجمالي النهائي</dt>
                <dd className="font-mono text-lg">{formatEGP(order.total)}</dd>
              </div>
            </dl>
          </div>

          {/* REFRESH & REAL-TIME SYNC CONTROLS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              تحديث الحالة الآن
            </button>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-muted-foreground">
                آخر تحديث:{" "}
                {new Date(dataUpdatedAt).toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
          </div>

          {/* Auto-polling indicator */}
          {isActiveOrder(status) && (
            <p className="text-center text-xs text-muted-foreground">
              ⟳ يتم تحديث حالة الطلب تلقائياً كل 10 ثوانٍ لتعكس أي تغيير يتم بواسطة الفرع مباشرة
            </p>
          )}
        </div>
      )}

      {/* BACK TO HOME */}
      <div className="mt-8 text-center">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
          العودة للرئيسية <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
