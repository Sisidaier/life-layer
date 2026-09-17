# Apple Shortcuts bridge

The real bridge runs one macOS shortcut named `Life Layer Bridge`. The shortcut can sync through iCloud and appear on iPhone, while the local backend invokes it through the macOS `shortcuts` command.

## Contract

The shortcut receives a UTF-8 JSON file as Shortcut Input. It must return JSON to the output file.

Input example:

```json
{
  "requestId": "uuid",
  "action": {
    "operation": "create",
    "kind": "calendar",
    "title": "游泳",
    "startAt": "2026-09-18T11:00:00.000Z",
    "endAt": "2026-09-18T12:00:00.000Z",
    "timezone": "Asia/Shanghai"
  }
}
```

Success output:

```json
{
  "ok": true,
  "externalId": "apple-object-id",
  "message": "已添加到日历",
  "item": {
    "title": "游泳",
    "startAt": "2026-09-18T11:00:00.000Z",
    "endAt": "2026-09-18T12:00:00.000Z"
  }
}
```

Failure output:

```json
{ "ok": false, "message": "Calendar permission denied" }
```

## Shortcut actions

Create a shortcut called `Life Layer Bridge` with these top-level steps:

1. Get File from Shortcut Input.
2. Get Text from File.
3. Get Dictionary from Input.
4. Read `action.kind` and `action.operation`.
5. Branch on `calendar` or `reminder`, then on `create`, `query`, `update`, or `delete`.
6. Use Calendar actions for calendar items and Reminders actions for reminder items.
7. Return a Dictionary matching the output contract and use “Stop and Output”.

For Calendar create, map `title`, `startAt`, `endAt`, `location`, and `notes` to “Add New Event”. For Reminders create, map `title`, `dueAt`, and `notes` to “Add New Reminder”. Query, update, and delete should return the stable identifier exposed by Shortcuts when available. If the installed macOS version does not expose a stable identifier, resolve by exact title plus a narrow date window and reject multiple matches.

## Enable the bridge

Copy `.env.example` to `.env.local`, then set:

```bash
LIFE_LAYER_BRIDGE=shortcuts
LIFE_LAYER_SHORTCUT_NAME="Life Layer Bridge"
```

Run `shortcuts run "Life Layer Bridge"` once manually so macOS can show Calendar and Reminders permission prompts. The app never bypasses those prompts.
