import { Link, useLocation } from "@tanstack/react-router";
import { Menu, ShoppingBag, X, PackageSearch } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/ashmawy-logo.png.asset.json";
import { useCart } from "@/lib/cart";

export const navLinks = [
  { href: "/#top", label: "الرئيسية" },
  { href: "/#menu", label: "المنيو" },
  { href: "/#offers", label: "عروضنا" },
  { href: "/#about", label: "من نحن" },
  { href: "/#contact", label: "تواصل معنا" },
];

export function Header() {
  const { count, setOpen } = useCart();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();

  // Completely hide header on /admin
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 md:flex md:justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="عشماوي - الرئيسية">
          <img src={logo.url} alt="شعار عشماوي" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-primary/20" />
          <span className="truncate font-display text-2xl text-primary">عشماوي</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-bold text-foreground/80 transition-colors hover:bg-secondary hover:text-primary">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/track"
            className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-card px-4 py-2 text-sm font-bold text-primary shadow-xs transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            <PackageSearch className="h-4 w-4" />
            <span>تتبع طلبك</span>
          </Link>
          <a href="/#menu" className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex">
            اطلب الآن
          </a>
          <button
            onClick={() => setOpen(true)}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`السلة، ${count} منتج`}
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -left-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobile((v) => !v)}
            className="grid h-11 w-11 place-items-center rounded-full border border-border md:hidden"
            aria-label="القائمة"
            aria-expanded={mobile}
          >
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="border-t border-border bg-background px-4 pb-4 md:hidden" aria-label="قائمة الموبايل">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobile(false)} className="block border-b border-border/60 py-3 font-bold">
              {l.label}
            </a>
          ))}
          <Link
            to="/track"
            onClick={() => setMobile(false)}
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-card py-2.5 text-center font-bold text-primary shadow-xs"
          >
            <PackageSearch className="h-4 w-4" />
            <span>تتبع طلبك</span>
          </Link>
          <a href="/#menu" onClick={() => setMobile(false)} className="mt-2 block rounded-full bg-primary py-3 text-center font-extrabold text-primary-foreground">
            اطلب الآن
          </a>
        </nav>
      )}
    </header>
  );
}
