import { describe, expect, it } from "vitest";
import type { LifeAction } from "@/lib/action-schema";
import { findInternalConflicts, mergeExactCalendarRanges } from "@/lib/batches";

function action(title: string, startAt: string, endAt: string): LifeAction {
  return {
    version: "1", operation: "create", kind: "calendar", title, startAt, endAt,
    dueAt: null, allDay: false, timezone: "Asia/Shanghai", location: null, notes: null,
    externalId: null, query: null, confidence: 0.9, rationale: "test", needsConfirmation: true,
  };
}

describe("batch calendar planning", () => {
  it("merges items with the exact same time range", () => {
    const merged = mergeExactCalendarRanges([
      action("吃饭", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z"),
      action("聊天", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z"),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("吃饭、聊天");
  });

  it("keeps overlapping ranges separate and reports both sides", () => {
    const items = [
      { id: "103774d6-094b-4fd0-a260-173d212265f7", action: action("游泳", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z") },
      { id: "7f727380-ed59-4114-9e82-0f24d45ca14c", action: action("吃饭", "2026-09-23T11:30:00.000Z", "2026-09-23T12:30:00.000Z") },
    ];
    expect(mergeExactCalendarRanges(items.map((item) => item.action))).toHaveLength(2);
    const conflicts = findInternalConflicts(items);
    expect(conflicts.get(items[0].id)?.[0].title).toBe("吃饭");
    expect(conflicts.get(items[1].id)?.[0].title).toBe("游泳");
  });

  it("does not report adjacent events as conflicts", () => {
    const items = [
      { id: "103774d6-094b-4fd0-a260-173d212265f7", action: action("游泳", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z") },
      { id: "7f727380-ed59-4114-9e82-0f24d45ca14c", action: action("吃饭", "2026-09-23T12:00:00.000Z", "2026-09-23T13:00:00.000Z") },
    ];
    expect(findInternalConflicts(items).size).toBe(0);
  });
});
