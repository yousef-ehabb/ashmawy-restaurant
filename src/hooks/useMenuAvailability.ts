import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useEffect } from "react";

export interface ItemAvailability {
  isAvailableGlobal: boolean;
  branchAvailability: Record<string, boolean>;
}

export interface MenuAvailabilityData {
  items: Record<string, ItemAvailability>;
  extras: Record<string, ItemAvailability>;
  updatedAt?: string;
}

const DEFAULT_AVAILABILITY: MenuAvailabilityData = {
  items: {},
  extras: {},
};

/**
 * Check if a specific item/extra is available for a given branch.
 * Logic: if globally unavailable → unavailable.
 *        if branch-specific entry exists and is false → unavailable.
 *        otherwise → available.
 */
export function isItemAvailable(
  avail: ItemAvailability | undefined,
  branch?: string
): boolean {
  if (!avail) return true; // no availability record = available by default
  if (!avail.isAvailableGlobal) return false;
  if (branch && avail.branchAvailability[branch] === false) return false;
  return true;
}

/**
 * Hook to fetch and subscribe to menu availability data.
 * Used by both admin panel and customer storefront.
 */
export function useMenuAvailability(): {
  availability: MenuAvailabilityData;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ["menuAvailability"],
    queryFn: async (): Promise<MenuAvailabilityData> => {
      try {
        const res = await fetch("/api/menu/availability");
        if (!res.ok) throw new Error("Failed to fetch menu availability");
        const data = await res.json();
        if (data.success) {
          return {
            items: data.items || {},
            extras: data.extras || {},
            updatedAt: data.updatedAt,
          };
        }
      } catch (err) {
        console.warn("[useMenuAvailability] API fetch failed:", err);
      }
      return DEFAULT_AVAILABILITY;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Real-time Firestore listener for instant updates
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;

    try {
      const docRef = doc(db, "menu_availability", "current");
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Record<string, any>;
            const parsed: MenuAvailabilityData = {
              items: data["items"] || {},
              extras: data["extras"] || {},
              updatedAt: data["updated_at"],
            };
            queryClient.setQueryData(["menuAvailability"], parsed);
          }
        },
        (err) => {
          console.debug("[useMenuAvailability] Firestore listener error:", err.message);
        }
      );
      return () => unsub();
    } catch {
      return;
    }
  }, [queryClient]);

  return {
    availability: queryResult.data ?? DEFAULT_AVAILABILITY,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    refetch: () => {
      queryResult.refetch();
    },
  };
}

