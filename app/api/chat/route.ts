import { NextResponse } from "next/server";
import { getBridge } from "@/lib/bridge";
import { parseIntent } from "@/lib/parser";
import type { PendingAction } from "@/lib/action-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "请输入一条消息。" }, { status: 400 });
    }

    const action = await parseIntent(body.message.trim());
    const now = new Date().toISOString();
    const pending: PendingAction = {
      id: crypto.randomUUID(),
      sourceText: body.message.trim(),
      status: "pending",
      action,
      createdAt: now,
      updatedAt: now,
      result: null,
    };

    if (
      action.operation === "query" &&
      !action.needsConfirmation &&
      process.env.LIFE_LAYER_EXECUTION_MODE !== "shortcut"
    ) {
      const result = await getBridge().execute(action, pending.id);
      return NextResponse.json({
        type: "result",
        pending: { ...pending, status: result.ok ? "succeeded" : "failed", result },
        result,
      });
    }

    const targetName = action.kind === "calendar"
      ? process.env.LIFE_LAYER_DEFAULT_CALENDAR || "默认日历"
      : process.env.LIFE_LAYER_DEFAULT_REMINDERS_LIST || "默认列表";
    return NextResponse.json({ type: "confirmation", pending: { ...pending, targetName } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法理解这条消息。";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
