import { NextResponse } from "next/server";
import { actionRepository } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  const entries = await actionRepository.list();
  const history = entries.map((entry) => ({
    ...entry,
    targetName:
      entry.action.kind === "calendar"
        ? process.env.LIFE_LAYER_DEFAULT_CALENDAR || "默认日历"
        : process.env.LIFE_LAYER_DEFAULT_REMINDERS_LIST || "默认列表",
  }));
  return NextResponse.json({ history });
}
