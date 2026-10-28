import crepeChicken from "@/assets/crepe-chicken.jpg";
import crepeCrispy from "@/assets/crepe-crispy.jpg";
import mealChicken from "@/assets/meal-chicken.jpg";
import friesLoaded from "@/assets/fries-loaded.jpg";
import sandwich from "@/assets/sandwich.jpg";
import pizzaCrepe from "@/assets/pizza-crepe.jpg";
import extras from "@/assets/extras.jpg";
import type { Category, Extra, Product, Size } from "@/data/menu";

export interface FirestoreCategory {
  id: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
}

export interface FirestoreProduct {
  id: string;
  category_id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  price: number;
  image_url: string;
  is_available: boolean;
  is_active: boolean;
  tags?: ("spicy" | "new")[];
  branch_availability?: Record<string, boolean>;
  customizable?: boolean;
  created_at?: string;
}

export interface FirestoreOptionGroup {
  id: string;
  product_id: string;
  key: string;
  name_ar: string;
  name_en: string;
  min_select: number;
  max_select: number;
  is_active: boolean;
  sort_order: number;
}

export interface FirestoreOption {
  id: string;
  group_id: string;
  product_id: string;
  name_ar: string;
  name_en?: string;
  price_delta: number;
  is_active: boolean;
  sort_order: number;
  branch_availability?: Record<string, boolean>;
}

export interface FirestoreBranchSetting {
  name: string;
  is_open: boolean;
  auto_close_enabled: boolean;
  delivery_fee: number;
  phone: string;
}

export interface FirestoreGlobalSettings {
  is_website_open: boolean;
  closed_message: string;
  delivery_fee: number;
  min_order_amount: number;
  branches: Record<string, FirestoreBranchSetting>;
  updated_at?: string;
}

// Map Firestore stored asset paths to bundled images
const assetMap: Record<string, string> = {
  "/assets/crepe-chicken.jpg": crepeChicken,
  "/assets/crepe-crispy.jpg": crepeCrispy,
  "/assets/meal-chicken.jpg": mealChicken,
  "/assets/fries-loaded.jpg": friesLoaded,
  "/assets/sandwich.jpg": sandwich,
  "/assets/pizza-crepe.jpg": pizzaCrepe,
  "/assets/extras.jpg": extras,
};

export function resolveProductImage(url: string | undefined): string {
  if (!url) return extras;
  return assetMap[url] || url;
}

/**
 * Transforms a FirestoreProduct along with its option groups/options into the UI Product model
 */
export function mapFirestoreProductToUI(
  raw: FirestoreProduct,
  options: FirestoreOption[] = [],
  extrasCatalog: Extra[] = []
): Product {
  // Extract sizes from options belonging to a size group, sorted by sort_order
  const sizeOptions = options
    .filter((opt) => opt.group_id.endsWith("_sizes") && opt.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const sizes: Size[] | undefined =
    sizeOptions.length > 0
      ? sizeOptions.map((opt) => ({
          id: opt.id.replace(`${raw.id}_size_`, ""),
          label: opt.name_ar,
          price: raw.price + opt.price_delta,
        }))
      : undefined;

  return {
    id: raw.id,
    category: raw.category_id as any,
    nameAr: raw.name_ar,
    nameEn: raw.name_en,
    description: raw.description_ar,
    price: raw.price,
    image: resolveProductImage(raw.image_url),
    tags: raw.tags,
    customizable: Boolean(raw.customizable),
    sizes,
  };
}

/**
 * Transforms FirestoreCategory to UI Category model
 */
export function mapFirestoreCategoryToUI(raw: FirestoreCategory): Category {
  return {
    id: raw.id as any,
    nameAr: raw.name_ar,
    nameEn: raw.name_en,
  };
}
