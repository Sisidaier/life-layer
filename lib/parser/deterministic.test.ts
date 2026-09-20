import { describe, expect, it } from "vitest";
import { parseGoldenPath } from "./deterministic";
import { normalizeTimezone } from "../time";

describe("Golden Path parser", () => {
  it("creates a 60-minute calendar event at 19:00 tomorrow", () => {
    const action = parseGoldenPath("明天下班后 7 点去游泳。", "Asia/Shanghai", new Date("2026-09-17T04:00:00.000Z"));
    expect(action).toMatchObject({
      operation: "create",
      kind: "calendar",
      title: "游泳",
      startAt: "2026-09-18T11:00:00.000Z",
      endAt: "2026-09-18T12:00:00.000Z",
      needsConfirmation: true,
    });
  });

  it("falls back to Asia/Shanghai when deployment timezone is invalid", () => {
    expect(normalizeTimezone("shortcut")).toBe("Asia/Shanghai");
    expect(normalizeTimezone(undefined)).toBe("Asia/Shanghai");
  });
});
