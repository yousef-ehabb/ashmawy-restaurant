import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { db, auth, isFirebaseConfigured, ensureAnonymousAuth } from "@/lib/firebase";
import { formatEGP } from "@/data/menu";
import { restaurant } from "@/config/restaurant";
import {
  LayoutDashboard,
  LogOut,
  Bell,
  BellOff,
  Search,
  Filter,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  Store,
  AlertTriangle,
  RotateCcw,
  ChefHat,
  PackageCheck,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  User as UserIcon,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | إدارة طلبات عشماوي" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export interface OrderItem {
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
  extras?: Array<{
    id: string;
    name_ar: string;
    price: number;
  }> | undefined;
  special_instructions?: string | undefined;
}

export interface AdminOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  address?: string | undefined;
  type: "delivery" | "pickup";
  branch: string;
  notes?: string | undefined;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  updated_at?: string | undefined;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string; nextStatus?: OrderStatus; nextLabel?: string }
> = {
  new: {
    label: "جديد",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    nextStatus: "preparing",
    nextLabel: "بدء التجهيز",
  },
  preparing: {
    label: "قيد التجهيز",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    nextStatus: "ready",
    nextLabel: "جاهز للتسليم",
  },
  ready: {
    label: "جاهز",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    nextStatus: "out_for_delivery",
    nextLabel: "خرج للتوصيل",
  },
  out_for_delivery: {
    label: "في الطريق",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    nextStatus: "completed",
    nextLabel: "تم التسليم",
  },
  completed: {
    label: "مكتمل",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  cancelled: {
    label: "ملغي",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
};

// Web Audio synthesizer for pleasant order alert
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // ignore audio block
  }
}

function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
    const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const initialLoadRef = useRef(true);
  const prevOrderCountRef = useRef(0);

  // 1. Auth Listener
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Real-Time Orders Sync (Firestore onSnapshot + API polling fallback)
  useEffect(() => {
    const isStaff = user && !user.isAnonymous;
    if (!isStaff) {
      setOrdersLoading(false);
      return;
    }

    let isMounted = true;
    let pollInterval: any = null;

    const fetchFromApi = async () => {
      try {
        const token = user ? await user.getIdToken() : '';
        const res = await fetch("/api/admin/orders", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 401 || res.status === 403) {
          if (isMounted) {
            setError("غير مصرح لك بالوصول إلى لوحة الإدارة. يرجى تسجيل الدخول بحساب مسؤول.");
            setOrdersLoading(false);
          }
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.orders) && isMounted) {
          setError(null);
          setOrders(data.orders);
          if (!initialLoadRef.current && soundEnabled && data.orders.length > prevOrderCountRef.current) {
            playChime();
          }
          initialLoadRef.current = false;
          prevOrderCountRef.current = data.orders.length;
        }
      } catch (e) {
        console.warn("[AdminDashboard] API fetch error:", e);
      } finally {
        if (isMounted) setOrdersLoading(false);
      }
    };

    // Initial fetch from authoritative API
    fetchFromApi();

    // Set up real-time listener if db is available
    let unsub: Unsubscribe | null = null;
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, "orders");
        unsub = onSnapshot(
          colRef,
          (snapshot) => {
            if (!isMounted) return;
            const orderMap = new Map<string, AdminOrder>();
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data() as Record<string, any>;
              orderMap.set(docSnap.id, {
                id: docSnap.id,
                order_number: Number(data['order_number']) || 1000,
                status: (data['status'] as OrderStatus) || "new",
                customer_name: String(data['customer_name'] || ""),
                customer_phone: String(data['customer_phone'] || ""),
                address: data['address'] ? String(data['address']) : "",
                type: (data['type'] as "delivery" | "pickup") || "delivery",
                branch: String(data['branch'] || "فرع المطار"),
                notes: data['notes'] ? String(data['notes']) : "",
                items: Array.isArray(data['items']) ? data['items'] : [],
                subtotal: Number(data['subtotal']) || 0,
                delivery_fee: Number(data['delivery_fee']) || 0,
                total: Number(data['total']) || 0,
                created_at: String(data['created_at'] || new Date().toISOString()),
                updated_at: data['updated_at'] ? String(data['updated_at']) : undefined,
              });
            });
            const list = Array.from(orderMap.values());
            list.sort((a, b) => b.order_number - a.order_number);

            if (!initialLoadRef.current && soundEnabled && list.length > prevOrderCountRef.current) {
              playChime();
            }
            initialLoadRef.current = false;
            prevOrderCountRef.current = list.length;
            setOrders(list);
            setOrdersLoading(false);
          },
          (err) => {
            console.debug("[AdminDashboard] Firestore listener restricted, falling back to API polling:", err.message);
            // Fallback to active polling every 3 seconds
            if (!pollInterval) {
              pollInterval = setInterval(fetchFromApi, 3000);
            }
          }
        );
      } catch {
        pollInterval = setInterval(fetchFromApi, 3000);
      }
    } else {
      pollInterval = setInterval(fetchFromApi, 3000);
    }

    return () => {
      isMounted = false;
      if (unsub) unsub();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user, soundEnabled]);

  // Status Updater
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);

    // Optimistic local update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o))
    );

    try {
      // 1. Update via server API with Bearer token
      const token = user ? await user.getIdToken() : '';
      const res = await fetch("/api/admin/orders/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update order status");
      }
    } catch (err: any) {
      console.warn("[AdminDashboard] Server update failed, attempting Firestore direct update:", err.message);
      if (db) {
        try {
          const orderRef = doc(db, "orders", orderId);
          await updateDoc(orderRef, {
            status: newStatus,
            updated_at: new Date().toISOString(),
            server_updated_at: serverTimestamp(),
          });
        } catch (innerErr: any) {
          alert("فشل تحديث حالة الطلب: " + (innerErr.message || err.message));
        }
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      // Branch filter
      if (branchFilter !== "all" && o.branch !== branchFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNum = String(o.order_number).includes(q);
        const matchesPhone = o.customer_phone.includes(q);
        const matchesName = o.customer_name.toLowerCase().includes(q);
        return matchesNum || matchesPhone || matchesName;
      }
      return true;
    });
  }, [orders, statusFilter, branchFilter, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    let newCount = 0;
    let preparingCount = 0;
    let readyCount = 0;
    let completedCount = 0;
    let todaySales = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    orders.forEach((o) => {
      if (o.status === "new") newCount++;
      if (o.status === "preparing") preparingCount++;
      if (o.status === "ready" || o.status === "out_for_delivery") readyCount++;
      if (o.status === "completed") {
        completedCount++;
        if (o.created_at?.startsWith(todayStr)) {
          todaySales += o.total;
        }
      }
    });

    return { newCount, preparingCount, readyCount, completedCount, todaySales };
  }, [orders]);

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in as staff and not bypassed, show Admin Login view
  const isStaff = user && !user.isAnonymous;
  if (!isStaff) {
    return <AdminLogin onLoggedIn={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* HEADER BAR */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold sm:text-3xl">لوحة إدارة الطلبات</h1>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                متابعة وإدارة طلبات الفروع لحظياً · {restaurant.nameAr}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                soundEnabled
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
              title={soundEnabled ? "كتم صوت التنبيهات" : "تفعيل صوت التنبيهات"}
            >
              {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {soundEnabled ? "التنبيه مفعل" : "صامت"}
            </button>

            <button
              onClick={() => {
                if (auth) firebaseSignOut(auth);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </header>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-bold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {/* METRICS & QUICK STATS */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-500 mb-1">
              <span className="text-xs font-bold">طلبات جديدة</span>
              <Bell className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-amber-600">{stats.newCount}</div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-blue-500 mb-1">
              <span className="text-xs font-bold">قيد التجهيز</span>
              <ChefHat className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-blue-600">{stats.preparingCount}</div>
          </div>

          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-teal-500 mb-1">
              <span className="text-xs font-bold">جاهز للتسليم</span>
              <PackageCheck className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-teal-600">{stats.readyCount}</div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-emerald-500 mb-1">
              <span className="text-xs font-bold">مكتملة اليوم</span>
              <CheckCircle className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600">{stats.completedCount}</div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-primary mb-1">
              <span className="text-xs font-bold">مبيعات اليوم</span>
              <span className="text-xs font-mono font-bold">EGP</span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-primary">{formatEGP(stats.todaySales)}</div>
          </div>
        </section>

        {/* FILTERS & SEARCH TOOLBAR */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* STATUS TABS */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "الكل" },
              { id: "new", label: "جديد" },
              { id: "preparing", label: "قيد التجهيز" },
              { id: "ready", label: "جاهز" },
              { id: "out_for_delivery", label: "في الطريق" },
              { id: "completed", label: "مكتمل" },
              { id: "cancelled", label: "ملغي" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* BRANCH FILTER & SEARCH */}
          <div className="flex items-center gap-2">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="all">جميع الفروع</option>
              <option value="فرع المطار">فرع المطار</option>
              <option value="فرع المحطة">فرع المحطة</option>
            </select>

            <div className="relative flex-1 sm:w-56">
              <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الطلب أو الهاتف..."
                className="w-full rounded-xl border border-input bg-card py-1.5 pr-8 pl-3 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* ORDERS LIST */}
        {ordersLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card py-16 text-center">
            <ChefHat className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-bold text-lg">لا توجد طلبات مطابقة</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length === 0 ? "لم يتم استلام أي طلبات حتى الآن." : "جرب تغيير معايير البحث أو التصفية."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
              const isUpdating = updatingId === order.id;

              return (
                <div
                  key={order.id}
                  className={`flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-card transition hover:shadow-lg ${
                    order.status === "new" ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-border"
                  }`}
                >
                  <div>
                    {/* ORDER HEADER */}
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xl font-extrabold text-primary">
                          #{order.order_number}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(order.created_at).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* CUSTOMER & BRANCH INFO */}
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{order.customer_name}</span>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 font-mono font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                            title="اتصال هاتفي"
                          >
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{order.customer_phone}</span>
                          </a>
                          <a
                            href={`https://wa.me/2${order.customer_phone.replace(/^0/, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center rounded-lg bg-emerald-500/10 p-1 text-emerald-600 hover:bg-emerald-500 hover:text-white transition"
                            title="محادثة واتساب"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Store className="h-3.5 w-3.5 text-primary" />
                          {order.branch}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          {order.type === "delivery" ? <Truck className="h-3.5 w-3.5 text-primary" /> : <Store className="h-3.5 w-3.5 text-primary" />}
                          {order.type === "delivery" ? "توصيل" : "استلام"}
                        </span>
                      </div>

                      {order.type === "delivery" && order.address && (
                        <div className="flex items-start gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-relaxed">{order.address}</span>
                        </div>
                      )}

                      {order.notes && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                          <span className="font-bold">ملاحظة: </span>
                          {order.notes}
                        </div>
                      )}
                    </div>

                    {/* ITEMS BREAKDOWN */}
                    <div className="mt-4 border-t border-border pt-3">
                      <div className="mb-2 text-xs font-bold text-muted-foreground">الأصناف المطلوبة:</div>
                      <ul className="space-y-1.5 text-xs">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex items-start justify-between">
                            <div>
                              <span className="font-bold text-foreground">
                                {item.quantity} × {item.name_ar}
                              </span>
                              {item.size && (
                                <span className="text-muted-foreground"> ({item.size.label})</span>
                              )}
                              {item.extras && item.extras.length > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  + {item.extras.map((e) => e.name_ar).join("، ")}
                                </p>
                              )}
                              {item.special_instructions && (
                                <p className="text-[11px] text-amber-600 font-medium">
                                  * {item.special_instructions}
                                </p>
                              )}
                            </div>
                            <span className="font-mono font-bold">{formatEGP(item.total_price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* FOOTER & STATUS ACTIONS */}
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-center justify-between text-sm font-bold mb-3">
                      <span className="text-muted-foreground">الإجمالي:</span>
                      <span className="font-mono text-lg font-extrabold text-primary">
                        {formatEGP(order.total)}
                      </span>
                    </div>

                    {/* ACTION CONTROLS */}
                    <div className="flex flex-wrap gap-2">
                      {statusCfg.nextStatus && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, statusCfg.nextStatus!)}
                          disabled={isUpdating}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {statusCfg.nextLabel}
                        </button>
                      )}

                      {order.status !== "cancelled" && order.status !== "completed" && (
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من إلغاء الطلب رقم #${order.order_number}؟`)) {
                              handleUpdateStatus(order.id, "cancelled");
                            }
                          }}
                          disabled={isUpdating}
                          className="rounded-xl border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                        >
                          إلغاء
                        </button>
                      )}

                      {/* Dropdown status selector */}
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                        disabled={isUpdating}
                        className="rounded-xl border border-input bg-secondary px-2 py-2 text-xs font-bold outline-none"
                      >
                        <option value="new">جديد</option>
                        <option value="preparing">قيد التجهيز</option>
                        <option value="ready">جاهز</option>
                        <option value="out_for_delivery">في الطريق</option>
                        <option value="completed">مكتمل</option>
                        <option value="cancelled">ملغي</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Sleek Admin Login Component
function AdminLogin({
  onLoggedIn,
}: {
  onLoggedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!email || !password) {
      setLoginError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);
    try {
      if (auth) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onLoggedIn();
      } else {
        throw new Error("Firebase Auth غير مهيأ");
      }
    } catch (err: any) {
      console.error("[AdminLogin] Sign in failed:", err);
      let msg = "فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
        msg = "بيانات الدخول غير صحيحة.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "تم حظر المحاولات مؤقتاً لتكرار الفشل. جرب لاحقاً.";
      }
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="font-display text-3xl font-bold text-primary">دخول الإدارة</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            لوحة تحكم وإدارة طلبات مطعم عشماوي
          </p>
        </div>

        {loginError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {loginError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold">البريد الإلكتروني</label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ashmawy.com"
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary text-right"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary text-right"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "تسجيل الدخول"}
          </button>
        </form>

        

        <div className="mt-6 border-t border-border pt-4 text-center">
          <span className="text-xs text-muted-foreground">
            مخصص لطاقم عمل وفروع عشماوي فقط
          </span>
        </div>
      </div>
    </div>
  );
}
