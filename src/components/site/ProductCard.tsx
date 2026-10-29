import { Flame, Plus, Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { extrasList, formatEGP, type Extra, type Product } from "@/data/menu";
import { useCart } from "@/lib/cart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QtyControl } from "./CartDrawer";
import {
  useMenuAvailability,
  isItemAvailable,
  type ItemAvailability,
} from "@/hooks/useMenuAvailability";

interface ProductCardProps {
  product: Product;
  selectedBranch?: string | undefined;
}

export function ProductCard({ product, selectedBranch }: ProductCardProps) {
  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const needsDialog = product.customizable || (product.sizes && product.sizes.length > 1);
  const { availability } = useMenuAvailability();

  const itemAvail = availability.items[product.id];
  const available = isItemAvailable(itemAvail, selectedBranch);

  const quickAdd = () => {
    if (!available) return;
    if (needsDialog) return setOpen(true);
    add(product);
    toast.success(`اتضاف ${product.nameAr} للسلة`);
  };

  return (
    <article className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-pop ${!available ? "opacity-60 grayscale-[30%]" : ""}`}>
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img src={product.image} alt={product.nameAr} width={400} height={400} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute top-2 right-2 flex gap-1">
          {!available && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-extrabold text-destructive-foreground">
              <Ban className="h-3 w-3" />غير متاح حالياً
            </span>
          )}
          {available && product.tags?.includes("new") && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-accent-foreground">جديد</span>}
          {available && product.tags?.includes("spicy") && <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-foreground"><Flame className="h-3 w-3" />حار</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="text-product font-bold leading-snug">{product.nameAr}</h3>
        {product.nameEn && <p className="font-latin text-xs text-muted-foreground" dir="ltr">{product.nameEn}</p>}
        {product.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground font-normal">{product.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="font-extrabold text-primary">
            {product.sizes && product.sizes.length > 1 && <span className="text-xs font-semibold text-muted-foreground">من </span>}
            {formatEGP(product.sizes?.[0]?.price ?? product.price)}
          </span>
          {available ? (
            <button onClick={quickAdd} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm" aria-label={`أضف ${product.nameAr} للسلة`}>
              <Plus className="h-4 w-4" /><span className="hidden min-[380px]:inline">أضف للسلة</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-2 text-xs font-bold text-muted-foreground cursor-not-allowed">
              <Ban className="h-3.5 w-3.5" />غير متاح
            </span>
          )}
        </div>
      </div>
      {needsDialog && <CustomizeDialog product={product} open={open} onOpenChange={setOpen} selectedBranch={selectedBranch} />}
    </article>
  );
}

function CustomizeDialog({ product, open, onOpenChange, selectedBranch }: { product: Product; open: boolean; onOpenChange: (v: boolean) => void; selectedBranch?: string | undefined }) {
  const { add, setOpen: openCart } = useCart();
  const [sizeId, setSizeId] = useState(product.sizes?.[0]?.id);
  const [chosen, setChosen] = useState<Extra[]>([]);
  const [qty, setQty] = useState(1);
  const size = product.sizes?.find((s) => s.id === sizeId);
  const unit = (size?.price ?? product.price) + chosen.reduce((s, e) => s + e.price, 0);

  const { availability } = useMenuAvailability();

  const toggle = (e: Extra) => setChosen((c) => (c.some((x) => x.id === e.id) ? c.filter((x) => x.id !== e.id) : [...c, e]));

  const confirm = () => {
    add(product, { size, extras: chosen, qty });
    toast.success(`اتضاف ${product.nameAr} للسلة`, { action: { label: "السلة", onClick: () => openCart(true) } });
    onOpenChange(false);
    setChosen([]);
    setQty(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
        <img src={product.image} alt="" className="h-44 w-full object-cover" />
        <div className="space-y-5 p-5">
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-extrabold">{product.nameAr}</DialogTitle>
            {product.description && <DialogDescription className="leading-6">{product.description}</DialogDescription>}
          </DialogHeader>
          {product.sizes && product.sizes.length > 0 && (
            <fieldset>
              <legend className="mb-2 font-bold">الحجم</legend>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button key={s.id} onClick={() => setSizeId(s.id)} aria-pressed={s.id === sizeId} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${s.id === sizeId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
                    {s.label} · {formatEGP(s.price)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {product.customizable && (
            <fieldset>
              <legend className="mb-2 font-bold">إضافات <span className="text-sm font-normal text-muted-foreground">(اختياري)</span></legend>
              <div className="grid grid-cols-2 gap-2">
                {extrasList.map((e) => {
                  const extraAvail = availability.extras[e.id];
                  const extraAvailable = isItemAvailable(extraAvail, selectedBranch);
                  const on = chosen.some((x) => x.id === e.id);

                  if (!extraAvailable) {
                    return (
                      <label key={e.id} className="flex cursor-not-allowed items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm opacity-50">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" disabled className="accent-primary" />
                          <span className="line-through">{e.nameAr}</span>
                        </span>
                        <span className="text-[10px] text-destructive font-bold">غير متاح</span>
                      </label>
                    );
                  }

                  return (
                    <label key={e.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition ${on ? "border-primary bg-secondary" : "border-border"}`}>
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={on} onChange={() => toggle(e)} className="accent-primary" />
                        {e.nameAr}
                      </span>
                      <span className="text-xs text-muted-foreground">+{e.price}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <QtyControl qty={qty} onChange={(n) => setQty(Math.max(1, n))} name={product.nameAr} />
            <button onClick={confirm} className="flex-1 rounded-full bg-primary py-3 font-extrabold text-primary-foreground hover:bg-primary-deep">
              أضف · {formatEGP(unit * qty)}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
