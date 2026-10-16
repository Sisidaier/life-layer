import { describe, expect, it } from "vitest";
import { normalizeAppleColor } from "@/lib/bridge/calendar-catalog";

describe("normalizeAppleColor", () => {
  it("converts Apple Calendar floating point RGB values to CSS hex", () => {
    expect(normalizeAppleColor("0.443137, 0.682353, 0.458824, 1")).toBe("#71ae75");
  });

  it("preserves six digit hex and removes alpha", () => {
    expect(normalizeAppleColor("#60b4da" as string)).toBe("#60b4da");
    expect(normalizeAppleColor("#f790a6ff" as string)).toBe("#f790a6");
  });

  it("rejects malformed colors", () => {
    expect(normalizeAppleColor("not-a-color")).toBeNull();
    expect(normalizeAppleColor(null)).toBeNull();
  });
});
