import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  User,
  ShoppingBag,
  PackageSearch,
  MapPin,
  Phone,
  Mail,
  Calendar,
  LogOut,
  Save,
  Loader2,
  Clock,
  Store,
  Truck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getCustomerOrdersApi } from "@/lib/order-api";
import type { CustomerOrderSummary } from "@/types/customer";
import { formatEGP } from "@/data/menu";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي | عشماوي" },
      { name: "description", content: "إدارة حسابك وعناوينك وسجل طلباتك في عشماوي." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: {
    label: "قيد المراجعة",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  confirmed: {
    label: "تم التأكيد",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  new: {
    label: "جديد",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  preparing: {
    label: "جاري التجهيز",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
  ready_for_pickup: {
    label: "جاهز للاستلام",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  ready: {
    label: "جاهز",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  out_for_delivery: {
    label: "خرج للتوصيل",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
  },
  completed: {
    label: "مكتمل",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
  },
  cancelled: {
    label: "ملغي",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
  },
};

function AccountPage() {
  const { user, profile, loading: authLoading, signOut, updateProfileData, getIdToken, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"orders" | "profile">("orders");
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Profile Edit Form State
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Expanded order details tracker
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName || "");
      setEditPhone(profile.phone || "");
      setEditAddress(profile.defaultAddress || "");
    }
  }, [profile]);

  // Fetch customer orders securely
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const fetchOrders = async () => {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const token = await getIdToken();
        if (!token) throw new Error("تعذر التحقق من هويتك.");
        const customerOrders = await getCustomerOrdersApi(token);
        if (isMounted) {
          setOrders(customerOrders);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("[Account] Error loading orders:", err);
          setOrdersError(err.message || "فشل تحميل سجل طلباتك.");
        }
      } finally {
        if (isMounted) {
          setOrdersLoading(false);
        }
      }
    };

    fetchOrders();
    return () => {
      isMounted = false;
    };
  }, [user, getIdToken]);

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (editName.trim().length < 2) {
      setProfileMsg({ type: "error", text: "الاسم يجب أن يكون حرفين على الأقل" });
      return;
    }

    const cleanPhone = editPhone.replace(/[\s-]/g, "");
    if (cleanPhone && !/^01[0125]\d{8}$/.test(cleanPhone)) {
      setProfileMsg({ type: "error", text: "رقم الموبايل يجب أن يكون رقم مصري صحيح (مثال: 01012345678)" });
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfileData({
        displayName: editName.trim(),
        phone: cleanPhone,
        defaultAddress: editAddress.trim(),
      });
      setProfileMsg({ type: "success", text: "تم حفظ بياناتك بنجاح!" });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message || "حدث خطأ أثناء حفظ البيانات." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  // If Auth is still loading
  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">جاري تحميل بيانات حسابك...</p>
        </div>
      </div>
    );
  }

  // If Not Authenticated
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
            <User className="h-10 w-10" />
          </div>
          <h1 className="mt-4 font-display text-3xl text-primary">تسجيل الدخول مطلوب</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            يرجى تسجيل الدخول أو إنشاء حساب جديد للوصول إلى بيانات ملفك الشخصي وسجل طلباتك في عشماوي.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => openAuthModal("signin")}
              className="flex-1 rounded-full bg-primary py-3.5 font-bold text-primary-foreground shadow-pop transition hover:bg-primary-deep"
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => openAuthModal("register")}
              className="flex-1 rounded-full border border-border bg-card py-3.5 font-bold text-foreground hover:bg-secondary transition"
            >
              إنشاء حساب جديد
            </button>
          </div>
          <div className="mt-4">
            <Link to="/" className="text-xs font-bold text-muted-foreground hover:text-primary">
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-input bg-card px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition text-sm";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* HEADER SECTION */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground shadow-sm">
            {(profile?.displayName || user.displayName || "ع")[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl text-foreground">
                {profile?.displayName || user.displayName || "عميل عشماوي"}
              </h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-extrabold text-primary">
                عميل مسجل
              </span>
            </div>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {profile?.email || user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to="/#menu"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>طلب جديد</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition ${
            activeTab === "orders"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <PackageSearch className="h-4 w-4" />
          <span>سجل طلباتي</span>
          {orders.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "orders" ? "bg-white/20 text-white" : "bg-secondary text-foreground"
              }`}
            >
              {orders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition ${
            activeTab === "profile"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          <span>بيانات الحساب والعنوان</span>
        </button>
      </div>

      {/* TAB 1: ORDERS HISTORY */}
      {activeTab === "orders" && (
        <section aria-label="سجل الطلبات">
          {ordersLoading ? (
            <div className="space-y-4 py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جاري تحميل سجل طلباتك...</p>
            </div>
          ) : ordersError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="mt-2 font-bold text-destructive">{ordersError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-muted-foreground">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h2 className="mt-4 font-display text-2xl text-foreground">لا توجد طلبات سابقة</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                لم تقم بإنشاء أي طلبات حتى الآن. تصفح منيو عشماوي واطلب وجبتك المفضلة!
              </p>
              <Link
                to="/#menu"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-pop hover:bg-primary-deep"
              >
                تصفح المنيو
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => {
                const statusMeta = STATUS_LABELS[ord.status] || {
                  label: ord.status,
                  color: "text-muted-foreground",
                  bg: "bg-muted",
                  border: "border-border",
                };
                const isExpanded = Boolean(expandedOrders[ord.id]);

                return (
                  <article
                    key={ord.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition"
                  >
                    {/* Order summary row */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xl font-extrabold text-primary">
                            #{ord.order_number}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold border ${statusMeta.bg} ${statusMeta.color} ${statusMeta.border}`}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(ord.created_at).toLocaleDateString("ar-EG", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <span className="font-mono text-lg font-extrabold text-foreground">
                            {formatEGP(ord.total)}
                          </span>

                          <div className="flex items-center gap-2">
                            <Link
                              to="/track"
                              search={{
                                orderNumber: String(ord.order_number),
                                phone: ord.customer_phone,
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                            >
                              <PackageSearch className="h-3.5 w-3.5" />
                              <span>تتبع مباشر</span>
                            </Link>

                            <button
                              onClick={() => toggleOrderExpand(ord.id)}
                              className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-secondary text-muted-foreground"
                              aria-label="عرض تفاصيل الطلب"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Brief details pills */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                          <Store className="h-3 w-3 text-primary" />
                          {ord.branch}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                          <Truck className="h-3 w-3 text-primary" />
                          {ord.type === "delivery" ? "توصيل للمنزل" : "استلام من الفرع"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                          {ord.items.length} أصناف
                        </span>
                      </div>
                    </div>

                    {/* Expandable Order Contents */}
                    {isExpanded && (
                      <div className="border-t border-border bg-secondary/20 p-4 sm:p-5">
                        <h3 className="mb-3 font-bold text-sm text-foreground">محتويات الطلب:</h3>
                        <ul className="divide-y divide-border rounded-xl bg-card p-3 text-sm">
                          {ord.items.map((item, idx) => (
                            <li key={idx} className="flex items-start justify-between py-2">
                              <div>
                                <span className="font-bold">
                                  {item.quantity} × {item.name_ar}
                                </span>
                                {item.size && (
                                  <span className="text-xs text-muted-foreground"> ({item.size.label})</span>
                                )}
                                {item.extras && item.extras.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    + {item.extras.map((e) => e.name_ar).join("، ")}
                                  </p>
                                )}
                              </div>
                              <span className="font-mono font-bold text-xs">
                                {formatEGP(item.total_price)}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                          {ord.type === "delivery" && ord.address && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>عنوان التوصيل: {ord.address}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span dir="ltr">{ord.customer_phone}</span>
                          </div>
                          {ord.notes && (
                            <p className="mt-1 text-xs italic bg-secondary/50 p-2 rounded-lg">
                              ملاحظات: {ord.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: PROFILE & ADDRESS EDIT */}
      {activeTab === "profile" && (
        <section aria-label="تعديل الملف الشخصي" className="max-w-2xl">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card">
            <h2 className="font-display text-2xl text-primary">البيانات الشخصية وعنوان التوصيل</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              تُستخدم هذه البيانات لتسهيل وتسريع عمليات الطلب القادمة تلقائياً.
            </p>

            {profileMsg && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-xl p-3.5 text-xs font-bold border ${
                  profileMsg.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
              <div>
                <label htmlFor="displayName" className="mb-1.5 block text-xs font-bold">
                  الاسم بالكامل *
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="displayName"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`${field} pr-10`}
                    placeholder="اسمك الثلاثي أو الثنائي"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-bold">
                  البريد الإلكتروني (حسابك)
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    dir="ltr"
                    disabled
                    value={profile?.email || user.email || ""}
                    className={`${field} pr-10 bg-secondary/50 text-muted-foreground cursor-not-allowed`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  البريد الإلكتروني مرتبط بالمصادقة ولا يمكن تعديله مباشرة.
                </p>
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs font-bold">
                  رقم الموبايل الافتراضي (واتساب / اتصال)
                </label>
                <div className="relative">
                  <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="01012345678"
                    className={`${field} pr-10 text-right`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  يُملأ تلقائياً في شاشة الدفع لتأكيد الطلب.
                </p>
              </div>

              <div>
                <label htmlFor="defaultAddress" className="mb-1.5 block text-xs font-bold">
                  عنوان التوصيل الافتراضي
                </label>
                <div className="relative">
                  <MapPin className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <textarea
                    id="defaultAddress"
                    rows={3}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="المنطقة، اسم الشارع، رقم العمارة والدور، علامة مميزة (مثال: أسوان - شارع أطلس)"
                    className={`${field} pr-10`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  سيتم تعبئته تلقائياً عند اختيار التوصيل للمنزل.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-bold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:opacity-60"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      حفظ التغييرات
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

