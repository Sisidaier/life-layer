import { NextResponse } from "next/server";
import { getBridge } from "@/lib/bridge";
import { parseIntent } from "@/lib/parser";
import { actionRepository } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "请输入一条消息。" }, { status: 400 });
    }

    const action = await parseIntent(body.message.trim());
    const pending = await actionRepository.create(body.message.trim(), action);

    if (action.operation === "query" && !action.needsConfirmation) {
      await actionRepository.update(pending.id, { status: "running" });
      const result = await getBridge().execute(action, pending.id);
      await actionRepository.update(pending.id, {
        status: result.ok ? "succeeded" : "failed",
        result,
      });
      return NextResponse.json({ type: "result", pending, result });
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
