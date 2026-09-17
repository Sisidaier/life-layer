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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  result: z.unknown().nullable(),
});

export type PendingAction = z.infer<typeof pendingActionSchema>;
