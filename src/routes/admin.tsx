import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  setPersistence,
  inMemoryPersistence,
  type User,
} from "firebase/auth";
import { db, auth, isFirebaseConfigured } from "@/lib/firebase";
import { broadcastLiveSync } from "@/lib/liveSync";
import { formatEGP, products as menuProducts, extrasList, categories as menuCategories } from "@/data/menu";
import { restaurant } from "@/config/restaurant";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  type OperationalControlSettings,
  isWithinCairoShift,
} from "@/types/operational";
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
  Eye,
  EyeOff,
  ArrowRight,
  Utensils,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Plus,
  X,
  UtensilsCrossed,
  TrendingUp,
  Layers,
  Flame,
  RefreshCw,
  SlidersHorizontal,
  Power,
  ShieldAlert,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "new"
  | "ready";

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
  pending: {
    label: "قيد المراجعة",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    nextStatus: "confirmed",
    nextLabel: "تأكيد الطلب",
  },
  new: {
    label: "جديد",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    nextStatus: "confirmed",
    nextLabel: "تأكيد الطلب",
  },
  confirmed: {
    label: "تم التأكيد",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    nextStatus: "preparing",
    nextLabel: "بدء التجهيز",
  },
  preparing: {
    label: "قيد التجهيز",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    nextStatus: "ready_for_pickup",
    nextLabel: "جاهز للتسليم",
  },
  ready_for_pickup: {
    label: "جاهز للاستلام",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    nextStatus: "completed",
    nextLabel: "تم التسليم",
  },
  ready: {
    label: "جاهز للاستلام",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    nextStatus: "completed",
    nextLabel: "تم التسليم",
  },
  out_for_delivery: {
    label: "خرج للتوصيل",
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

// --- Availability Types ---
interface ItemAvailability {
  isAvailableGlobal: boolean;
  branchAvailability: Record<string, boolean>;
}

interface MenuAvailabilityData {
  items: Record<string, ItemAvailability>;
  extras: Record<string, ItemAvailability>;
}

const BRANCHES = restaurant.branches.map((b) => b.label);
export interface AdminProfile {
  uid: string;
  email: string;
  role: 'super_admin' | 'branch_admin';
  branch: string; // 'all' | 'فرع المحطة' | 'فرع المطار'
  displayName?: string;
}

export function deriveAdminProfile(email?: string | null): AdminProfile {
  const norm = (email || '').trim().toLowerCase();
  if (norm === 'station_admin@ashmayw.com' || norm === 'station_admin@ashmawy.com' || norm === 'mahatta@ashmawy.com') {
    return {
      uid: '',
      email: norm,
      role: 'branch_admin',
      branch: 'فرع المحطة',
      displayName: 'إدارة فرع المحطة',
    };
  }
  if (norm === 'elmatar_st_admin@ashmawy.com' || norm === 'matar@ashmawy.com') {
    return {
      uid: '',
      email: norm,
      role: 'branch_admin',
      branch: 'فرع المطار',
      displayName: 'إدارة فرع المطار',
    };
  }
  return {
    uid: '',
    email: norm,
    role: 'super_admin',
    branch: 'all',
    displayName: 'الإدارة العامة - كافة الفروع',
  };
}


function AdminDashboard() {
  // Session Isolation: always starts unauthenticated on every visit/reload
  const [hasLoggedInThisVisit, setHasLoggedInThisVisit] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "analytics" | "operations">("orders");

  const initialLoadRef = useRef(true);
  const prevOrderCountRef = useRef(0);

  // 1. Enforce inMemoryPersistence and clear any cached session on initial mount & unmount
  useEffect(() => {
    if (auth) {
      setPersistence(auth, inMemoryPersistence).catch((err) => {
        console.warn("[AdminAuth] Persistence configuration error:", err);
      });
      // Sign out any persistent/stale session so user must explicitly re-authenticate
      firebaseSignOut(auth).catch(() => {});
    }

    return () => {
      // Sign out when leaving the /admin route
      if (auth) {
        firebaseSignOut(auth).catch(() => {});
      }
    };
  }, []);

  // 2. Real-Time Orders Sync (Firestore onSnapshot + API polling fallback)
  useEffect(() => {
    const isStaff = user && !user.isAnonymous && hasLoggedInThisVisit;
    if (!isStaff) {
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    let isMounted = true;
    let pollInterval: any = null;

    const fetchFromApi = async () => {
      try {
        const token = user ? await user.getIdToken() : "";
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
          if (data.admin) {
            setAdminProfile(data.admin);
            if (data.admin.role === 'branch_admin' && data.admin.branch && data.admin.branch !== 'all') {
              setBranchFilter(data.admin.branch);
            }
          }
          let fetchedOrders = data.orders;
          if (data.admin?.role === 'branch_admin' && data.admin?.branch && data.admin.branch !== 'all') {
            fetchedOrders = fetchedOrders.filter((o: AdminOrder) => o.branch === data.admin.branch);
          }
          setOrders(fetchedOrders);
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
                order_number: Number(data["order_number"] ?? data["orderNumber"]) || 1000,
                status: (data["status"] as OrderStatus) || "pending",
                customer_name: String(data["customer_name"] || data["customerName"] || ""),
                customer_phone: String(data["customer_phone"] || data["customerPhone"] || ""),
                address: data["address"] ? String(data["address"]) : "",
                type: (data["type"] as "delivery" | "pickup") || "delivery",
                branch: String(data["branch"] || "فرع المطار"),
                notes: data["notes"] ? String(data["notes"]) : "",
                items: Array.isArray(data["items"]) ? data["items"] : [],
                subtotal: Number(data["subtotal"]) || 0,
                delivery_fee: Number(data["delivery_fee"] ?? data["deliveryFee"]) || 0,
                total: Number(data["total"]) || 0,
                created_at: String(data["created_at"] || new Date().toISOString()),
                updated_at: data["updated_at"] ? String(data["updated_at"]) : undefined,
              });
            });
            let list = Array.from(orderMap.values());
            if (adminProfile?.role === 'branch_admin' && adminProfile?.branch && adminProfile.branch !== 'all') {
              list = list.filter((o) => o.branch === adminProfile.branch);
            }
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
  }, [user, hasLoggedInThisVisit, soundEnabled]);

  // Status Updater
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);

    // Optimistic local update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o))
    );

    try {
      const token = user ? await user.getIdToken() : "";
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

  // Delete single order
  const handleDeleteOrder = async (orderId: string, orderNumber: number) => {
    if (!confirm(`هل أنت متأكد من حذف الطلب رقم #${orderNumber} نهائياً؟`)) {
      return;
    }
    setUpdatingId(orderId);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/admin/orders/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "فشل حذف الطلب");
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err: any) {
      alert("فشل حذف الطلب: " + (err.message || "حدث خطأ"));
    } finally {
      setUpdatingId(null);
    }
  };

  // Clear all orders (scoped to branch for branch_admin)
  const handleClearAllOrders = async () => {
    const isBranchAdmin = adminProfile?.role === "branch_admin";
    const targetOrders = isBranchAdmin && adminProfile?.branch
      ? orders.filter((o) => o.branch === adminProfile.branch)
      : orders;

    if (targetOrders.length === 0) {
      alert("لا توجد طلبات لحذفها.");
      return;
    }
    const count = targetOrders.length;
    const confirmMsg = isBranchAdmin
      ? `⚠️ تحذير: هل أنت متأكد من حذف جميع طلبات ${adminProfile.branch} (${count} طلب) نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`
      : `⚠️ تحذير: هل أنت متأكد من حذف جميع الطلبات (${count} طلب) نهائياً لكافة الفروع من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`;

    if (!confirm(confirmMsg)) {
      return;
    }
    setOrdersLoading(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/admin/orders/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deleteAll: true }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "فشل حذف الطلبات");
      }
      if (isBranchAdmin && adminProfile?.branch) {
        setOrders((prev) => prev.filter((o) => o.branch !== adminProfile.branch));
      } else {
        setOrders([]);
      }
      alert(`تم حذف الطلبات بنجاح (${data.deletedCount || count} طلب).`);
    } catch (err: any) {
      alert("فشل حذف الطلبات: " + (err.message || "حدث خطأ"));
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleLogout = async () => {
    setHasLoggedInThisVisit(false);
    setUser(null);
    setAdminProfile(null);
    if (auth) {
      await firebaseSignOut(auth).catch(() => {});
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter with alias grouping
      if (statusFilter !== "all") {
        if (statusFilter === "pending") {
          if (o.status !== "pending" && o.status !== "new") return false;
        } else if (statusFilter === "ready_for_pickup") {
          if (o.status !== "ready_for_pickup" && o.status !== "ready") return false;
        } else if (o.status !== statusFilter) {
          return false;
        }
      }

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
      if (o.status === "pending" || o.status === "new" || o.status === "confirmed") newCount++;
      if (o.status === "preparing") preparingCount++;
      if (o.status === "ready" || o.status === "ready_for_pickup" || o.status === "out_for_delivery") readyCount++;
      if (o.status === "completed") {
        completedCount++;
        if (o.created_at?.startsWith(todayStr)) {
          todaySales += o.total;
        }
      }
    });

    return { newCount, preparingCount, readyCount, completedCount, todaySales };
  }, [orders]);

  // Active order count for badge
  const activeOrderCount = useMemo(
    () => orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
    [orders]
  );

  // Show login form if not authenticated this visit
  const isAuthorized = user && !user.isAnonymous && hasLoggedInThisVisit;
  if (!isAuthorized) {
    return (
      <AdminLogin
        onLoggedIn={(authenticatedUser, profile) => {
          setUser(authenticatedUser);
          setAdminProfile(profile);
          if (profile.role === 'branch_admin' && profile.branch && profile.branch !== 'all') {
            setBranchFilter(profile.branch);
          }
          setHasLoggedInThisVisit(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50/60 pb-20 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* STANDALONE ADMIN HEADER BAR */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold sm:text-3xl">
                  {adminProfile?.role === "branch_admin" && adminProfile?.branch
                    ? `لوحة إدارة عشماوي - ${adminProfile.branch}`
                    : "لوحة إدارة عشماوي"}
                </h1>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
                  {adminProfile?.role === "branch_admin" ? (
                    <>
                      <Store className="h-3 w-3" />
                      إدارة {adminProfile.branch}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3 w-3" />
                      الإدارة العامة - كافة الفروع
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {adminProfile?.role === "branch_admin" && adminProfile?.branch
                  ? `متابعة وتشغيل طلبات ${adminProfile.branch} حصرياً · ${restaurant.nameAr}`
                  : `متابعة وإدارة طلبات الفروع لحظياً · ${restaurant.nameAr}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition"
              title="فتح واجهة متجر العملاء في تبويب جديد"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              عرض المتجر
            </Link>

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
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground transition"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </header>

        {/* NAVIGATION TABS */}
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "orders"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <ChefHat className="h-4 w-4" />
            الطلبات
            {activeOrderCount > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                activeTab === "orders"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary/10 text-primary"
              }`}>
                {activeOrderCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "menu"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" />
            المنيو والتوفر
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "analytics"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            الإحصائيات والمبيعات
          </button>
          <button
            onClick={() => setActiveTab("operations")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "operations"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            التحكم التشغيلي
          </button>
        </div>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-bold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {/* CONDITIONAL TAB CONTENT */}
        {activeTab === "orders" ? (
          <OrdersView
            orders={orders}
            filteredOrders={filteredOrders}
            ordersLoading={ordersLoading}
            stats={stats}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            branchFilter={branchFilter}
            setBranchFilter={setBranchFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            updatingId={updatingId}
            handleUpdateStatus={handleUpdateStatus}
            handleDeleteOrder={handleDeleteOrder}
            handleClearAllOrders={handleClearAllOrders}
            adminProfile={adminProfile}
          />
        ) : activeTab === "menu" ? (
          <MenuAvailabilityView user={user} adminProfile={adminProfile} />
        ) : activeTab === "analytics" ? (
          <SalesAnalyticsView orders={orders} adminProfile={adminProfile} />
        ) : (
          <OperationalControlView user={user} adminProfile={adminProfile} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ORDERS VIEW (extracted from original code)
// ─────────────────────────────────────────────
function OrdersView({
  orders,
  filteredOrders,
  ordersLoading,
  stats,
  statusFilter,
  setStatusFilter,
  branchFilter,
  setBranchFilter,
  searchQuery,
  setSearchQuery,
  updatingId,
  handleUpdateStatus,
  handleDeleteOrder,
  handleClearAllOrders,
  adminProfile,
}: {
  orders: AdminOrder[];
  filteredOrders: AdminOrder[];
  ordersLoading: boolean;
  stats: { newCount: number; preparingCount: number; readyCount: number; completedCount: number; todaySales: number };
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  branchFilter: string;
  setBranchFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  updatingId: string | null;
  handleUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  handleDeleteOrder: (orderId: string, orderNumber: number) => void;
  handleClearAllOrders: () => void;
  adminProfile: AdminProfile | null;
}) {
  const isBranchAdmin = adminProfile?.role === "branch_admin";
  return (
    <>
      {/* METRICS & QUICK STATS */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <span className="text-xs font-bold">طلبات جديدة / مراجعة</span>
            <Bell className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-600">{stats.newCount}</div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-blue-500 mb-1">
            <span className="text-xs font-bold">قيد التجهيز بالمطبخ</span>
            <ChefHat className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-blue-600">{stats.preparingCount}</div>
        </div>

        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-teal-500 mb-1">
            <span className="text-xs font-bold">جاهز / خرج للتوصيل</span>
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
            { id: "pending", label: "قيد المراجعة" },
            { id: "confirmed", label: "تم التأكيد" },
            { id: "preparing", label: "قيد التجهيز" },
            { id: "ready_for_pickup", label: "جاهز للاستلام" },
            { id: "out_for_delivery", label: "خرج للتوصيل" },
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
          {isBranchAdmin ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shrink-0" title="تم تثبيت العرض لفرعك المسند فقط">
              <Store className="h-3.5 w-3.5" />
              <span>{adminProfile?.branch}</span>
              <Lock className="h-3 w-3 text-primary/70" />
            </div>
          ) : (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="all">جميع الفروع</option>
              <option value="فرع المطار">فرع المطار</option>
              <option value="فرع المحطة">فرع المحطة</option>
            </select>
          )}

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

          {filteredOrders.length > 0 && (
            <button
              onClick={handleClearAllOrders}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground transition shrink-0"
              title={isBranchAdmin ? `مسح طلبات ${adminProfile?.branch} نهائياً` : "حذف جميع الطلبات نهائياً من قاعدة البيانات"}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isBranchAdmin ? `مسح طلبات ${adminProfile?.branch}` : "مسح جميع الطلبات"}
              </span>
              <span>({filteredOrders.length})</span>
            </button>
          )}
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
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const isUpdating = updatingId === order.id;

            // Smart Next Status based on order type (delivery vs pickup)
            const nextStatus: OrderStatus | undefined =
              order.status === "preparing"
                ? order.type === "delivery"
                  ? "out_for_delivery"
                  : "ready_for_pickup"
                : statusCfg.nextStatus;

            const nextLabel: string | undefined =
              order.status === "preparing"
                ? order.type === "delivery"
                  ? "خرج للتوصيل"
                  : "جاهز للاستلام"
                : statusCfg.nextLabel;

            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-card transition hover:shadow-lg ${
                  order.status === "pending" || order.status === "new"
                    ? "border-amber-500/50 ring-1 ring-amber-500/20"
                    : "border-border"
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(order.created_at).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => handleDeleteOrder(order.id, order.order_number)}
                        disabled={isUpdating}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition disabled:opacity-50"
                        title="حذف هذا الطلب نهائياً"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
                        {order.type === "delivery" ? "توصيل للمنزل" : "استلام من الفرع"}
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
                    {nextStatus && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, nextStatus)}
                        disabled={isUpdating}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition disabled:opacity-50"
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {nextLabel}
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

                    {/* Unified Dropdown Status Selector */}
                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                      disabled={isUpdating}
                      className="rounded-xl border border-input bg-secondary px-2 py-2 text-xs font-bold outline-none"
                    >
                      <option value="pending">قيد المراجعة</option>
                      <option value="confirmed">تم التأكيد</option>
                      <option value="preparing">قيد التجهيز</option>
                      <option value="ready_for_pickup">جاهز للاستلام</option>
                      <option value="out_for_delivery">خرج للتوصيل</option>
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
    </>
  );
}

// ─────────────────────────────────────────────
// SALES & ANALYTICS VIEW (الإحصائيات والمبيعات)
// ─────────────────────────────────────────────
function SalesAnalyticsView({
  orders,
  adminProfile,
}: {
  orders: AdminOrder[];
  adminProfile: AdminProfile | null;
}) {
  const isBranchAdmin = adminProfile?.role === "branch_admin";
  const [analyticsBranch, setAnalyticsBranch] = useState(
    isBranchAdmin && adminProfile?.branch ? adminProfile.branch : "all"
  );

  useEffect(() => {
    if (isBranchAdmin && adminProfile?.branch) {
      setAnalyticsBranch(adminProfile.branch);
    }
  }, [isBranchAdmin, adminProfile?.branch]);

  // Helper: get today's date string in Cairo timezone (UTC+2)
  const getCairoDateStr = useCallback((date: Date = new Date()) => {
    const cairoOffset = 2; // Egypt Standard Time UTC+2
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const cairoDate = new Date(utc + cairoOffset * 3600000);
    return cairoDate.toISOString().slice(0, 10);
  }, []);

  const getCairoMonthStr = useCallback((date: Date = new Date()) => {
    const cairoOffset = 2;
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const cairoDate = new Date(utc + cairoOffset * 3600000);
    return cairoDate.toISOString().slice(0, 7); // YYYY-MM
  }, []);

  // Exclude cancelled orders and apply branch filter
  const activeOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === "cancelled") return false;
      if (analyticsBranch !== "all" && o.branch !== analyticsBranch) return false;
      return true;
    });
  }, [orders, analyticsBranch]);

  // ---------- KPI AGGREGATIONS ----------
  const analytics = useMemo(() => {
    const todayStr = getCairoDateStr();
    const monthStr = getCairoMonthStr();

    let todaySales = 0;
    let todayCount = 0;
    let monthSales = 0;
    let monthCount = 0;

    // Item sales: product_id -> { name, category, qty, revenue, image }
    const itemSalesMap = new Map<string, { name: string; category: string; qty: number; revenue: number; image?: string }>();
    // Extra sales: extra_id -> { name, price, count, revenue }
    const extraSalesMap = new Map<string, { name: string; price: number; count: number; revenue: number }>();
    // Branch sales: branch -> { count, revenue, deliveryCount, pickupCount }
    const branchSalesMap = new Map<string, { count: number; revenue: number; deliveryCount: number; pickupCount: number }>();

    activeOrders.forEach((o) => {
      const orderDate = o.created_at?.slice(0, 10) || "";
      const orderMonth = o.created_at?.slice(0, 7) || "";

      // Today's sales
      if (orderDate === todayStr) {
        todaySales += o.total;
        todayCount++;
      }

      // Monthly sales
      if (orderMonth === monthStr) {
        monthSales += o.total;
        monthCount++;
      }

      // Branch breakdown (all time within filter)
      const branchEntry = branchSalesMap.get(o.branch) || { count: 0, revenue: 0, deliveryCount: 0, pickupCount: 0 };
      branchEntry.count++;
      branchEntry.revenue += o.total;
      if (o.type === "delivery") branchEntry.deliveryCount++;
      else branchEntry.pickupCount++;
      branchSalesMap.set(o.branch, branchEntry);

      // Item-level aggregation
      o.items.forEach((item) => {
        const existing = itemSalesMap.get(item.product_id) || { name: item.name_ar, category: "", qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.total_price;
        if (!existing.name) existing.name = item.name_ar;
        itemSalesMap.set(item.product_id, existing);

        // Extras aggregation
        if (item.extras && item.extras.length > 0) {
          item.extras.forEach((ex) => {
            const exEntry = extraSalesMap.get(ex.id) || { name: ex.name_ar, price: ex.price, count: 0, revenue: 0 };
            exEntry.count += item.quantity; // Each item qty counts extra
            exEntry.revenue += ex.price * item.quantity;
            if (!exEntry.name) exEntry.name = ex.name_ar;
            extraSalesMap.set(ex.id, exEntry);
          });
        }
      });
    });

    // Merge with full catalog to include items with 0 sales
    const excludeCats: string[] = ["additions", "drinks"];
    const catalogProducts = menuProducts.filter((p) => !excludeCats.includes(p.category));

    const fullItemRanking = catalogProducts.map((p) => {
      const sold = itemSalesMap.get(p.id);
      const cat = menuCategories.find((c) => c.id === p.category);
      return {
        id: p.id,
        name: p.nameAr,
        nameEn: p.nameEn,
        category: cat?.nameAr || p.category,
        qty: sold?.qty || 0,
        revenue: sold?.revenue || 0,
        image: p.image,
        price: p.price,
      };
    });
    // Sort by qty desc, revenue desc as tiebreaker
    fullItemRanking.sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);

    // Merge extras with full catalog
    const fullExtraRanking = extrasList.map((ex) => {
      const sold = extraSalesMap.get(ex.id);
      return {
        id: ex.id,
        name: ex.nameAr,
        nameEn: ex.nameEn,
        price: ex.price,
        count: sold?.count || 0,
        revenue: sold?.revenue || 0,
      };
    });
    fullExtraRanking.sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    // Top/bottom selling
    const topItem = fullItemRanking.length > 0 ? fullItemRanking[0] : null;
    const leastItem = fullItemRanking.length > 0 ? fullItemRanking[fullItemRanking.length - 1] : null;
    const topExtra = fullExtraRanking.length > 0 ? fullExtraRanking[0] : null;

    return {
      todaySales,
      todayCount,
      monthSales,
      monthCount,
      topItem,
      leastItem,
      topExtra,
      fullItemRanking,
      fullExtraRanking,
      branchSalesMap,
    };
  }, [activeOrders, getCairoDateStr, getCairoMonthStr]);

  const rankBadgeClass = (rank: number) => {
    if (rank === 1) return "bg-amber-500 text-white";
    if (rank === 2) return "bg-gray-400 text-white";
    if (rank === 3) return "bg-amber-700 text-white";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      {/* HEADER + BRANCH FILTER */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" dir="rtl">
        <div>
          <h2 className="font-display text-xl font-bold sm:text-2xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            إحصائيات المبيعات
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            متابعة أداء المبيعات اليومية والشهرية والأصناف الأكثر والأقل طلباً
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isBranchAdmin ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              <Store className="h-3.5 w-3.5" />
              <span>{adminProfile?.branch}</span>
              <Lock className="h-3 w-3 text-primary/70" />
            </div>
          ) : (
            <select
              value={analyticsBranch}
              onChange={(e) => setAnalyticsBranch(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
            >
              <option value="all">كل الفروع</option>
              <option value="فرع المطار">فرع المطار</option>
              <option value="فرع المحطة">فرع المحطة</option>
            </select>
          )}
        </div>
      </div>

      {/* KPI CARDS (6 Cards) */}
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" dir="rtl">
        {/* 1. Today's Sales */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold">مبيعات النهاردة</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700">{formatEGP(analytics.todaySales)}</div>
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {analytics.todayCount} طلب اليوم
            </span>
          </div>
        </div>

        {/* 2. This Month's Sales */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold">مبيعات الشهر ده</span>
            <Layers className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-blue-700">{formatEGP(analytics.monthSales)}</div>
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-600">
              {analytics.monthCount} طلبات هذا الشهر
            </span>
          </div>
        </div>

        {/* 3. Top Selling Menu Item */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold">الأكثر مبيعاً في المنيو</span>
            <Flame className="h-4 w-4" />
          </div>
          {analytics.topItem ? (
            <>
              <div className="text-lg font-extrabold text-amber-700">{analytics.topItem.name}</div>
              <div className="text-[11px] text-amber-600/70">{analytics.topItem.category}</div>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                  تم بيع {analytics.topItem.qty} قطعة
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">لا توجد بيانات</div>
          )}
        </div>

        {/* 4. Least Selling Menu Item */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold">الأقل مبيعاً في المنيو</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          {analytics.leastItem ? (
            <>
              <div className="text-lg font-extrabold text-rose-700">{analytics.leastItem.name}</div>
              <div className="text-[11px] text-rose-600/70">{analytics.leastItem.category}</div>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  analytics.leastItem.qty === 0 ? "bg-rose-500/15 text-rose-700" : "bg-rose-500/10 text-rose-600"
                }`}>
                  {analytics.leastItem.qty === 0 ? "لم يتم البيع" : `تم بيع ${analytics.leastItem.qty} قطعة`}
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">لا توجد بيانات</div>
          )}
        </div>

        {/* 5. Most Requested Extra/Sauce */}
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold">الأكثر طلباً في الإضافات والصوصات</span>
            <Flame className="h-4 w-4" />
          </div>
          {analytics.topExtra ? (
            <>
              <div className="text-lg font-extrabold text-indigo-700">{analytics.topExtra.name}</div>
              <div className="text-[11px] text-indigo-600/70 font-mono">+{analytics.topExtra.price} ج.م</div>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                  تم طلبه {analytics.topExtra.count} مرة
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">لا توجد بيانات</div>
          )}
        </div>

        {/* 6. Branch Sales Breakdown */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-primary mb-2">
            <span className="text-xs font-bold">مبيعات الفروع</span>
            <Store className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            {(isBranchAdmin && adminProfile?.branch
              ? restaurant.branches.filter((b) => b.label === adminProfile.branch)
              : restaurant.branches
            ).map((branch) => {
              const data = analytics.branchSalesMap.get(branch.label) || { count: 0, revenue: 0, deliveryCount: 0, pickupCount: 0 };
              return (
                <div key={branch.label} className="rounded-xl bg-card border border-border/50 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Store className="h-3 w-3 text-primary" />
                      {branch.label}
                      <span className="text-[10px] text-muted-foreground font-normal">({data.count} طلب)</span>
                    </span>
                    <span className="text-xs font-extrabold font-mono text-primary">{formatEGP(data.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Truck className="h-2.5 w-2.5" />
                      توصيل: {data.deliveryCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Store className="h-2.5 w-2.5" />
                      استلام: {data.pickupCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* LEADERBOARDS (2-Column RTL Layout) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" dir="rtl">
        {/* RIGHT COLUMN: Menu Items Sales Leaderboard */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              ترتيب أصناف المنيو حسب المبيعات
            </h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {analytics.fullItemRanking.length} صنف
            </span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {analytics.fullItemRanking.map((item, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                    item.qty === 0 ? "border-border/50 opacity-60" : "border-border hover:border-primary/30"
                  }`}
                >
                  {/* Rank Badge */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${rankBadgeClass(rank)}`}>
                    #{rank}
                  </div>

                  {/* Image */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">{item.category}</div>
                  </div>

                  {/* Sales Badge & Revenue */}
                  <div className="text-left shrink-0 flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.qty === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-500/10 text-amber-700"
                    }`}>
                      {item.qty === 0 ? "لم يتم البيع" : `تم بيع ${item.qty} قطعة`}
                    </span>
                    <span className="text-xs font-extrabold font-mono text-primary">
                      {formatEGP(item.revenue)}
                    </span>
                  </div>
                </div>
              );
            })}

            {analytics.fullItemRanking.length === 0 && (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                لا توجد بيانات مبيعات حالياً
              </div>
            )}
          </div>
        </div>

        {/* LEFT COLUMN: Extras & Sauces Leaderboard */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Flame className="h-4 w-4 text-indigo-500" />
              ترتيب الإضافات والصوصات حسب الطلب
            </h3>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600">
              {analytics.fullExtraRanking.length} إضافة/صوص
            </span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {analytics.fullExtraRanking.map((extra, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={extra.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                    extra.count === 0 ? "border-border/50 opacity-60" : "border-border hover:border-indigo-500/30"
                  }`}
                >
                  {/* Rank Badge */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${rankBadgeClass(rank)}`}>
                    #{rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{extra.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">+{extra.price} ج.م</div>
                  </div>

                  {/* Usage Badge & Revenue */}
                  <div className="text-left shrink-0 flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      extra.count === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-indigo-500/10 text-indigo-700"
                    }`}>
                      {extra.count === 0 ? "لم يتم الطلب" : `تم طلبه ${extra.count} مرة`}
                    </span>
                    <span className="text-xs font-extrabold font-mono text-primary">
                      {formatEGP(extra.revenue)}
                    </span>
                  </div>
                </div>
              );
            })}

            {analytics.fullExtraRanking.length === 0 && (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                لا توجد بيانات حالياً
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────
// MENU & AVAILABILITY MANAGEMENT VIEW
// ─────────────────────────────────────────────
function MenuAvailabilityView({ user, adminProfile }: { user: User | null; adminProfile: AdminProfile | null }) {
  const isBranchAdmin = adminProfile?.role === "branch_admin";
  const [availability, setAvailability] = useState<MenuAvailabilityData>({ items: {}, extras: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [menuSearch, setMenuSearch] = useState("");
  const [extrasSheetOpen, setExtrasSheetOpen] = useState(false);

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    try {
      const res = await fetch("/api/menu/availability");
      const data = await res.json();
      if (data.success) {
        setAvailability({
          items: data.items || {},
          extras: data.extras || {},
        });
      }
    } catch (err) {
      console.warn("[MenuAvailability] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Real-time listener
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    try {
      const docRef = doc(db, "menu_availability", "current");
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Record<string, any>;
            setAvailability({
              items: data["items"] || {},
              extras: data["extras"] || {},
            });
          }
        },
        () => {}
      );
      return () => unsub();
    } catch {
      return;
    }
  }, []);

  const toggleAvailability = async (
    type: "item" | "extra",
    id: string,
    field: string,
    currentValue: boolean
  ) => {
    const newValue = !currentValue;
    const key = `${type}-${id}-${field}`;
    setSaving(key);

    // Optimistic update
    setAvailability((prev) => {
      const section = type === "item" ? "items" : "extras";
      const current = prev[section][id] || { isAvailableGlobal: true, branchAvailability: {} };
      const updated = { ...current };
      if (field === "global") {
        updated.isAvailableGlobal = newValue;
      } else {
        updated.branchAvailability = { ...updated.branchAvailability, [field]: newValue };
      }
      const nextState = { ...prev, [section]: { ...prev[section], [id]: updated } };
      // Instant Cross-Tab Broadcast (0ms to customer tabs)
      broadcastLiveSync("menu_availability_updated", nextState);
      return nextState;
    });

    try {
      const token = user ? await user.getIdToken() : "";
      await fetch("/api/admin/menu/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: type === "item" ? "toggle_item" : "toggle_extra",
          ...(type === "item" ? { itemId: id } : { extraId: id }),
          field,
          value: newValue,
        }),
      });
    } catch (err) {
      console.error("[MenuAvailability] Toggle failed:", err);
      // Revert
      fetchAvailability();
    } finally {
      setSaving(null);
    }
  };

  const getItemAvail = (id: string): ItemAvailability =>
    availability.items[id] || { isAvailableGlobal: true, branchAvailability: {} };

  const getExtraAvail = (id: string): ItemAvailability =>
    availability.extras[id] || { isAvailableGlobal: true, branchAvailability: {} };

  // Filter menu items (exclude extras/additions/drinks categories for main grid)
  const mainProducts = useMemo(() => {
    const excludeCats = ["additions", "drinks"];
    return menuProducts.filter((p) => !excludeCats.includes(p.category));
  }, []);

  const filteredProducts = useMemo(() => {
    const term = menuSearch.trim().toLowerCase();
    return mainProducts.filter(
      (p) =>
        (catFilter === "all" || p.category === catFilter) &&
        (!term || p.nameAr.includes(term) || p.nameEn?.toLowerCase().includes(term))
    );
  }, [mainProducts, catFilter, menuSearch]);

  const mainCategories = useMemo(() => {
    const excludeCats = ["additions", "drinks"];
    return menuCategories.filter((c) => !excludeCats.includes(c.id));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold sm:text-2xl">إدارة قائمة الطعام</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {mainProducts.length} صنف
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExtrasSheetOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition"
          >
            <Utensils className="h-4 w-4" />
            إدارة الإضافات والصوصات
          </button>
        </div>
      </div>

      {/* CATEGORY FILTER PILLS + SEARCH */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          <button
            onClick={() => setCatFilter("all")}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              catFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary"
            }`}
          >
            الكل
          </button>
          {mainCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                catFilter === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              {c.nameAr}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="بحث في المنيو..."
            className="w-full rounded-xl border border-input bg-card py-1.5 pr-8 pl-3 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* MENU ITEMS GRID */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProducts.map((product) => {
          const avail = getItemAvail(product.id);
          const globalOn = avail.isAvailableGlobal;
          const isSavingGlobal = saving === `item-${product.id}-global`;

          return (
            <div
              key={product.id}
              className={`flex flex-col rounded-2xl border bg-card shadow-card overflow-hidden transition ${
                !globalOn ? "border-destructive/30 opacity-75" : "border-border"
              }`}
            >
              {/* Image + Info */}
              <div className="relative h-32 overflow-hidden bg-muted">
                <img
                  src={product.image}
                  alt={product.nameAr}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2">
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                    {formatEGP(product.price)}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-3 space-y-2">
                <h3 className="font-bold text-sm leading-tight">{product.nameAr}</h3>
                {product.nameEn && (
                  <p className="text-[11px] text-muted-foreground font-latin" dir="ltr">{product.nameEn}</p>
                )}
                {product.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{product.description}</p>
                )}

                {/* Global Toggle: Read-only lock for branch admin, interactive for super admin */}
                {isBranchAdmin ? (
                  <div
                    className={`w-full rounded-full px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border ${
                      globalOn
                        ? "bg-secondary text-foreground/80 border-border"
                        : "bg-destructive/5 text-destructive/80 border-destructive/20"
                    } cursor-default`}
                    title="التحكم في الإتاحة العامة لكافة الفروع مقتصر على الإدارة العامة"
                  >
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{globalOn ? "متاح عام (مفعل بالإدارة العامة)" : "غير متاح عام (بقرار الإدارة العامة)"}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleAvailability("item", product.id, "global", globalOn)}
                    disabled={isSavingGlobal}
                    className={`w-full rounded-full px-3 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      globalOn
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                    } disabled:opacity-50`}
                  >
                    {isSavingGlobal ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : globalOn ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                    {globalOn ? "متاح عام (كافة الفروع)" : "غير متاح (مغلق بكافة الفروع)"}
                  </button>
                )}

                {/* Per-Branch Toggles */}
                {globalOn && (
                  <div className="flex gap-1.5">
                    {(isBranchAdmin && adminProfile?.branch ? [adminProfile.branch] : BRANCHES).map((branch) => {
                      const branchOn = avail.branchAvailability[branch] !== false;
                      const isSavingBranch = saving === `item-${product.id}-${branch}`;
                      return (
                        <button
                          key={branch}
                          onClick={() => toggleAvailability("item", product.id, branch, branchOn)}
                          disabled={isSavingBranch}
                          className={`flex-1 rounded-full px-2 py-1.5 text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                            branchOn
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          } disabled:opacity-50`}
                        >
                          {isSavingBranch && <Loader2 className="h-3 w-3 animate-spin" />}
                          {branch.replace("فرع ", "")}: {branchOn ? "متاح" : "غير متاح"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card py-16 text-center mt-4">
          <UtensilsCrossed className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-bold text-lg">لا توجد أصناف مطابقة</h3>
          <p className="mt-1 text-sm text-muted-foreground">جرب تغيير معايير البحث أو التصفية.</p>
        </div>
      )}

      {/* EXTRAS & SAUCES SHEET */}
      <ExtrasSheet
        open={extrasSheetOpen}
        onOpenChange={setExtrasSheetOpen}
        availability={availability}
        toggleAvailability={toggleAvailability}
        getExtraAvail={getExtraAvail}
        saving={saving}
        user={user}
        onRefresh={fetchAvailability}
        adminProfile={adminProfile}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// EXTRAS & SAUCES SHEET COMPONENT
// ─────────────────────────────────────────────
function ExtrasSheet({
  open,
  onOpenChange,
  availability,
  toggleAvailability,
  getExtraAvail,
  saving,
  user,
  onRefresh,
  adminProfile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  availability: MenuAvailabilityData;
  toggleAvailability: (type: "item" | "extra", id: string, field: string, currentValue: boolean) => void;
  getExtraAvail: (id: string) => ItemAvailability;
  saving: string | null;
  user: User | null;
  onRefresh: () => void;
  adminProfile: AdminProfile | null;
}) {
  const isBranchAdmin = adminProfile?.role === "branch_admin";
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("");
  const [addingExtra, setAddingExtra] = useState(false);
  const [deletingExtra, setDeletingExtra] = useState<string | null>(null);

  // Group extras into categories
  const sauceExtras = extrasList.filter((e) =>
    ["x-bigtasty", "x-ranch", "x-cheddar"].includes(e.id)
  );
  const upgradeExtras = extrasList.filter((e) =>
    ["x-kono", "x-potatoes", "x-burger", "x-hotdog", "x-smoked"].includes(e.id)
  );
  const cheeseExtras = extrasList.filter((e) =>
    ["x-kiri", "x-roman"].includes(e.id)
  );

  const handleAddExtra = async () => {
    if (!newExtraName.trim()) return;
    setAddingExtra(true);
    try {
      const extraId = `x-custom-${Date.now()}`;
      const token = user ? await user.getIdToken() : "";
      await fetch("/api/admin/menu/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "add_extra",
          extraId,
          nameAr: newExtraName.trim(),
          nameEn: "",
          price: Number(newExtraPrice) || 0,
        }),
      });
      setNewExtraName("");
      setNewExtraPrice("");
      onRefresh();
    } catch (err) {
      console.error("Failed to add extra:", err);
    } finally {
      setAddingExtra(false);
    }
  };

  const handleDeleteExtra = async (extraId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الإضافة؟")) return;
    setDeletingExtra(extraId);
    try {
      const token = user ? await user.getIdToken() : "";
      await fetch("/api/admin/menu/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "delete_extra", extraId }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to delete extra:", err);
    } finally {
      setDeletingExtra(null);
    }
  };

  const renderExtraGroup = (title: string, items: typeof extrasList) => (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-muted-foreground border-b border-border pb-1">{title}</h4>
      {items.map((extra) => {
        const avail = getExtraAvail(extra.id);
        const globalOn = avail.isAvailableGlobal;
        const isSavingGlobal = saving === `extra-${extra.id}-global`;

        return (
          <div
            key={extra.id}
            className={`rounded-xl border p-3 space-y-2 ${
              !globalOn ? "border-destructive/20 bg-destructive/5" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{extra.nameAr}</span>
                <span className="text-xs text-muted-foreground font-mono">+{extra.price} ج.م</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    globalOn
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {globalOn ? "متاح عام" : "مغلق"}
                </span>
              </div>
            </div>

            {/* Global Toggle: Read-only for branch admin, interactive for super admin */}
            {isBranchAdmin ? (
              <div
                className={`w-full rounded-lg px-2 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1 border ${
                  globalOn
                    ? "bg-secondary text-foreground/80 border-border"
                    : "bg-destructive/5 text-destructive/80 border-destructive/20"
                } cursor-default`}
              >
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span>{globalOn ? "متاح عام" : "مغلق عام"}</span>
              </div>
            ) : (
              <button
                onClick={() => toggleAvailability("extra", extra.id, "global", globalOn)}
                disabled={isSavingGlobal}
                className={`w-full rounded-lg px-2 py-1.5 text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                  globalOn
                    ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                } disabled:opacity-50`}
              >
                {isSavingGlobal ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : globalOn ? (
                  <ToggleRight className="h-3.5 w-3.5" />
                ) : (
                  <ToggleLeft className="h-3.5 w-3.5" />
                )}
                {globalOn ? "تشغيل عام" : "إيقاف عام"}
              </button>
            )}

            {/* Per-Branch Toggles */}
            {globalOn && (
              <div className="flex gap-1">
                {(isBranchAdmin && adminProfile?.branch ? [adminProfile.branch] : BRANCHES).map((branch) => {
                  const branchOn = avail.branchAvailability[branch] !== false;
                  const isSavingBranch = saving === `extra-${extra.id}-${branch}`;
                  return (
                    <button
                      key={branch}
                      onClick={() => toggleAvailability("extra", extra.id, branch, branchOn)}
                      disabled={isSavingBranch}
                      className={`flex-1 rounded-lg px-1.5 py-1 text-[10px] font-bold transition flex items-center justify-center gap-0.5 ${
                        branchOn
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                      } disabled:opacity-50`}
                    >
                      {isSavingBranch && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      {branch.replace("فرع ", "")}: {branchOn ? "متاح" : "غير متاح"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
        <SheetHeader className="text-right mb-4">
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <Utensils className="h-5 w-5 text-primary" />
            إدارة الإضافات والصوصات
          </SheetTitle>
          <SheetDescription>تشغيل / إيقاف / إضافة / تعديل</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Add New Extra: Super Admin Only */}
          {!isBranchAdmin && (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
            <h4 className="font-bold text-sm text-primary">إضافة صنف جديد</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="اسم الإضافة الجديدة..."
                value={newExtraName}
                onChange={(e) => setNewExtraName(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                placeholder="السعر"
                value={newExtraPrice}
                onChange={(e) => setNewExtraPrice(e.target.value)}
                className="w-20 rounded-lg border border-input bg-card px-3 py-1.5 text-sm outline-none focus:border-primary text-center"
              />
              <button
                onClick={handleAddExtra}
                disabled={addingExtra || !newExtraName.trim()}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary-deep transition disabled:opacity-50"
              >
                {addingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
          )}

          {/* Extras Groups */}
          {renderExtraGroup("ترقيات الوجبات والكريبات", upgradeExtras)}
          {renderExtraGroup("إضافات الصوصات", sauceExtras)}
          {renderExtraGroup("إضافات الجبن والحشوات", cheeseExtras)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────
// OPERATIONAL CONTROL VIEW (التحكم التشغيلي)
// ─────────────────────────────────────────────
function OperationalControlView({
  user,
  adminProfile,
}: {
  user: User | null;
  adminProfile: AdminProfile | null;
}) {
  const isBranchAdmin = adminProfile?.role === "branch_admin";
  const [settings, setSettings] = useState<OperationalControlSettings>(DEFAULT_OPERATIONAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isShiftActive, setIsShiftActive] = useState(() => isWithinCairoShift());

  // Check shift every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setIsShiftActive(isWithinCairoShift());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch operational settings from backend
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/operational");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.warn("[OperationalControlView] Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Real-time listener via client Firestore if available
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    try {
      const docRef = doc(db, "settings", "operational_control");
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as OperationalControlSettings;
            setSettings((prev) => ({
              ...prev,
              ...data,
              branches: {
                ...prev.branches,
                ...(data.branches || {}),
              },
            }));
          }
        },
        (err) => {
          console.debug("[OperationalControlView] Snapshot listener fallback:", err.message);
        }
      );
      return () => unsub();
    } catch {
      return;
    }
  }, []);

  // Save changes to backend
  const handleSaveSettings = async (updatedSettings: OperationalControlSettings) => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/admin/settings/operational", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updatedSettings),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل حفظ التغييرات");
      }

      setSettings(data.settings);
      setSaveSuccess(true);
      // Instant Cross-Tab Broadcast for operational settings
      broadcastLiveSync("operational_settings_updated", data.settings);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("[OperationalControlView] Save failed:", err);
      setSaveError(err.message || "حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  // Toggle master site status
  const handleToggleSiteOpen = () => {
    const updated: OperationalControlSettings = {
      ...settings,
      isSiteOpen: !settings.isSiteOpen,
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  // Toggle specific branch manual status
  const handleToggleBranchOpen = (branchName: string) => {
    const current = settings.branches?.[branchName] || DEFAULT_OPERATIONAL_SETTINGS.branches[branchName] || {
      isOpen: true,
      autoCloseAfterHours: true,
      closedMessage: "",
    };
    const updated: OperationalControlSettings = {
      ...settings,
      branches: {
        ...settings.branches,
        [branchName]: {
          ...current,
          isOpen: !current.isOpen,
        },
      },
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  // Toggle auto-close after hours
  const handleToggleAutoClose = (branchName: string) => {
    const current = settings.branches?.[branchName] || DEFAULT_OPERATIONAL_SETTINGS.branches[branchName] || {
      isOpen: true,
      autoCloseAfterHours: true,
      closedMessage: "",
    };
    const updated: OperationalControlSettings = {
      ...settings,
      branches: {
        ...settings.branches,
        [branchName]: {
          ...current,
          autoCloseAfterHours: !current.autoCloseAfterHours,
        },
      },
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  // Update per-branch closed message
  const handleUpdateBranchMessage = (branchName: string, message: string) => {
    setSettings((prev) => ({
      ...prev,
      branches: {
        ...prev.branches,
        [branchName]: {
          ...(prev.branches?.[branchName] || {
            isOpen: true,
            autoCloseAfterHours: true,
            closedMessage: "",
          }),
          closedMessage: message,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const branchKeys = isBranchAdmin && adminProfile?.branch
    ? [adminProfile.branch]
    : ["فرع المطار", "فرع المحطة"];

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* 1. TAB HEADER */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
            التحكم التشغيلي العام والفروع
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            إدارة حالة الموقع العام، وتشغيل الفروع المستقل، ومواعيد العمل الرسمية
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 animate-in fade-in">
              <CheckCircle className="h-4 w-4" />
              تم حفظ التغييرات بنجاح
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive animate-in fade-in">
              <AlertTriangle className="h-4 w-4" />
              {saveError}
            </span>
          )}
          <button
            onClick={() => handleSaveSettings(settings)}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isBranchAdmin ? `حفظ إعدادات ${adminProfile?.branch}` : "حفظ كافة التعديلات"}
          </button>
        </div>
      </div>

      {/* 2. SHIFT STATUS & WORKING HOURS BANNER */}
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition ${
        isShiftActive
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
          : "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${
              isShiftActive
                ? "bg-emerald-500 text-white"
                : "bg-amber-500 text-white"
            }`}>
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg">
                  وقت الوردية: {settings.workingHours?.label || "من 12:00 ظهراً حتى 2:00 صباحاً"}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isShiftActive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${isShiftActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  {isShiftActive ? "وقت الوردية — يمكن فتح الفروع يدوياً الآن" : "خارج أوقات الوردية الرسمية"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {isShiftActive
                  ? "المطعم حالياً داخل نطاق ساعات العمل الرسمية بتوقيت القاهرة. يمكنك فتح الفروع أو إغلاقها حسب ضغط التشغيل."
                  : "المطعم حالياً بعد الساعة 2:00 صباحاً وقبل 12:00 ظهراً. الفروع ذات الإغلاق التلقائي تكون مغلقة آلياً للعملاء ما لم تقم بفتحها يدوياً."}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-xs font-mono font-bold bg-card border border-border/80 rounded-xl px-3 py-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>وردية 12 م – 2 ص (توقيت القاهرة)</span>
          </div>
        </div>
      </div>

      {/* 3. GLOBAL WEBSITE STATUS CARD */}
      {isBranchAdmin ? (
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-card opacity-95">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-3.5 w-3.5 rounded-full ${settings.isSiteOpen ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
                <h3 className="font-display text-xl sm:text-2xl font-bold">
                  حالة الموقع العامة (كافة الفروع)
                </h3>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-muted-foreground border border-border">
                  <Lock className="h-3 w-3" />
                  إشراف الإدارة العامة
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {settings.isSiteOpen
                  ? "الموقع مفتوح حالياً للطلبات على مستوى كافة الفروع."
                  : "الموقع مغلق حالياً بقرار من الإدارة العامة."}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold border ${
              settings.isSiteOpen
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}>
              {settings.isSiteOpen ? "الموقع مفتوح عام" : "الموقع مغلق عام"}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
            <span>إغلاق أو فتح الموقع العام بالكامل مقتصر على حساب الإدارة العامة (Super Admin). يمكنك التحكم في تشغيل فرعك المستقل أدناه.</span>
          </div>
        </div>
      ) : (
        <div className={`rounded-3xl border p-5 sm:p-7 shadow-card transition ${
          settings.isSiteOpen
            ? "border-emerald-500/30 bg-card ring-1 ring-emerald-500/10"
            : "border-destructive/40 bg-card ring-1 ring-destructive/10"
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 border-b border-border pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-3.5 w-3.5 rounded-full ${settings.isSiteOpen ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
                <h3 className="font-display text-xl sm:text-2xl font-bold">
                  حالة الموقع العامة - كافة الفروع
                </h3>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  settings.isSiteOpen
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}>
                  {settings.isSiteOpen ? "الموقع مفتوح" : "الموقع مغلق"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {settings.isSiteOpen
                  ? "الموقع مفتوح بالكامل للطلبات - العملاء يمكنهم تقديم طلبات جديدة في أي فرع مفتوح."
                  : "الموقع مغلق بالكامل - يتم إظهار شاشة الإغلاق التلقائية الفورية لكافة الزوار على المتجر وصفحة الدفع."}
              </p>
            </div>

            {/* Master Toggle Button */}
            <button
              onClick={handleToggleSiteOpen}
              disabled={saving}
              className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-extrabold shadow-pop transition disabled:opacity-50 ${
                settings.isSiteOpen
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : settings.isSiteOpen ? (
                <>
                  <Power className="h-5 w-5" />
                  إغلاق الموقع العام الآن
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  فتح الموقع العام للطلبات
                </>
              )}
            </button>
          </div>

          {/* Custom Global Closed Message Input */}
          <div className="mt-5 space-y-2">
            <label className="block text-xs sm:text-sm font-bold text-foreground">
              رسالة إغلاق الموقع العامة (تظهر عند إغلاق المطعم كلياً):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                rows={2}
                value={settings.globalClosedMessage}
                onChange={(e) => setSettings({ ...settings, globalClosedMessage: e.target.value })}
                placeholder="اكتب رسالة الإغلاق التي ستظهر للعملاء..."
                className="flex-1 rounded-2xl border border-input bg-secondary/40 px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-primary focus:bg-card transition"
              />
              <button
                onClick={() => handleSaveSettings(settings)}
                disabled={saving}
                className="shrink-0 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50 sm:self-stretch"
              >
                تحديث الرسالة
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              القيمة الافتراضية: "المطعم مغلق حالياً، نسعد باستقبال طلباتكم في أوقات العمل القادمة ❤️"
            </p>
          </div>
        </div>
      )}

      {/* 4. INDEPENDENT BRANCH CONTROL SECTION */}
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            تشغيل الفروع المستقل
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            يمكن فتح أو إغلاق أي فرع بشكل مستقل مع تخصيص رسالة إغلاق لكل فرع
          </p>
        </div>

        {/* 2-Column RTL Grid for Branches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {branchKeys.map((branchName) => {
            const branchConfig = settings.branches?.[branchName] || DEFAULT_OPERATIONAL_SETTINGS.branches[branchName] || {
              isOpen: true,
              autoCloseAfterHours: true,
              closedMessage: `${branchName} مغلق حالياً، نسعد باستقبال طلباتكم في أوقات العمل القادمة.`,
            };

            const branchAddress =
              restaurant.branches.find((b) => b.label === branchName)?.address || "أسوان";

            return (
              <div
                key={branchName}
                className={`flex flex-col justify-between rounded-3xl border bg-card p-5 sm:p-6 shadow-card transition ${
                  branchConfig.isOpen
                    ? "border-border hover:border-primary/40"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div>
                  {/* Branch Header */}
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        branchConfig.isOpen
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        <Store className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base sm:text-lg">{branchName}</h4>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {branchAddress}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                        branchConfig.isOpen
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      }`}>
                        {branchConfig.isOpen ? "مفتوح" : "مغلق"}
                      </span>

                      {/* Manual Toggle Button */}
                      <button
                        onClick={() => handleToggleBranchOpen(branchName)}
                        disabled={saving}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-xs disabled:opacity-50 ${
                          branchConfig.isOpen
                            ? "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {branchConfig.isOpen ? "إغلاق" : "فتح"}
                      </button>
                    </div>
                  </div>

                  {/* Auto-Close After Working Hours Box (2:00 ص) */}
                  <div className="mt-4 rounded-2xl border border-border/80 bg-secondary/50 p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          الإغلاق التلقائي بعد مواعيد العمل 2:00 ص
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          branchConfig.autoCloseAfterHours
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {branchConfig.autoCloseAfterHours ? "مفعل" : "معطل"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAutoClose(branchName)}
                          disabled={saving}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                            branchConfig.autoCloseAfterHours
                              ? "border border-border bg-card text-foreground hover:bg-secondary"
                              : "bg-primary text-primary-foreground hover:bg-primary-deep"
                          }`}
                        >
                          {branchConfig.autoCloseAfterHours ? "إيقاف" : "تفعيل"}
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                      عند التفعيل، يتم إغلاق الفرع تلقائياً الساعة 2:00 صباحاً وحتى تقوم بفتحه يدوياً. عند الإيقاف، يظل الفرع مفتوحاً أو تحت التحكم اليدوي الكامل.
                    </p>
                  </div>

                  {/* Per-Branch Closed Message Input */}
                  <div className="mt-4 space-y-1.5">
                    <label className="block text-xs font-bold text-foreground">
                      رسالة إغلاق الفرع:
                    </label>
                    <textarea
                      rows={2}
                      value={branchConfig.closedMessage}
                      onChange={(e) => handleUpdateBranchMessage(branchName, e.target.value)}
                      placeholder={`رسالة تظهر للعميل عند محاولة اختيار ${branchName}...`}
                      className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs outline-none focus:border-primary transition"
                    />
                  </div>
                </div>

                {/* Footer Save for Branch */}
                <div className="mt-4 pt-3 border-t border-border flex justify-end">
                  <button
                    onClick={() => handleSaveSettings(settings)}
                    disabled={saving}
                    className="rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-bold text-foreground hover:border-primary transition disabled:opacity-50"
                  >
                    حفظ إعدادات {branchName}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// ADMIN LOGIN COMPONENT
// ─────────────────────────────────────────────
function AdminLogin({
  onLoggedIn,
}: {
  onLoggedIn: (user: User, profile: AdminProfile) => void;
}) {
  const [email, setEmail] = useState("admin@ashmawy.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Automatically trigger backend seeding of branch admin accounts on startup
  useEffect(() => {
    fetch('/api/admin/seed', { method: 'POST' }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setResetSuccess(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setLoginError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);
    try {
      if (!auth) {
        throw new Error("Firebase Auth غير مهيأ");
      }

      // Configure inMemoryPersistence before signing in so credentials are never saved
      try {
        await setPersistence(auth, inMemoryPersistence);
      } catch (pErr) {
        console.warn("[AdminAuth] inMemoryPersistence configuration fallback:", pErr);
      }

      // Authenticate with Firebase Email & Password with automatic self-healing retry
      let cred: any;
      try {
        cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      } catch (firstErr: any) {
        if (
          firstErr.code === 'auth/user-not-found' ||
          firstErr.code === 'auth/invalid-credential' ||
          firstErr.code === 'auth/invalid-login-credentials'
        ) {
          try {
            await fetch('/api/admin/seed', { method: 'POST' });
            cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          } catch {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      // Verify admin authorization and retrieve authoritative role & branch scope
      const token = await cred.user.getIdToken();
      let profile: AdminProfile | null = null;

      try {
        const meRes = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.success && meData.admin) {
            profile = meData.admin;
          }
        }
      } catch {}

      if (!profile) {
        const testRes = await fetch("/api/admin/orders", {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);

        if (testRes && (testRes.status === 401 || testRes.status === 403)) {
          // If server returns 401/403, verify if email is in the admin allowlist before rejecting
          const localProfile = deriveAdminProfile(normalizedEmail);
          if (localProfile) {
            profile = localProfile;
          } else {
            await firebaseSignOut(auth).catch(() => {});
            throw new Error("غير مصرح لك بالوصول. هذا الحساب ليس لديه صلاحيات مسؤول لوحة التحكم.");
          }
        } else if (testRes && testRes.ok) {
          const testData = await testRes.json().catch(() => ({}));
          profile = testData?.admin || deriveAdminProfile(normalizedEmail);
        } else {
          profile = deriveAdminProfile(normalizedEmail);
        }
      }

      // Successful login for this visit
      onLoggedIn(cred.user, profile);
    } catch (err: any) {
      console.error("[AdminLogin] Sign in failed:", err);
      let msg = err.message || "فشل تسجيل الدخول. يرجى التحقق من صحة البيانات والمحاولة مرة أخرى.";
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/invalid-login-credentials" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        msg = "بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.";
      } else if (err.code === "auth/user-disabled") {
        msg = "تم تعطيل هذا الحساب. يرجى التواصل مع إدارة النظام.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "تم حظر المحاولات مؤقتاً لتكرار الفشل. يرجى الانتظار دقيقة ثم المحاولة مجدداً.";
      } else if (err.code === "auth/operation-not-allowed") {
        msg = "تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعّل في Firebase.";
      } else if (
        err.code === "auth/network-request-failed" ||
        err.name === "TypeError" ||
        (err.message && err.message.toLowerCase().includes("networkerror")) ||
        (err.message && err.message.toLowerCase().includes("failed to fetch"))
      ) {
        msg = "تعذر الاتصال بخدمة التحقق. يرجى التأكد من اتصال الإنترنت وإيقاف أي أداة حظر إعلانات (AdBlocker) قد تمنع الاتصال بـ Firebase.";
      }
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoginError(null);
    setResetSuccess(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLoginError("يرجى إدخال البريد الإلكتروني أولاً في الحقل أدناه لإرسال رابط إعادة تعيين كلمة المرور.");
      return;
    }

    setResetLoading(true);
    try {
      if (auth) {
        await sendPasswordResetEmail(auth, normalizedEmail);
        setResetSuccess("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.");
      } else {
        throw new Error("Firebase Auth غير مهيأ");
      }
    } catch (err: any) {
      console.error("[AdminLogin] Password reset failed:", err);
      let msg = "تعذر إرسال رابط إعادة تعيين كلمة المرور. يرجى المحاولة لاحقاً.";
      if (err.code === "auth/user-not-found") {
        msg = "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.";
      } else if (err.code === "auth/invalid-email") {
        msg = "صيغة البريد الإلكتروني غير صحيحة.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "تم حظر المحاولات مؤقتاً لتكرار الطلب. يرجى الانتظار والمحاولة لاحقاً.";
      }
      setLoginError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50/80 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">دخول الإدارة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            لوحة تحكم وإدارة طلبات مطعم عشماوي
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            جلسة آمنة (يطلب تسجيل الدخول في كل زيارة)
          </div>
        </div>

        {loginError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive leading-relaxed">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-600">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {resetSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold">البريد الإلكتروني للمسؤول *</label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ashmawy.com"
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary text-left placeholder:text-right font-sans"
              autoComplete="username"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold">كلمة المرور *</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-xs font-medium text-primary hover:underline transition disabled:opacity-50"
              >
                {resetLoading ? "جاري الإرسال..." : "نسيت كلمة المرور؟"}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-card py-2.5 pr-4 pl-10 text-sm outline-none focus:border-primary text-left font-mono"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1"
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-bold text-primary-foreground shadow-pop hover:bg-primary-deep transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "تسجيل الدخول للوحة التحكم"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>مخصص لطاقم عمل وفروع عشماوي فقط</span>
          <Link to="/" className="font-bold text-primary hover:underline flex items-center gap-1">
            العودة للمتجر <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
