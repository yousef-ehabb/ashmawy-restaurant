import { describe, it, expect } from "vitest";
import { isItemAvailable, type ItemAvailability } from "../hooks/useMenuAvailability";

describe("Menu and Branch Availability Logic", () => {
  it("defaults to available if no availability record exists", () => {
    expect(isItemAvailable(undefined, "فرع المطار")).toBe(true);
    expect(isItemAvailable(undefined, "فرع المحطة")).toBe(true);
    expect(isItemAvailable(undefined)).toBe(true);
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
  });

  it("marks item unavailable only for the specific disabled branch", () => {
    const avail: ItemAvailability = {
      isAvailableGlobal: true,
      branchAvailability: {
        "فرع المطار": true,
        "فرع المحطة": false,
      },
    };
    expect(isItemAvailable(avail, "فرع المطار")).toBe(true);
    expect(isItemAvailable(avail, "فرع المحطة")).toBe(false);
  });

  it("treats item as available in branch if not explicitly set to false", () => {
    const avail: ItemAvailability = {
      isAvailableGlobal: true,
      branchAvailability: {
        "فرع المطار": true,
      },
    };
    expect(isItemAvailable(avail, "فرع المحطة")).toBe(true);
  });
});

