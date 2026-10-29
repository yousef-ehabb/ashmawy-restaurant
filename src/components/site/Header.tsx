import { Link, useLocation } from "@tanstack/react-router";
import { Menu, ShoppingBag, X, PackageSearch } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
  const isHomepage = location.pathname === "/";

  // Completely hide header on /admin
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <HeaderInner
      count={count}
      setCartOpen={setOpen}
      mobile={mobile}
      setMobile={setMobile}
      isHomepage={isHomepage}
    />
  );
}

function HeaderInner({
  count,
  setCartOpen,
  mobile,
  setMobile,
  isHomepage,
}: {
  count: number;
  setCartOpen: (v: boolean) => void;
  mobile: boolean;
  setMobile: (v: boolean | ((prev: boolean) => boolean)) => void;
  isHomepage: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback(() => {
    // On homepage, transition after scrolling past hero (~100px threshold)
    setScrolled(window.scrollY > 60);
  }, []);

  useEffect(() => {
    if (!isHomepage) return;
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // set initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomepage, handleScroll]);

  // On homepage: transparent over hero, solid once scrolled
  // On other pages: always solid
  const isTransparent = isHomepage && !scrolled;

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        isTransparent
          ? "bg-transparent"
          : "bg-ink/95 shadow-lg backdrop-blur-md"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 md:flex md:justify-between">
        <Link to="/" className="flex shrink-0 items-center" aria-label="عشماوي - الرئيسية">
          <img
            src={logo.url}
            alt="شعار عشماوي"
            width={44}
            height={44}
            className={`h-11 w-11 shrink-0 rounded-full object-cover transition-all duration-300 ${
              isTransparent ? "ring-2 ring-white/30" : "ring-2 ring-primary/30"
            }`}
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                isTransparent
                  ? "text-white/85 hover:bg-white/10 hover:text-white"
                  : "text-cream/80 hover:bg-cream/10 hover:text-cream"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/track"
            className={`hidden items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium shadow-xs transition sm:inline-flex ${
              isTransparent
                ? "border-white/25 text-white hover:border-white/50 hover:bg-white/10"
                : "border-cream/20 text-cream hover:border-cream/40 hover:bg-cream/10"
            }`}
          >
            <PackageSearch className="h-4 w-4" />
            <span>تتبع طلبك</span>
          </Link>
          <a
            href="/#menu"
            className={`hidden rounded-full px-5 py-2.5 text-sm font-bold shadow-pop transition sm:inline-flex ${
              isTransparent
                ? "bg-primary text-primary-foreground hover:bg-primary-deep"
                : "bg-primary text-primary-foreground hover:bg-primary-deep"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
          >
            اطلب الآن
          </a>
          <button
            onClick={() => setCartOpen(true)}
            className={`relative grid h-11 w-11 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isTransparent
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-cream/10 text-cream hover:bg-cream/20"
            }`}
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
            onClick={() => setMobile((v: boolean) => !v)}
            className={`grid h-11 w-11 place-items-center rounded-full border md:hidden ${
              isTransparent
                ? "border-white/20 text-white hover:bg-white/10"
                : "border-cream/20 text-cream hover:bg-cream/10"
            }`}
            aria-label="القائمة"
            aria-expanded={mobile}
          >
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobile && (
        <nav
          className="border-t border-white/10 bg-ink/95 px-4 pb-4 backdrop-blur-md md:hidden"
          aria-label="قائمة الموبايل"
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobile(false)}
              className="block border-b border-white/10 py-3 font-bold text-cream/90 hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/track"
            onClick={() => setMobile(false)}
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-cream/20 bg-ink py-2.5 text-center font-bold text-cream shadow-xs"
          >
            <PackageSearch className="h-4 w-4" />
            <span>تتبع طلبك</span>
          </Link>
          <a
            href="/#menu"
            onClick={() => setMobile(false)}
            className="mt-2 block rounded-full bg-primary py-3 text-center font-extrabold text-primary-foreground"
          >
            اطلب الآن
          </a>
        </nav>
      )}
    </header>
  );
}
