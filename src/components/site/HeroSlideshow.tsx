import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ─────────────────────────────────────────────────
   Slide data – uses real photographs from public/
   ───────────────────────────────────────────────── */
interface Slide {
  src: string;
  alt: string;
  /** CSS object-position — lets us control the crop per-image */
  position: string;
  /** Mobile-specific position override */
  positionMobile?: string;
}

const slides: Slide[] = [
  {
    src: "/photos/854036120_2350398249140384_8843555461194157336_n.png",
    alt: "مطعم عشماوي – الواجهة والمحل مع الطاقم وتقديم الكريب",
    position: "center 35%",
    positionMobile: "center 28%",
  },
  {
    src: "/photos/585361667_829790453097341_8075258318394980081_n.jpg",
    alt: "طاقم عشماوي يقدم الكريبات والوجبات أمام لافتة المحل",
    position: "center 38%",
    positionMobile: "center 32%",
  },
  {
    src: "/photos/574069459_813277818081938_4889079263942054807_n.jpg",
    alt: "كريب عشماوي الغني بالجبن واللحوم بخلطة المحل الخاصة",
    position: "center 48%",
    positionMobile: "center 45%",
  },
  {
    src: "/photos/661419984_935053249237727_5817771095247750965_n.jpg",
    alt: "كريب عشماوي المحشي مع لافتة المحل في الخلفية",
    position: "center 42%",
    positionMobile: "center 38%",
  },
];

const INTERVAL_MS = 5500;
const TRANSITION_MS = 800;

export function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* Auto-advance timer */
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reducedMotion || slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % slides.length);
    }, INTERVAL_MS);
  }, [reducedMotion]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  /* Prevent overlapping transitions */
  useEffect(() => {
    setIsTransitioning(true);
    const t = setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [current]);

  const go = useCallback(
    (idx: number) => {
      if (isTransitioning) return;
      setCurrent(idx);
      startTimer(); // reset auto-advance
    },
    [isTransitioning, startTimer],
  );

  const prev = () => go((current - 1 + slides.length) % slides.length);
  const next = () => go((current + 1) % slides.length);

  if (slides.length === 0) return null;

  return (
    <>
      {/* Image layers */}
      {slides.map((slide, i) => (
        <div
          key={slide.src}
          className="hero-slide"
          style={{
            opacity: i === current ? 1 : 0,
            zIndex: i === current ? 1 : 0,
          }}
          aria-hidden={i !== current}
        >
          <img
            src={slide.src}
            alt={slide.alt}
            width={1920}
            height={1080}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            draggable={false}
            className="hero-slide-img"
            style={
              {
                "--pos-desktop": slide.position,
                "--pos-mobile": slide.positionMobile || slide.position,
              } as React.CSSProperties
            }
          />
        </div>
      ))}

      {/* Controls — only when >1 slide */}
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {/* Arrows */}
          <button
            onClick={prev}
            className="hero-arrow hero-arrow-right pointer-events-auto"
            aria-label="الصورة السابقة"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="hero-arrow hero-arrow-left pointer-events-auto"
            aria-label="الصورة التالية"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Bottom indicators */}
          <div className="pointer-events-auto absolute bottom-8 sm:bottom-12 md:bottom-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3">
            {/* Dots */}
            <div className="flex gap-1.5" role="tablist" aria-label="صور الهيرو">
              {slides.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === current}
                  aria-label={`صورة ${i + 1} من ${slides.length}`}
                  onClick={() => go(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-6 bg-white"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
            {/* Counter */}
            <span className="hidden text-xs font-medium text-white/60 sm:block" dir="ltr">
              {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

