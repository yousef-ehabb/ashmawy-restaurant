import { createFileRoute } from "@tanstack/react-router";
import { Facebook, MapPin, Phone, Search, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import heroFood from "@/assets/hero-food.jpg";
import mealImg from "@/assets/meal-chicken.jpg";
import crispyImg from "@/assets/crepe-crispy.jpg";
import logo from "@/assets/ashmawy-logo.png.asset.json";
import { categories, products, type CategoryId } from "@/data/menu";
import { restaurant } from "@/config/restaurant";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "عشماوي | كريبات فراخ وكريسبي في أسوان – اطلب أونلاين" },
      { name: "description", content: "منيو عشماوي كامل: كريبات الفراخ، الكريسبي، الساندوتشات والوجبات بأسعارها. اطلب بسهولة على واتساب." },
      { property: "og:title", content: "عشماوي – اسم كبير.. وطعم تقيل" },
      { property: "og:description", content: "كريبات وكريسبي ووجبات عشماوي في أسوان. اطلب أكلك دلوقتي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div id="top">
      <Hero />
      <MenuSection />
      <Offers />
      <About />
      <Contact />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 bg-stripes opacity-20" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-[1.05fr_1fr] md:py-14">
        <div>
          <p className="mb-3 inline-block rounded-full bg-primary-deep px-3 py-1 text-sm font-bold">{restaurant.slogan}</p>
          <h1 className="font-display text-5xl leading-[1.15] sm:text-6xl lg:text-7xl">
            جعان؟ <span className="text-accent">عشماوي</span><br />عنده الحل!
          </h1>
          <p className="mt-4 max-w-md text-lg leading-8 text-primary-foreground/90">
            كريبات محشية على الآخر، كريسبي مقرمش وبطاطس دهبي.. كله طازة ومعمول بمزاج.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#menu" className="rounded-full bg-accent px-7 py-3.5 font-extrabold text-accent-foreground shadow-card transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream">
              اطلب أكلك دلوقتي
            </a>
            <a href="#menu" className="rounded-full border-2 border-primary-foreground/60 px-7 py-3.5 font-extrabold transition hover:bg-primary-foreground hover:text-primary">
              شوف المنيو
            </a>
          </div>
        </div>
        <div className="relative">
          <img src={heroFood} alt="فراخ كريسبي وكريب محشي وبطاطس" width={1280} height={960} className="aspect-[4/3] w-full rounded-3xl object-cover shadow-pop ring-4 ring-primary-foreground/15" />
          <img src={logo.url} alt="عشماوي" width={140} height={140} className="absolute -bottom-6 -right-3 h-28 w-28 rounded-full border-4 border-primary-foreground object-cover shadow-pop sm:h-36 sm:w-36" />
        </div>
      </div>
    </section>
  );
}

function MenuSection() {
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "all" || p.category === cat) &&
        (!term || p.nameAr.includes(term) || p.nameEn?.toLowerCase().includes(term)),
    );
  }, [cat, q]);

  const grouped = categories
    .map((c) => ({ c, items: filtered.filter((p) => p.category === c.id) }))
    .filter((g) => g.items.length);

  return (
    <section id="menu" className="mx-auto max-w-6xl px-4 pt-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-latin text-sm font-bold text-accent">OUR MENU</p>
          <h2 className="font-display text-4xl text-primary sm:text-5xl">المنيو</h2>
        </div>
        <label className="relative w-full md:w-80">
          <span className="sr-only">ابحث في المنيو</span>
          <Search className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر على أكلتك..." className="w-full rounded-full border border-input bg-card py-3 pr-11 pl-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" />
        </label>
      </div>

      <div className="sticky top-[65px] z-30 -mx-4 mt-5 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto md:flex-wrap" role="tablist" aria-label="أقسام المنيو">
          {[{ id: "all" as const, nameAr: "الكل" }, ...categories].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${cat === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary hover:text-primary"}`}>
              {c.nameAr}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="my-12 rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-lg font-bold">مفيش نتايج لـ "{q}"</p>
          <button onClick={() => { setQ(""); setCat("all"); }} className="mt-3 font-bold text-primary underline">امسح البحث</button>
        </div>
      ) : (
        grouped.map(({ c, items }) => (
          <div key={c.id} className="mt-8">
            <div className="mb-4 flex items-baseline gap-3">
              <h3 className="font-display text-2xl sm:text-3xl">{c.nameAr}</h3>
              <span className="font-latin text-sm text-muted-foreground" dir="ltr">{c.nameEn}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function Offers() {
  const cards = [
    { title: "وجبات عشماوي", text: "٤ أو ٦ أو ٨ قطع كريسبي — تكفي الشلة كلها.", img: mealImg, cat: "meals" },
    { title: "جديد: أباتشي ورانشيز", text: "أحدث كريبات الكريسبي في المنيو.", img: crispyImg, cat: "crispy-crepes" },
  ];
  return (
    <section id="offers" className="mx-auto max-w-6xl px-4 pt-16">
      <h2 className="font-display text-4xl text-primary sm:text-5xl">عروضنا</h2>
      <p className="mt-1 text-sm text-muted-foreground">العروض الموسمية بتتعلن على صفحتنا على فيسبوك.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <a key={c.title} href="#menu" className="group relative flex min-h-56 overflow-hidden rounded-3xl bg-ink text-cream">
            <img src={c.img} alt="" loading="lazy" className="absolute inset-y-0 left-0 h-full w-1/2 object-cover opacity-90 transition group-hover:scale-105" />
            <div className="relative z-10 flex w-3/5 flex-col justify-center p-6">
              <h3 className="font-display text-3xl text-accent">{c.title}</h3>
              <p className="mt-2 text-sm leading-6 text-cream/80">{c.text}</p>
              <span className="mt-4 w-fit rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">اطلب دلوقتي</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="mx-auto max-w-6xl px-4 pt-16">
      <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-secondary p-6 md:grid-cols-[auto_1fr] md:p-10">
        <img src={logo.url} alt="شخصية عشماوي" width={240} height={240} loading="lazy" className="mx-auto h-48 w-48 rounded-3xl object-cover shadow-card md:h-60 md:w-60" />
        <div>
          <h2 className="font-display text-4xl text-primary sm:text-5xl">من نحن</h2>
          <p className="mt-4 text-lg leading-9">
            عشماوي براند أكل مصري من أسوان، بيقدم كريبات الفراخ والكريسبي والساندوتشات والوجبات بطعم جامد وكميات تشبّع.
            خلطتنا السرية في الكريسبي هي سر "الطعم التقيل" اللي بنحبه.
          </p>
          <p className="mt-3 font-display text-2xl text-primary-deep">{restaurant.slogan}</p>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 pt-16">
      <h2 className="font-display text-4xl text-primary sm:text-5xl">تواصل معنا</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {restaurant.branches.map((b) => (
          <div key={b.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <MapPin className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-extrabold">{b.label}</h3>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{b.address}</p>
          </div>
        ))}
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-pop">
          <Phone className="h-6 w-6" />
          <h3 className="mt-3 font-extrabold">للطلبات</h3>
          {restaurant.phones.map((p) => (
            <a key={p} href={`tel:${p}`} dir="ltr" className="block text-right font-latin text-2xl font-bold hover:underline">{p}</a>
          ))}
          <div className="mt-3 flex items-center gap-2 text-sm"><Clock className="h-4 w-4" />{restaurant.openingHours ?? "مواعيد العمل هتتحدد قريب"}</div>
          <a href={restaurant.facebookUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-4 py-2 text-sm font-bold text-primary"><Facebook className="h-4 w-4" />فيسبوك</a>
        </div>
      </div>
    </section>
  );
}
