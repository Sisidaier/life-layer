import { NextResponse } from "next/server";
import { pendingBatchSchema, type BatchItem, type PendingBatch } from "@/lib/action-schema";
import { findInternalConflicts } from "@/lib/batches";
import { getBridge } from "@/lib/bridge";
import { listAppleCalendarConflicts } from "@/lib/bridge/calendar-conflicts";
import { listWritableCalendarNames } from "@/lib/bridge/calendar-catalog";

export const runtime = "nodejs";

async function refreshConflicts(batch: PendingBatch): Promise<PendingBatch> {
  const internal = findInternalConflicts(batch.items);
  const external = await listAppleCalendarConflicts(batch.items.map((item) => ({
    id: item.id,
    startAt: item.action.startAt!,
    endAt: item.action.endAt!,
  })), await listWritableCalendarNames());
  return {
    ...batch,
    items: batch.items.map((item) => ({
      ...item,
      conflicts: [...(internal.get(item.id) ?? []), ...(external.get(item.id) ?? [])],
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = pendingBatchSchema.safeParse(body?.batch);
  if (!parsed.success) return NextResponse.json({ error: "批次数据无效。" }, { status: 400 });
  if (parsed.data.id !== id) return NextResponse.json({ error: "批次 ID 不匹配。" }, { status: 400 });
  if (parsed.data.status !== "pending") return NextResponse.json({ error: "这个批次已经处理。" }, { status: 409 });

  let batch = await refreshConflicts(parsed.data);
  const hasConflicts = batch.items.some((item) => item.conflicts.length > 0);
  if (hasConflicts && body?.allowConflicts !== true) {
    return NextResponse.json({ error: "发现时间冲突，请查看后再决定是否仍然写入。", batch }, { status: 409 });
  }

  const ordered = [...batch.items].sort((left, right) =>
    new Date(left.action.startAt!).getTime() - new Date(right.action.startAt!).getTime(),
  );
  const updates = new Map<string, BatchItem>();
  let stopped = false;
  for (const item of ordered) {
    if (stopped) {
      updates.set(item.id, { ...item, status: "skipped", result: null });
      continue;
    }
    try {
      const result = await getBridge().execute(item.action, item.id, item.targetName);
      if (result.ok) {
        updates.set(item.id, { ...item, status: "succeeded", result });
      } else {
        updates.set(item.id, { ...item, status: "failed", result });
        stopped = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge 执行失败。";
      updates.set(item.id, { ...item, status: "failed", result: { ok: false, message } });
      stopped = true;
    }
  }

  const items = batch.items.map((item) => updates.get(item.id) ?? item);
  const succeeded = items.filter((item) => item.status === "succeeded").length;
  const failed = items.some((item) => item.status === "failed");
  batch = {
    ...batch,
    items,
    status: failed ? (succeeded > 0 ? "partial" : "failed") : "succeeded",
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json({
    batch,
    summary: {
      succeeded,
      failed: items.filter((item) => item.status === "failed").length,
      skipped: items.filter((item) => item.status === "skipped").length,
    },
  });
}
