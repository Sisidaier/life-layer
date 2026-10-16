import { NextResponse } from "next/server";
import { actionRepository } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  const history = (await actionRepository.list()).map((entry) => {
    const resultCalendar = (entry.result as { item?: { calendar?: unknown } } | null)?.item?.calendar;
    return {
      ...entry,
      targetName: entry.targetName
        ?? (typeof resultCalendar === "string" ? resultCalendar : null)
        ?? (entry.action.kind === "calendar"
          ? process.env.LIFE_LAYER_DEFAULT_CALENDAR || "默认日历"
          : process.env.LIFE_LAYER_DEFAULT_REMINDERS_LIST || "默认列表"),
      targetColor: entry.targetColor ?? null,
    };
  });
  return NextResponse.json({ history });
}
