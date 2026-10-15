import crepeChicken from "@/assets/crepe-chicken.jpg";
import crepeCrispy from "@/assets/crepe-crispy.jpg";
import mealChicken from "@/assets/meal-chicken.jpg";
import friesLoaded from "@/assets/fries-loaded.jpg";
import sandwich from "@/assets/sandwich.jpg";
import pizzaCrepe from "@/assets/pizza-crepe.jpg";
import extras from "@/assets/extras.jpg";

export type CategoryId =
  | "chicken-crepes"
  | "crispy-crepes"
  | "cheese-crepes"
  | "meals"
  | "sandwiches"
  | "pizza-crepes"
  | "sides"
  | "additions"
  | "drinks";

export interface Category {
  id: CategoryId;
  nameAr: string;
  nameEn: string;
}

export interface Size {
  id: string;
  label: string;
  price: number;
}

export interface Product {
  id: string;
  category: CategoryId;
  nameAr: string;
  nameEn?: string;
  description?: string;
  price: number;
  sizes?: Size[];
  image: string;
  tags?: ("spicy" | "new")[];
  customizable?: boolean;
}

export interface Extra {
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
}

export const categories: Category[] = [
  { id: "chicken-crepes", nameAr: "كريبات الفراخ", nameEn: "Chicken Crepes" },
  { id: "crispy-crepes", nameAr: "كريبات الفرايد تشكن", nameEn: "Crispy Crepes" },
  { id: "cheese-crepes", nameAr: "كريبات جبنة خفيفة", nameEn: "Light Cheese" },
  { id: "meals", nameAr: "وجبات عشماوي", nameEn: "Meals" },
  { id: "sandwiches", nameAr: "ساندوتشات", nameEn: "Sandwiches" },
  { id: "pizza-crepes", nameAr: "بيتزا كريب", nameEn: "Pizza Crepe" },
  { id: "sides", nameAr: "المقبلات", nameEn: "Sides" },
  { id: "additions", nameAr: "الإضافات", nameEn: "Additions" },
  { id: "drinks", nameAr: "المشروبات", nameEn: "Drinks" },
];

export const extrasList: Extra[] = [
  { id: "x-kono", nameAr: "كونو", nameEn: "Kono", price: 20 },
  { id: "x-bigtasty", nameAr: "صوص بيج تستي", nameEn: "Big Tasty", price: 20 },
  { id: "x-potatoes", nameAr: "بطاطس", nameEn: "Potatoes", price: 15 },
  { id: "x-ranch", nameAr: "صوص رانش", nameEn: "Ranch sauce", price: 20 },
  { id: "x-cheddar", nameAr: "صوص شيدر", nameEn: "Cheddar sauce", price: 20 },
  { id: "x-smoked", nameAr: "بيف مدخن", nameEn: "Smoked beef", price: 15 },
  { id: "x-burger", nameAr: "برجر بيف", nameEn: "Beef burger", price: 50 },
  { id: "x-hotdog", nameAr: "هوت دوج", nameEn: "Hot dog", price: 20 },
  { id: "x-kiri", nameAr: "جبنة كيري", nameEn: "Kiri cheese", price: 15 },
  { id: "x-roman", nameAr: "جبنة رومي", nameEn: "Roman cheese", price: 15 },
];

const crepe = (
  id: string,
  category: CategoryId,
  nameAr: string,
  nameEn: string,
  price: number,
  description: string,
  image: string,
  tags?: Product["tags"],
): Product => ({ id, category, nameAr, nameEn, price, description, image, tags, customizable: true });

const sizes = (s: number, d: number, t: number): Size[] => [
  { id: "S", label: "سينجل (S)", price: s },
  { id: "D", label: "دبل (D)", price: d },
  { id: "T", label: "تريبل (T)", price: t },
];

export const products: Product[] = [
  // كريبات الفراخ
  crepe("c1", "chicken-crepes", "كريب عشماوي", "Crepe Ashmawy", 145, "موتزريلا، كريسبي فريش، صدور فراخ، بطاطس، كونو موتزريلا، خضار، كاتشب، مايونيز", crepeChicken),
  crepe("c2", "chicken-crepes", "كريب ولعها حار", "Crepe Wala3ha", 155, "موتزريلا، زنجر حار، شاورما فراخ، خضار، كابوتشي، كاتشب، مايونيز", crepeChicken, ["spicy"]),
  crepe("c3", "chicken-crepes", "ميكس فراخ", "Mix Chicken", 130, "موتزريلا، كريسبي فريش، شاورما فراخ، خضار، كابوتشي، كاتشب، مايونيز", crepeChicken),
  crepe("c4", "chicken-crepes", "ميكس فاهيتا", "Fahita Mix", 130, "موتزريلا، فاهيتا فراخ، هوت دوج، باربيكيو، خضار، كابوتشي، كاتشب، مايونيز", crepeChicken),
  crepe("c5", "chicken-crepes", "ميكس جبن وفراخ", "Mix Cheese and Chicken", 145, "موتزريلا، قطع كريسبي فريش، صوص شيدر، خضار، كابوتشي، كاتشب، مايونيز", crepeChicken),
  crepe("c6", "chicken-crepes", "شاورما فراخ جريل", "Chicken Shawarma", 135, "موتزريلا، شاورما فراخ، خضار، كاتشب، مايونيز", crepeChicken),
  crepe("c7", "chicken-crepes", "فاهيتا فراخ", "Chicken Fahita", 135, "موتزريلا، فاهيتا فراخ، خضار، كابوتشي، كاتشب، مايونيز", crepeChicken),
  crepe("c8", "chicken-crepes", "ميكس لحوم", "Meat Mix", 155, "موتزريلا، هوت دوج، سجق، برجر بيف، خضار، كابوتشي، كاتشب، مايونيز", crepeChicken),
  // كريبات الفرايد تشكن
  crepe("k1", "crispy-crepes", "كريسبي فريش", "Crispy Fresh", 135, "موتزريلا، قطع كريسبي فريش، خضار، كابوتشي، كاتشب، مايونيز", crepeCrispy),
  crepe("k2", "crispy-crepes", "زنجر حار فريش", "Hot Zinger Fresh", 145, "موتزريلا، قطع زنجر حار، خضار، كاتشب، كابوتشي، مايونيز", crepeCrispy, ["spicy"]),
  crepe("k3", "crispy-crepes", "ميكس كريسبي على زنجر فريش", "Fresh Crispy & Zinger Fresh", 140, "موتزريلا، زنجر حار، كريسبي فريش، خضار، كابوتشي، كاتشب، مايونيز", crepeCrispy),
  crepe("k4", "crispy-crepes", "كريسبي بيج تيستي", "Big Tasty Crispy", 140, "موتزريلا، قطع كريسبي فريش، صوص البيج تيستي، خضار، كابوتشي، كاتشب، مايونيز", crepeCrispy),
  crepe("k5", "crispy-crepes", "كريسبي كونو", "Cone Crispy", 140, "موتزريلا، قطع كريسبي فريش، كونو موتزريلا، خضار، كابوتشي، كاتشب، مايونيز", crepeCrispy),
  crepe("k6", "crispy-crepes", "سوبر كرانشي صوص شيدر", "Super Crunchy Cheddar", 150, "موتزريلا، قطع كريسبي فريش، خضار، صوص شيدر، كابوتشي، كاتشب، مايونيز", crepeCrispy),
  crepe("k7", "crispy-crepes", "أباتشي", "Apache Crepe", 185, "موتزريلا، قطع كريسبي فريش، صدور فراخ، برجر بيف، خضار، كابوتشي، صوص شيدر، صوص أمريكان تكساس", crepeCrispy, ["new"]),
  crepe("k8", "crispy-crepes", "رانشيز", "Ranches", 160, "موتزريلا، قطع كريسبي فريش، سلامي، كابوتشي، صوص رانش، كاتشب، مايونيز", crepeCrispy, ["new"]),
  // كريبات جبنة خفيفة
  crepe("l1", "cheese-crepes", "ميكس جبن", "Mix Cheese", 120, "موتزريلا، رومي، كيري، صوص شيدر، زيتون، كاتشب، مايونيز", friesLoaded),
  crepe("l2", "cheese-crepes", "بطاطس موتزريلا", "Mozzarella Fries", 90, "موتزريلا، بطاطس، خضار، كابوتشي، كاتشب، مايونيز", friesLoaded),
  crepe("l3", "cheese-crepes", "جبن بطاطس", "Fries Cheese", 105, "موتزريلا، صوص شيدر، بطاطس، خضار، كابوتشي، كاتشب، مايونيز", friesLoaded),
  // وجبات
  { id: "m4", category: "meals", nameAr: "وجبة 4 قطع", nameEn: "Meal 4 Pieces", price: 150, image: mealChicken },
  { id: "m6", category: "meals", nameAr: "وجبة 6 قطع", nameEn: "Meal 6 Pieces", price: 230, image: mealChicken },
  { id: "m8", category: "meals", nameAr: "وجبة 8 قطع", nameEn: "Meal 8 Pieces", price: 300, image: mealChicken },
  // ساندوتشات
  { id: "s1", category: "sandwiches", nameAr: "ساندوتش هامر", nameEn: "Hammer Sandwich", price: 145, sizes: sizes(145, 200, 330), description: "قطع الدجاج المقرمش بخلطة عشماوي السرية، جبن شيدر، شرائح بيف مدخن، كابوتشي", image: sandwich, customizable: true },
  { id: "s2", category: "sandwiches", nameAr: "ساندوتش بيف برجر", nameEn: "Beef Burger Sandwich", price: 150, sizes: sizes(150, 200, 370), description: "بيف برجر، شرائح بيف مدخن، كابوتشي، صوص تكساس برجر، صوص شيدر", image: sandwich, customizable: true },
  { id: "s3", category: "sandwiches", nameAr: "ساندوتش أربي جي", nameEn: "RBG Sandwich", price: 220, sizes: [{ id: "D", label: "دبل (D)", price: 220 }], description: "قطع الدجاج المقرمش بخلطة عشماوي السرية، بيف برجر، شرائح بيف مدخن، كابوتشي، صوص شيدر، صوص تكساس برجر", image: sandwich, customizable: true },
  // بيتزا كريب
  { id: "p1", category: "pizza-crepes", nameAr: "بيتزا كريب ميكس فراخ", nameEn: "Pizza Crepe Mix Chicken", price: 370, image: pizzaCrepe, customizable: true },
  { id: "p2", category: "pizza-crepes", nameAr: "بيتزا كريب كريسبي", nameEn: "Crispy Crepe Pizza", price: 360, image: pizzaCrepe, customizable: true },
  // المقبلات
  { id: "a1", category: "sides", nameAr: "باكت بطاطس", nameEn: "Fries Box", price: 25, image: friesLoaded },
  { id: "a2", category: "sides", nameAr: "باكت كريسبي صوص شيدر", nameEn: "Crispy Box · Cheddar", price: 100, image: friesLoaded },
  { id: "a3", category: "sides", nameAr: "باكت كريسبي صوص بيج تستي", nameEn: "Crispy Box · Big Tasty", price: 100, image: friesLoaded },
  { id: "a4", category: "sides", nameAr: "باكت كريسبي صوص رانش", nameEn: "Crispy Box · Ranch", price: 100, image: friesLoaded },
  // الإضافات
  ...extrasList.map((e) => ({ id: e.id, category: "additions" as const, nameAr: e.nameAr, nameEn: e.nameEn, price: e.price, image: extras })),
  // المشروبات
  { id: "d1", category: "drinks", nameAr: "كولا", nameEn: "Cola", price: 25, image: extras },
  { id: "d2", category: "drinks", nameAr: "مياه", nameEn: "Water", price: 10, image: extras },
];

export const formatEGP = (n: number) => `${n.toLocaleString("ar-EG")} ج.م`;
