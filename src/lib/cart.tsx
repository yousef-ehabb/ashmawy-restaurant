import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Extra, Product, Size } from "@/data/menu";

export interface CartLine {
  key: string;
  productId: string;
  nameAr: string;
  nameEn?: string | undefined;
  image: string;
  size?: Size | undefined;
  extras: Extra[];
  unitPrice: number;
  qty: number;
}

interface CartCtx {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (p: Product, opts?: { size?: Size | undefined; extras?: Extra[]; qty?: number }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const STORAGE = "ashmawy-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // SSR-safe localStorage restoration
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Sanitize loaded lines to ensure valid numbers and structures
          const validLines = parsed.filter(
            (l): l is CartLine =>
              Boolean(l && typeof l === "object" && l.key && l.productId && typeof l.qty === "number" && l.qty > 0)
          );
          setLines(validLines);
        }
      }
    } catch (e) {
      console.warn("[Cart] Failed to restore cart from storage:", e);
    }
    setLoaded(true);
  }, []);

  // SSR-safe localStorage sync
  useEffect(() => {
    if (typeof window === "undefined" || !loaded) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(lines));
    } catch (e) {
      console.warn("[Cart] Failed to save cart to storage:", e);
    }
  }, [lines, loaded]);

  const value = useMemo<CartCtx>(() => {
    const add: CartCtx["add"] = (p, opts = {}) => {
      // If product has size tiers, pick chosen size or default to first tier
      const size = opts.size ?? p.sizes?.[0];
      const extras = [...(opts.extras ?? [])].sort((a, b) => a.id.localeCompare(b.id));
      const key = [p.id, size?.id ?? "", ...extras.map((e) => e.id)].join("|");
      
      // Calculate display unit price from catalog base price + size delta / extra deltas
      const basePrice = size?.price ?? p.price;
      const extrasTotal = extras.reduce((sum, e) => sum + (Number(e.price) || 0), 0);
      const unitPrice = Math.max(0, basePrice + extrasTotal);
      const qty = Math.max(1, opts.qty ?? 1);

      setLines((prev) => {
        const i = prev.findIndex((l) => l.key === key);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i]!, qty: next[i]!.qty + qty };
          return next;
        }
        return [
          ...prev,
          {
            key,
            productId: p.id,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            image: p.image,
            size,
            extras,
            unitPrice,
            qty,
          },
        ];
      });
    };

    return {
      lines,
      count: lines.reduce((s, l) => s + (l.qty || 0), 0),
      subtotal: lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0),
      open,
      setOpen,
      add,
      setQty: (key, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((l) => l.key !== key)
            : prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l))
        ),
      remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      clear: () => setLines([]),
    };
  }, [lines, open]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
