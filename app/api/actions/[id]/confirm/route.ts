import { NextResponse } from "next/server";
import { lifeActionSchema, pendingActionSchema } from "@/lib/action-schema";
import { getBridge } from "@/lib/bridge";
import { actionRepository } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const supplied = body?.pending ? pendingActionSchema.safeParse(body.pending) : null;
  const pending = supplied?.success ? supplied.data : await actionRepository.get(id);
  if (!pending) return NextResponse.json({ error: "找不到这项操作。" }, { status: 404 });
  if (pending.id !== id) return NextResponse.json({ error: "操作 ID 不匹配。" }, { status: 400 });
  const action = lifeActionSchema.parse(pending.action);
  if (pending.status !== "pending") {
    return NextResponse.json({ error: `操作当前状态为 ${pending.status}，不能再次执行。` }, { status: 409 });
  }

  const stored = await actionRepository.get(id);
  if (stored) await actionRepository.update(id, { status: "running" });
  try {
    const result = await getBridge().execute(action, id, pending.targetName ?? undefined);
    const status = result.ok ? "succeeded" : "failed";
    const updated = stored
      ? await actionRepository.update(id, { status, result })
      : { ...pending, status, result, updatedAt: new Date().toISOString() };
    return NextResponse.json({ pending: updated, result }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bridge 执行失败。";
    if (stored) await actionRepository.update(id, { status: "failed", result: { ok: false, message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
