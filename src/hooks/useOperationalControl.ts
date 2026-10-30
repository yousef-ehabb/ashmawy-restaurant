import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  type OperationalControlSettings,
  isWithinCairoShift,
  isBranchCurrentlyOpen,
} from "@/types/operational";
import { subscribeLiveSync } from "@/lib/liveSync";

export function useOperationalControl() {
  const queryClient = useQueryClient();
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
    staleTime: 0, // Real-time priority
    refetchInterval: 3000, // 3-second background polling fallback
    refetchOnWindowFocus: true, // Instant sync when user switches tabs
  });

  // 1. Real-time listener via client Firestore if available (<50ms)
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
            queryClient.setQueryData(["operationalControl"], data);
          }
        },
        (err) => {
          console.debug("[useOperationalControl] Firestore snapshot fallback to polling:", err.message);
        }
      );
      return () => unsub();
    } catch {
      return;
    }
  }, [queryClient]);

  // 2. Cross-Tab Live Sync via BroadcastChannel & storage events (0ms latency across tabs)
  useEffect(() => {
    const unsub = subscribeLiveSync((msg) => {
      if (msg.type === "operational_settings_updated") {
        if (msg.payload) {
          setRealtimeSettings(msg.payload);
          queryClient.setQueryData(["operationalControl"], msg.payload);
        } else {
          queryClient.invalidateQueries({ queryKey: ["operationalControl"] });
        }
      }
    });
    return () => unsub();
  }, [queryClient]);

  const settings: OperationalControlSettings =
    realtimeSettings || query.data || DEFAULT_OPERATIONAL_SETTINGS;

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
  const isStoreAccessible =
    settings.isSiteOpen &&
    (Object.keys(settings.branches || {}).length === 0 || anyBranchOpen);

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
