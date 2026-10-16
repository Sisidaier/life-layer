import { NextResponse } from "next/server";
import { getBridge } from "@/lib/bridge";
import { listWritableCalendars } from "@/lib/bridge/calendar-catalog";
import { classifyCalendar, classifyCalendarBatch } from "@/lib/calendar-classifier";
import { parseIntent } from "@/lib/parser";
import type { PendingAction, PendingBatch } from "@/lib/action-schema";
import { findInternalConflicts, mergeExactCalendarRanges } from "@/lib/batches";
import { listAppleCalendarConflicts } from "@/lib/bridge/calendar-conflicts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; clarificationSource?: unknown };
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "请输入一条消息。" }, { status: 400 });
    }

    const userText = body.message.trim();
    const previous = typeof body.clarificationSource === "string" ? body.clarificationSource.trim() : "";
    const sourceText = previous ? `${previous}\n补充信息：${userText}` : userText;
    const calendarCatalogPromise = listWritableCalendars();
    const calendarNamesPromise = calendarCatalogPromise.then((calendars) => calendars.map((calendar) => calendar.name));
    const plan = await parseIntent(sourceText);
    if (plan.status === "needs_clarification") {
      return NextResponse.json({
        type: "clarification",
        questions: plan.questions,
        sourceText,
      });
    }

    const actions = mergeExactCalendarRanges(plan.actions);
    if (actions.length > 1) {
      if (actions.some((action) => action.kind !== "calendar" || action.operation !== "create")) {
        return NextResponse.json(
          { error: "当前批量功能只支持创建 Apple Calendar 日程。请把其他操作单独发送。" },
          { status: 422 },
        );
      }
      const calendarNames = await calendarNamesPromise;
      const baseItems = actions.map((action) => ({
        id: crypto.randomUUID(),
        action,
        targetName: "",
        targetColor: null as string | null,
        status: "pending" as const,
        conflicts: [],
        result: null,
      }));
      const categoryPromise = classifyCalendarBatch(baseItems.map((item) => ({
        id: item.id,
        text: [item.action.title, item.action.notes, item.action.rationale].filter(Boolean).join(" "),
        title: item.action.title,
      })), calendarNames);
      const conflictPromise = listAppleCalendarConflicts(baseItems.map((item) => ({
        id: item.id,
        startAt: item.action.startAt!,
        endAt: item.action.endAt!,
      })), calendarNames);
      const [categories, external] = await Promise.all([categoryPromise, conflictPromise]);
      const calendarColors = new Map((await calendarCatalogPromise).map((calendar) => [calendar.name, calendar.color]));
      for (const item of baseItems) {
        item.targetName = categories.get(item.id)
          ?? process.env.LIFE_LAYER_DEFAULT_CALENDAR
          ?? calendarNames[0]
          ?? "默认日历";
        item.targetColor = calendarColors.get(item.targetName) ?? null;
      }
      const internal = findInternalConflicts(baseItems);
      const now = new Date().toISOString();
      const batch: PendingBatch = {
        id: crypto.randomUUID(),
        sourceText,
        status: "pending",
        items: baseItems.map((item) => ({
          ...item,
          conflicts: [...(internal.get(item.id) ?? []), ...(external.get(item.id) ?? [])],
        })),
        createdAt: now,
        updatedAt: now,
      };
      return NextResponse.json({ type: "batch_confirmation", batch });
    }

    const action = actions[0];
    const targetName = action.kind === "calendar"
      ? await classifyCalendar(sourceText, action.title, await calendarNamesPromise)
      : process.env.LIFE_LAYER_DEFAULT_REMINDERS_LIST || "默认列表";
    const targetColor = action.kind === "calendar"
      ? (await calendarCatalogPromise).find((calendar) => calendar.name === targetName)?.color ?? null
      : null;
    const now = new Date().toISOString();
    const pending: PendingAction = {
      id: crypto.randomUUID(),
      sourceText,
      status: "pending",
      action,
      targetName,
      targetColor,
      createdAt: now,
      updatedAt: now,
      result: null,
    };

    if (
      action.operation === "query" &&
      !action.needsConfirmation
    ) {
      const result = await getBridge().execute(action, pending.id, targetName ?? undefined);
      return NextResponse.json({
        type: "result",
        pending: { ...pending, status: result.ok ? "succeeded" : "failed", result },
        result,
      });
    }

    return NextResponse.json({ type: "confirmation", pending });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法理解这条消息。";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
