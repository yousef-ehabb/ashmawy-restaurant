import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Extra, Product, Size } from "@/data/menu";

export interface CartLine {
  key: string;
  productId: string;
  nameAr: string;
  nameEn?: string;
  image: string;
  size?: Size;
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
  add: (p: Product, opts?: { size?: Size; extras?: Extra[]; qty?: number }) => void;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE, JSON.stringify(lines));
  }, [lines, loaded]);

  const value = useMemo<CartCtx>(() => {
    const add: CartCtx["add"] = (p, opts = {}) => {
      const size = opts.size ?? p.sizes?.[0];
      const extras = [...(opts.extras ?? [])].sort((a, b) => a.id.localeCompare(b.id));
      const key = [p.id, size?.id ?? "", ...extras.map((e) => e.id)].join("|");
      const unitPrice = (size?.price ?? p.price) + extras.reduce((s, e) => s + e.price, 0);
      const qty = opts.qty ?? 1;
      setLines((prev) => {
        const i = prev.findIndex((l) => l.key === key);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], qty: next[i].qty + qty };
          return next;
        }
        return [...prev, { key, productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, image: p.image, size, extras, unitPrice, qty }];
      });
    };
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
      open,
      setOpen,
      add,
      setQty: (key, qty) =>
        setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l)))),
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
