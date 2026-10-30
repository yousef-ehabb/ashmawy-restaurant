import { describe, it, expect } from "vitest";
import {
  isItemAvailable,
  isItemCompletelyUnavailable,
  getUnavailableBranches,
  type ItemAvailability,
} from "../hooks/useMenuAvailability";

describe("Menu and Branch Availability Logic", () => {
  it("defaults to available if no availability record exists", () => {
    expect(isItemAvailable(undefined, "فرع المطار")).toBe(true);
    expect(isItemAvailable(undefined, "فرع المحطة")).toBe(true);
    expect(isItemAvailable(undefined)).toBe(true);
    expect(isItemCompletelyUnavailable(undefined)).toBe(false);
    expect(getUnavailableBranches(undefined)).toEqual([]);
  });

  it("marks item unavailable everywhere if globally unavailable", () => {
    const avail: ItemAvailability = {
      isAvailableGlobal: false,
      branchAvailability: {
        "فرع المطار": true,
        "فرع المحطة": true,
      },
    };
    expect(isItemAvailable(avail, "فرع المطار")).toBe(false);
    expect(isItemAvailable(avail, "فرع المحطة")).toBe(false);
    expect(isItemAvailable(avail)).toBe(false);
    expect(isItemCompletelyUnavailable(avail)).toBe(true);
    expect(getUnavailableBranches(avail)).toEqual(["فرع المطار", "فرع المحطة"]);
  });

  it("marks item completely unavailable if both branches are disabled even when global is true", () => {
    const avail: ItemAvailability = {
      isAvailableGlobal: true,
      branchAvailability: {
        "فرع المطار": false,
        "فرع المحطة": false,
      },
    };
    expect(isItemCompletelyUnavailable(avail)).toBe(true);
    expect(getUnavailableBranches(avail)).toEqual(["فرع المطار", "فرع المحطة"]);
  });

  it("does NOT mark item completely unavailable if only one branch is disabled", () => {
    const avail: ItemAvailability = {
      isAvailableGlobal: true,
      branchAvailability: {
        "فرع المطار": true,
        "فرع المحطة": false,
      },
    };
    // Should NOT be completely unavailable (card remains active and orderable on general menu)
    expect(isItemCompletelyUnavailable(avail)).toBe(false);
    expect(isItemAvailable(avail, "فرع المطار")).toBe(true);
    expect(isItemAvailable(avail, "فرع المحطة")).toBe(false);
    // Warning badge targets only the disabled branch
    expect(getUnavailableBranches(avail)).toEqual(["فرع المحطة"]);
  });

  it("treats item as available in branch if not explicitly set to false", () => {
    const avail: ItemAvailability = {
      isAvailableGlobal: true,
      branchAvailability: {
        "فرع المطار": true,
      },
    };
    expect(isItemAvailable(avail, "فرع المحطة")).toBe(true);
    expect(isItemCompletelyUnavailable(avail)).toBe(false);
    expect(getUnavailableBranches(avail)).toEqual([]);
  });
});
