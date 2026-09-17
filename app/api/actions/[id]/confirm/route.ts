import { NextResponse } from "next/server";
import { getBridge } from "@/lib/bridge";
import { actionRepository } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const pending = await actionRepository.get(id);
  if (!pending) return NextResponse.json({ error: "找不到这项操作。" }, { status: 404 });
  if (pending.status !== "pending") {
    return NextResponse.json({ error: `操作当前状态为 ${pending.status}，不能再次执行。` }, { status: 409 });
  }

  await actionRepository.update(id, { status: "running" });
  try {
    const result = await getBridge().execute(pending.action, id);
    const updated = await actionRepository.update(id, {
      status: result.ok ? "succeeded" : "failed",
      result,
    });
    return NextResponse.json({ pending: updated, result }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bridge 执行失败。";
    await actionRepository.update(id, { status: "failed", result: { ok: false, message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
