import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { restaurant as fallbackRestaurant } from "@/config/restaurant";
import type { FirestoreGlobalSettings } from "@/types/firestore";

export interface BranchSetting {
  label: string;
  isOpen: boolean;
  deliveryFee: number;
  phone: string;
  autoCloseEnabled: boolean;
}

export interface RestaurantSettings {
  isWebsiteOpen: boolean;
  closedMessage: string;
  deliveryFee: number | null;
  minOrderAmount: number;
  branches: BranchSetting[];
  isLive: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useRestaurantSettings(): RestaurantSettings {
  const queryResult = useQuery({
    queryKey: ["restaurantSettings"],
    queryFn: async (): Promise<{ data: FirestoreGlobalSettings; isLive: boolean }> => {
      if (!isFirebaseConfigured() || !db) {
        throw new Error("Firebase is not configured");
      }

      const settingsRef = doc(db, "settings", "global");
      const snapshot = await getDoc(settingsRef);

      if (!snapshot.exists()) {
        throw new Error("settings/global document does not exist");
      }

      return {
        data: snapshot.data() as FirestoreGlobalSettings,
        isLive: true,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });

  const live = queryResult.data?.data;

  if (live) {
    const branchList = Object.entries(live.branches || {}).map(([key, b]) => ({
      label: key,
      isOpen: b.is_open,
      deliveryFee: b.delivery_fee,
      phone: b.phone,
      autoCloseEnabled: b.auto_close_enabled,
    }));

    return {
      isWebsiteOpen: live.is_website_open,
      closedMessage: live.closed_message,
      deliveryFee: live.delivery_fee ?? 15,
      minOrderAmount: live.min_order_amount ?? 50,
      branches: branchList,
      isLive: true,
      isLoading: false,
      isError: false,
      refetch: () => {
        queryResult.refetch();
      },
    };
  }

  return {
    isWebsiteOpen: true,
    closedMessage: "المطعم مغلق حالياً، نسعد باستقبال طلباتكم خلال مواعيد العمل الرسمية.",
    deliveryFee: fallbackRestaurant.deliveryFee,
    minOrderAmount: 50,
    branches: fallbackRestaurant.branches.map((b) => ({
      label: b.label,
      isOpen: true,
      deliveryFee: 15,
      phone: fallbackRestaurant.phones[0] || "",
      autoCloseEnabled: true,
    })),
    isLive: false,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    refetch: () => {
      queryResult.refetch();
    },
  };
}
