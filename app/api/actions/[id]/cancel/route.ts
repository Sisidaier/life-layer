import { NextResponse } from "next/server";
import { actionRepository } from "@/lib/repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const pending = await actionRepository.get(id);
  if (!pending) return NextResponse.json({ error: "找不到这项操作。" }, { status: 404 });
  if (pending.status !== "pending") {
    return NextResponse.json({ error: "这项操作已经处理。" }, { status: 409 });
  }
  const updated = await actionRepository.update(id, { status: "cancelled" });
  return NextResponse.json({ pending: updated });
}
