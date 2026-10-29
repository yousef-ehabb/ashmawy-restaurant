import { Clock, Phone, MapPin, Store, AlertCircle } from "lucide-react";
import logo from "@/assets/ashmawy-logo.png.asset.json";
import { restaurant } from "@/config/restaurant";

interface StoreClosedScreenProps {
  customMessage?: string;
  isAllBranchesClosed?: boolean;
}

export function StoreClosedScreen({
  customMessage = "المطعم مغلق حالياً، نسعد باستقبال طلباتكم في أوقات العمل القادمة ❤️",
  isAllBranchesClosed = false,
}: StoreClosedScreenProps) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-16 text-center animate-in fade-in duration-300">
      <div className="max-w-xl w-full bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-card relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-destructive/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Ashmawy Logo */}
        <div className="relative mx-auto mb-6 flex justify-center">
          <div className="relative">
            <img
              src={logo.url}
              alt={restaurant.nameAr}
              width={110}
              height={110}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-background shadow-pop object-cover"
            />
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm ring-2 ring-background">
              <Store className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground">
          {restaurant.nameAr}
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-bold text-muted-foreground">
          {restaurant.slogan}
        </p>

        {/* Status Badge */}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span>{isAllBranchesClosed ? "كافة الفروع مغلقة حالياً" : "المطعم مغلق حالياً"}</span>
        </div>

        {/* Custom Closed Message */}
        <div className="mt-5 rounded-2xl bg-secondary/60 border border-border/60 p-4 sm:p-5">
          <p className="text-sm sm:text-base font-semibold leading-relaxed text-foreground">
            {customMessage}
          </p>
        </div>

        {/* Working Hours Box */}
        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-right sm:text-center">
          <div className="flex items-center justify-center gap-2 text-primary font-bold text-sm sm:text-base">
            <Clock className="h-4 w-4 shrink-0" />
            <span>مواعيد العمل الرسمية:</span>
          </div>
          <p className="mt-1 font-display text-base sm:text-lg font-extrabold text-primary">
            يومياً من 12:00 ظهراً حتى 2:00 صباحاً
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            (ورديات العمل الرسمية لكافة الفروع في أسوان)
          </p>
        </div>

        {/* Branches & Phone info */}
        <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
          {restaurant.branches.map((b) => (
            <div key={b.label} className="rounded-xl border border-border/60 bg-card p-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{b.label}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                {b.address}
              </p>
            </div>
          ))}
        </div>

        {/* Phone Contact */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
          <span>للاستفسارات الهاتفية:</span>
          {restaurant.phones.map((phone) => (
            <a
              key={phone}
              href={`tel:${phone}`}
              dir="ltr"
              className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
            >
              <Phone className="h-3 w-3" />
              <span>{phone}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
