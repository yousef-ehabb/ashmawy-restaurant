import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { formatEGP } from "@/data/menu";

export function QtyControl({ qty, onChange, name }: { qty: number; onChange: (n: number) => void; name: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-background">
      <button onClick={() => onChange(qty + 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label={`زيادة ${name}`}><Plus className="h-3.5 w-3.5" /></button>
      <span className="w-7 text-center text-sm font-bold" aria-live="polite">{qty}</span>
      <button onClick={() => onChange(qty - 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label={`تقليل ${name}`}><Minus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function CartDrawer() {
  const { open, setOpen, lines, subtotal, setQty, remove } = useCart();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" dir="rtl" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5 text-right">
          <SheetTitle className="font-display text-3xl font-normal text-primary">سلتك</SheetTitle>
          <SheetDescription>{lines.length ? "راجع طلبك قبل التأكيد" : "السلة فاضية لسه"}</SheetDescription>
        </SheetHeader>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary"><ShoppingBag className="h-9 w-9 text-primary" /></div>
            <p className="text-muted-foreground">ضيف أكلتك المفضلة من المنيو</p>
            <a href="/#menu" onClick={() => setOpen(false)} className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">تصفح المنيو</a>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {lines.map((l) => (
                <li key={l.key} className="flex gap-3 py-4">
                  <img src={l.image} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold leading-6">{l.nameAr}{l.size && <span className="text-sm text-muted-foreground"> · {l.size.label}</span>}</p>
                      <button onClick={() => remove(l.key)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`حذف ${l.nameAr}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {l.extras.length > 0 && <p className="text-xs text-muted-foreground">+ {l.extras.map((e) => e.nameAr).join("، ")}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <QtyControl qty={l.qty} onChange={(n) => setQty(l.key, n)} name={l.nameAr} />
                      <span className="font-extrabold text-primary">{formatEGP(l.qty * l.unitPrice)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-secondary/50 p-5">
              <div className="mb-4 flex justify-between text-lg font-extrabold"><span>الإجمالي الفرعي</span><span>{formatEGP(subtotal)}</span></div>
              <Link to="/checkout" onClick={() => setOpen(false)} className="block rounded-full bg-primary py-3.5 text-center font-extrabold text-primary-foreground shadow-pop hover:bg-primary-deep">
                كمّل الطلب
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
