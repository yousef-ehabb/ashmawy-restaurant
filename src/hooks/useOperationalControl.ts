import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  type OperationalControlSettings,
  isWithinCairoShift,
  isBranchCurrentlyOpen,
} from "@/types/operational";

export function useOperationalControl() {
  const [realtimeSettings, setRealtimeSettings] = useState<OperationalControlSettings | null>(null);

  const query = useQuery({
    queryKey: ["operationalControl"],
    queryFn: async (): Promise<OperationalControlSettings> => {
      try {
        const res = await fetch("/api/settings/operational");
        if (!res.ok) throw new Error("Failed to fetch operational settings");
        const data = await res.json();
        if (data.success && data.settings) {
          return data.settings;
        }
      } catch (err) {
        console.warn("[useOperationalControl] API fetch failed, fallback:", err);
      }
      return DEFAULT_OPERATIONAL_SETTINGS;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Real-time listener via client Firestore if available
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    try {
      const docRef = doc(db, "settings", "operational_control");
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as OperationalControlSettings;
            setRealtimeSettings(data);
          }
        },
        (err) => {
          console.debug("[useOperationalControl] Firestore snapshot error:", err.message);
        }
      );
      return () => unsub();
    } catch {
      return;
    }
  }, []);

  const settings: OperationalControlSettings = realtimeSettings || query.data || DEFAULT_OPERATIONAL_SETTINGS;

  const isShiftActive = isWithinCairoShift();

  // Helper to check any branch
  const checkBranch = (branchName: string) => {
    const branchCfg = settings.branches?.[branchName];
    return isBranchCurrentlyOpen(branchCfg, settings.isSiteOpen);
  };

  // Check if at least one branch is open
  const anyBranchOpen = Object.keys(settings.branches || {}).some(
    (bName) => checkBranch(bName).isOpen
  );

  // Overall store open check (must be site open AND at least one branch open)
  const isStoreAccessible = settings.isSiteOpen && (Object.keys(settings.branches || {}).length === 0 || anyBranchOpen);

  return {
    settings,
    isLoading: query.isLoading && !realtimeSettings,
    isError: query.isError,
    refetch: query.refetch,
    isShiftActive,
    checkBranch,
    isStoreAccessible,
  };
}
