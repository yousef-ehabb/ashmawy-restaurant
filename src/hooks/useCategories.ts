import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { categories as fallbackCategories, type Category } from "@/data/menu";
import { mapFirestoreCategoryToUI, type FirestoreCategory } from "@/types/firestore";

export interface UseCategoriesResult {
  categories: Category[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isLive: boolean;
  refetch: () => void;
}

export function useCategories(): UseCategoriesResult {
  const queryResult = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<{ data: Category[]; isLive: boolean }> => {
      if (!isFirebaseConfigured() || !db) {
        return { data: fallbackCategories, isLive: false };
      }

      try {
        const categoriesRef = collection(db, "categories");
        // Query active categories (sort in memory to avoid composite index requirement)
        const q = query(categoriesRef, where("is_active", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          const fallbackSnapshot = await getDocs(categoriesRef);
          if (fallbackSnapshot.empty) {
            return { data: fallbackCategories, isLive: false };
          }
          const loaded = fallbackSnapshot.docs
            .map((d) => d.data() as FirestoreCategory)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map(mapFirestoreCategoryToUI);
          return { data: loaded, isLive: true };
        }

        const loaded = snapshot.docs
          .map((d) => d.data() as FirestoreCategory)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(mapFirestoreCategoryToUI);

        return { data: loaded, isLive: true };
      } catch (err) {
        console.warn("[useCategories] Failed to fetch live categories from Firestore:", err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });

  return {
    categories: queryResult.data?.data ?? (queryResult.isError ? [] : fallbackCategories),
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error as Error | null,
    isLive: queryResult.data?.isLive ?? false,
    refetch: () => {
      queryResult.refetch();
    },
  };
}
