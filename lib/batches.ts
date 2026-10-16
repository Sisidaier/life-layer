import type { BatchConflict, LifeAction } from "@/lib/action-schema";

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

export function mergeExactCalendarRanges(actions: LifeAction[]): LifeAction[] {
  const merged: LifeAction[] = [];
  const rangeIndexes = new Map<string, number>();

  for (const action of actions) {
    if (action.kind !== "calendar" || action.operation !== "create" || !action.startAt || !action.endAt) {
      merged.push(action);
      continue;
    }
    const key = `${action.startAt}|${action.endAt}`;
    const index = rangeIndexes.get(key);
    if (index === undefined) {
      rangeIndexes.set(key, merged.length);
      merged.push(action);
      continue;
    }
    const previous = merged[index];
    merged[index] = {
      ...previous,
      title: unique([previous.title, action.title]).join("、"),
      location: unique([previous.location, action.location]).join("；") || null,
      notes: unique([previous.notes, action.notes]).join("\n") || null,
      confidence: Math.min(previous.confidence, action.confidence),
      rationale: "多项内容属于完全相同的时间段，已合并为一个 Calendar 事件。",
    };
  }
  return merged;
}

export function findInternalConflicts(
  items: Array<{ id: string; action: LifeAction }>,
): Map<string, BatchConflict[]> {
  const conflicts = new Map<string, BatchConflict[]>();
  const add = (id: string, conflict: BatchConflict) => conflicts.set(id, [...(conflicts.get(id) ?? []), conflict]);

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const a = items[left];
      const b = items[right];
      if (!a.action.startAt || !a.action.endAt || !b.action.startAt || !b.action.endAt) continue;
      if (new Date(a.action.startAt) >= new Date(b.action.endAt) || new Date(b.action.startAt) >= new Date(a.action.endAt)) continue;
      add(a.id, {
        source: "batch", title: b.action.title || "未命名日程", startAt: b.action.startAt,
        endAt: b.action.endAt, calendarName: null, withItemId: b.id,
      });
      add(b.id, {
        source: "batch", title: a.action.title || "未命名日程", startAt: a.action.startAt,
        endAt: a.action.endAt, calendarName: null, withItemId: a.id,
      });
    }
  }
  return conflicts;
}
