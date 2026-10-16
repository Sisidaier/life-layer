import { z } from "zod";

export const lifeActionSchema = z
  .object({
    version: z.literal("1"),
    operation: z.enum(["create", "query", "update", "delete"]),
    kind: z.enum(["calendar", "reminder"]),
    title: z.string().min(1).nullable(),
    startAt: z.string().datetime().nullable(),
    endAt: z.string().datetime().nullable(),
    dueAt: z.string().datetime().nullable(),
    allDay: z.boolean(),
    timezone: z.string().min(1),
    location: z.string().nullable(),
    notes: z.string().nullable(),
    externalId: z.string().nullable(),
    query: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    rationale: z.string().min(1),
    needsConfirmation: z.boolean(),
  })
  .strict()
  .superRefine((action, context) => {
    if (action.operation === "create" && !action.title) {
      context.addIssue({ code: "custom", message: "Create requires a title", path: ["title"] });
    }
    if (action.kind === "calendar" && action.operation === "create") {
      if (!action.startAt || !action.endAt) {
        context.addIssue({ code: "custom", message: "Calendar create requires startAt and endAt" });
      }
    }
    if (action.operation !== "query" && action.operation !== "create" && !action.externalId && !action.query) {
      context.addIssue({ code: "custom", message: "Update/delete requires externalId or query" });
    }
  });

export type LifeAction = z.infer<typeof lifeActionSchema>;

export const pendingActionSchema = z.object({
  id: z.string().uuid(),
  sourceText: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]),
  action: lifeActionSchema,
  targetName: z.string().min(1).nullable().optional(),
  targetColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  result: z.unknown().nullable(),
});

export type PendingAction = z.infer<typeof pendingActionSchema>;

export const parsePlanSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    actions: z.array(lifeActionSchema).min(1),
  }).strict(),
  z.object({
    status: z.literal("needs_clarification"),
    questions: z.array(z.string().min(1)).min(1),
  }).strict(),
]);

export type ParsePlan = z.infer<typeof parsePlanSchema>;

export const batchConflictSchema = z.object({
  source: z.enum(["batch", "calendar"]),
  title: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  calendarName: z.string().min(1).nullable(),
  withItemId: z.string().uuid().nullable(),
});

export const batchItemSchema = z.object({
  id: z.string().uuid(),
  action: lifeActionSchema,
  targetName: z.string().min(1),
  targetColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  status: z.enum(["pending", "succeeded", "failed", "skipped"]),
  conflicts: z.array(batchConflictSchema),
  result: z.unknown().nullable(),
});

export const pendingBatchSchema = z.object({
  id: z.string().uuid(),
  sourceText: z.string().min(1),
  status: z.enum(["pending", "running", "succeeded", "partial", "failed", "cancelled"]),
  items: z.array(batchItemSchema).min(2),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BatchConflict = z.infer<typeof batchConflictSchema>;
export type BatchItem = z.infer<typeof batchItemSchema>;
export type PendingBatch = z.infer<typeof pendingBatchSchema>;
