import { describe, it, expect } from "vitest";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  isWithinCairoShift,
  isBranchCurrentlyOpen,
  type OperationalControlSettings,
} from "../types/operational";

describe("Operational Control Unit Tests", () => {
  it("has correct default operational settings structure", () => {
    expect(DEFAULT_OPERATIONAL_SETTINGS.isSiteOpen).toBe(true);
    expect(DEFAULT_OPERATIONAL_SETTINGS.workingHours.start).toBe("12:00");
    expect(DEFAULT_OPERATIONAL_SETTINGS.workingHours.end).toBe("02:00");
    expect(DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المطار"]).toBeDefined();
    expect(DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المحطة"]).toBeDefined();
    expect(DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المطار"].isOpen).toBe(true);
    expect(DEFAULT_OPERATIONAL_SETTINGS.branches["فرع المطار"].autoCloseAfterHours).toBe(true);
  });

  it("evaluates shift status correctly for given dates in Cairo", () => {
    // 2:30 PM Cairo time (active shift)
    const afternoonCairo = new Date("2026-10-29T12:30:00Z"); // Cairo is UTC+2 -> 14:30
    expect(isWithinCairoShift(afternoonCairo)).toBe(true);

    // 1:00 AM Cairo time (active shift - before 2 AM)
    const nightCairo = new Date("2026-10-29T23:00:00Z"); // Cairo is UTC+2 -> 01:00 next day
    expect(isWithinCairoShift(nightCairo)).toBe(true);

    // 5:00 AM Cairo time (outside shift - after 2 AM and before 12 PM)
    const earlyMorningCairo = new Date("2026-10-29T02:00:00Z"); // Cairo is UTC+3 in summer -> 05:00
    expect(isWithinCairoShift(earlyMorningCairo)).toBe(false);

    // 9:30 AM Cairo time (outside shift - before 12:00 PM)
    const morningCairo = new Date("2026-10-29T06:30:00Z"); // Cairo is UTC+3 in summer -> 09:30
    expect(isWithinCairoShift(morningCairo)).toBe(false);
  });

  it("checks branch open status based on master switch and branch toggles", () => {
    const branchConfig = {
      isOpen: true,
      autoCloseAfterHours: false,
      closedMessage: "مغلق للتجديد",
    };

    // If master site is closed -> branch is closed
    expect(isBranchCurrentlyOpen(branchConfig, false).isOpen).toBe(false);

    // If master site is open & branch manual toggle is true (autoClose is false) -> branch is open
    expect(isBranchCurrentlyOpen(branchConfig, true).isOpen).toBe(true);

    // If branch manual toggle is false -> branch is closed with custom message
    const manuallyClosedBranch = { ...branchConfig, isOpen: false };
    const status = isBranchCurrentlyOpen(manuallyClosedBranch, true);
    expect(status.isOpen).toBe(false);
    expect(status.reason).toBe("مغلق للتجديد");
  });
});
