export interface OperationalBranchConfig {
  isOpen: boolean;
  autoCloseAfterHours: boolean;
  closedMessage: string;
}

export interface OperationalControlSettings {
  isSiteOpen: boolean;
  globalClosedMessage: string;
  workingHours: {
    start: string; // e.g. "12:00"
    end: string;   // e.g. "02:00"
    label: string; // e.g. "من 12:00 ظهراً حتى 2:00 صباحاً"
  };
  branches: Record<string, OperationalBranchConfig>;
  updatedAt?: string | undefined;
  updatedBy?: string | undefined;
}

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalControlSettings = {
  isSiteOpen: true,
  globalClosedMessage: "المطعم مغلق حالياً، نسعد باستقبال طلباتكم في أوقات العمل القادمة ❤️",
  workingHours: {
    start: "12:00",
    end: "02:00",
    label: "من 12:00 ظهراً حتى 2:00 صباحاً",
  },
  branches: {
    "فرع المطار": {
      isOpen: true,
      autoCloseAfterHours: true,
      closedMessage: "فرع المطار مغلق حالياً، نسعد باستقبال طلباتكم في أوقات العمل القادمة.",
    },
    "فرع المحطة": {
      isOpen: true,
      autoCloseAfterHours: true,
      closedMessage: "فرع المحطة مغلق حالياً، نسعد باستقبال طلباتكم في أوقات العمل القادمة.",
    },
  },
};

/**
 * Checks whether the current time in Cairo (Africa/Cairo) is within the official shift.
 * Shift: 12:00 PM (noon) to 02:00 AM (next morning)
 * That means:
 * - Hour >= 12 (12:00 PM to 11:59 PM) -> Inside shift
 * - Hour < 2 (12:00 AM to 01:59 AM) -> Inside shift
 * - 02:00 AM to 11:59 AM -> Outside shift
 */
export function isWithinCairoShift(now: Date = new Date()): boolean {
  try {
    // Get time in Cairo
    const cairoTimeStr = now.toLocaleTimeString("en-US", {
      timeZone: "Africa/Cairo",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const [hStr, mStr] = cairoTimeStr.split(":");
    const hour = parseInt(hStr || "0", 10);
    const minute = parseInt(mStr || "0", 10);

    // 12:00 PM (12:00) to 2:00 AM (02:00)
    // Between 12:00 and 23:59 -> inside
    if (hour >= 12) return true;
    // Between 00:00 and 01:59 -> inside
    if (hour < 2) return true;
    // Exactly 02:00:00 or later until 11:59 -> outside
    return false;
  } catch (err) {
    // Fallback if Intl timeZone fails
    const utcHours = now.getUTCHours();
    const cairoHours = (utcHours + 2) % 24;
    return cairoHours >= 12 || cairoHours < 2;
  }
}

/**
 * Checks if a branch is currently open considering both its manual switch
 * and the autoCloseAfterHours rule (auto-close past 2:00 AM until manual open/shift).
 */
export function isBranchCurrentlyOpen(
  branchConfig?: OperationalBranchConfig,
  isSiteOpen: boolean = true
): { isOpen: boolean; reason?: string } {
  if (!isSiteOpen) {
    return { isOpen: false, reason: "المطعم مغلق كلياً حالياً" };
  }

  if (!branchConfig) {
    return { isOpen: true };
  }

  // If manual toggle is explicitly false, it is closed
  if (!branchConfig.isOpen) {
    return {
      isOpen: false,
      reason: branchConfig.closedMessage || "الفرع مغلق حالياً بقرار إداري",
    };
  }

  // If auto-close after hours is enabled and we are outside shift hours (between 2:00 AM and 12:00 PM)
  if (branchConfig.autoCloseAfterHours && !isWithinCairoShift()) {
    return {
      isOpen: false,
      reason: branchConfig.closedMessage || "الفرع مغلق تلقائياً بعد مواعيد العمل الرسمية (2:00 ص)",
    };
  }

  return { isOpen: true };
}
