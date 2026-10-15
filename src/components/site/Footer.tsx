import { Facebook, Phone } from "lucide-react";
import logo from "@/assets/ashmawy-logo.png.asset.json";
import { restaurant } from "@/config/restaurant";
import { navLinks } from "./Header";

export function Footer() {
  return (
    <footer className="mt-16 bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="شعار عشماوي" width={56} height={56} loading="lazy" className="h-14 w-14 rounded-full" />
            <div>
              <p className="font-display text-3xl text-accent">عشماوي</p>
              <p className="text-sm text-cream/70">{restaurant.slogan}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-cream/70">كريبات فراخ، كريسبي مقرمش، ساندوتشات ووجبات من قلب أسوان.</p>
        </div>
        <div>
          <h3 className="mb-3 font-extrabold">روابط سريعة</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm text-cream/80">
            {navLinks.map((l) => (
              <li key={l.href}><a href={l.href} className="hover:text-accent">{l.label}</a></li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 text-sm text-cream/80">
          <h3 className="mb-3 font-extrabold text-cream">تواصل</h3>
          {restaurant.phones.map((p) => (
            <a key={p} href={`tel:${p}`} className="flex items-center gap-2 hover:text-accent" dir="ltr"><Phone className="h-4 w-4" />{p}</a>
          ))}
          <a href={restaurant.facebookUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-accent"><Facebook className="h-4 w-4" />صفحتنا على فيسبوك</a>
          {restaurant.branches.map((b) => (<p key={b.label}>{b.address}</p>))}
        </div>
      </div>
      <p className="border-t border-cream/10 py-5 text-center text-xs text-cream/50">© {new Date().getFullYear()} عشماوي. جميع الحقوق محفوظة.</p>
    </footer>
  );
}
