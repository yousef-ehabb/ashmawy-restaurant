import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { products as fallbackProducts, extrasList, type Product } from "@/data/menu";
import {
  mapFirestoreProductToUI,
  type FirestoreProduct,
  type FirestoreOption,
} from "@/types/firestore";

export interface UseProductsResult {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isLive: boolean;
  refetch: () => void;
}

export function useProducts(): UseProductsResult {
  const queryResult = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<{ data: Product[]; isLive: boolean }> => {
      if (!isFirebaseConfigured() || !db) {
        return { data: fallbackProducts, isLive: false };
      }

      try {
        const productsRef = collection(db, "products");
        const optionsRef = collection(db, "options");

        // Fetch products and active options in parallel
        const [productsSnapshot, optionsSnapshot] = await Promise.all([
          getDocs(query(productsRef, where("is_active", "==", true))),
          getDocs(optionsRef).catch(() => null),
        ]);

        if (productsSnapshot.empty) {
          const fallbackSnapshot = await getDocs(productsRef);
          if (fallbackSnapshot.empty) {
            return { data: fallbackProducts, isLive: false };
          }
        }

        const rawProducts = productsSnapshot.docs.map(
          (d) => d.data() as FirestoreProduct
        );

        // Group options by product_id
        const optionsByProductId: Record<string, FirestoreOption[]> = {};
        if (optionsSnapshot && !optionsSnapshot.empty) {
          optionsSnapshot.docs.forEach((d) => {
            const opt = d.data() as FirestoreOption;
            if (opt.product_id) {
              const list = optionsByProductId[opt.product_id] ?? [];
              list.push(opt);
              optionsByProductId[opt.product_id] = list;
            }
          });
        }

        // Map Firestore documents to UI-compatible Product model
        const mappedProducts = rawProducts.map((raw) => {
          const productOptions = optionsByProductId[raw.id] || [];
          return mapFirestoreProductToUI(raw, productOptions, extrasList);
        });

        return { data: mappedProducts, isLive: true };
      } catch (err) {
        console.warn("[useProducts] Failed to fetch live products from Firestore:", err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });

  return {
    products: queryResult.data?.data ?? (queryResult.isError ? [] : fallbackProducts),
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error as Error | null,
    isLive: queryResult.data?.isLive ?? false,
    refetch: () => {
      queryResult.refetch();
    },
  };
}
