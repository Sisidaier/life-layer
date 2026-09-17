import { addMinutes } from "date-fns";
import type { LifeAction } from "@/lib/action-schema";
import { tomorrowAt } from "@/lib/time";

export function parseGoldenPath(text: string, timezone: string, now = new Date()): LifeAction | null {
  const normalized = text.replace(/[。！!\s]/g, "");
  const isSwimmingTomorrow = normalized.includes("明天") && normalized.includes("游泳");
  const timeMatch = normalized.match(/(?:晚上|下班后)?(\d{1,2})(?:点|:([0-5]\d))/);

  if (!isSwimmingTomorrow || !timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  if ((normalized.includes("晚上") || normalized.includes("下班后")) && hour < 12) hour += 12;

  const start = tomorrowAt(hour, minute, timezone, now);
  const end = addMinutes(start, 60);

  return {
    version: "1",
    operation: "create",
    kind: "calendar",
    title: "游泳",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    dueAt: null,
    allDay: false,
    timezone,
    location: null,
    notes: null,
    externalId: null,
    query: null,
    confidence: 0.99,
    rationale: "游泳在明确时间开始并占用 60 分钟，因此属于 Calendar 事件。",
    needsConfirmation: true,
  };
}
