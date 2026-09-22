# Structured action schema

Every parser produces one versioned `LifeAction`. The application validates it before storing or executing it.

```ts
type LifeAction = {
  version: "1";
  operation: "create" | "query" | "update" | "delete";
  kind: "calendar" | "reminder";
  title: string | null;
  startAt: string | null;      // ISO 8601 instant; Calendar
  endAt: string | null;        // ISO 8601 instant; Calendar
  dueAt: string | null;        // ISO 8601 instant; Reminders
  allDay: boolean;
  timezone: string;            // IANA name, for example Asia/Shanghai
  location: string | null;
  notes: string | null;
  externalId: string | null;   // ID returned by the Apple bridge
  query: string | null;        // constrained lookup when ID is unavailable
  confidence: number;          // 0...1
  rationale: string;           // shown in the confirmation card
  needsConfirmation: boolean;
};
```

## Golden Path output

Given a current date of 2026-09-17 in `Asia/Shanghai`:

```json
{
  "version": "1",
  "operation": "create",
  "kind": "calendar",
  "title": "游泳",
  "startAt": "2026-09-18T11:00:00.000Z",
  "endAt": "2026-09-18T12:00:00.000Z",
  "dueAt": null,
  "allDay": false,
  "timezone": "Asia/Shanghai",
  "location": null,
  "notes": null,
  "externalId": null,
  "query": null,
  "confidence": 0.99,
  "rationale": "游泳在明确时间开始并占用 60 分钟，因此属于 Calendar 事件。",
  "needsConfirmation": true
}
```

Create, update, and delete require confirmation. A Calendar create requires both `startAt` and `endAt`. An update or delete requires an `externalId` or a constrained `query`.

The pending-action envelope also stores `targetName`. Calendar actions resolve this value from the user's current writable Apple Calendar categories before the confirmation card is shown, and the bridge writes to that same category after confirmation.
