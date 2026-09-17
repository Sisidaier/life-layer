# Life Layer MVP architecture

## Scope

The MVP validates one end-to-end action: “明天下班后 7 点去游泳。” becomes a 60-minute Apple Calendar event after explicit confirmation. Calendar and Reminders share CRUD contracts. Notes, automatic weekly planning, conflict optimization, memory, dashboards, and deployment remain outside this phase.

## Request flow

```text
Browser chat UI
  -> POST /api/chat
  -> IntentParser (OpenAI Structured Outputs or deterministic Golden Path fallback)
  -> Zod validation and normalization
  -> PendingActionRepository
  -> confirmation card
  -> POST /api/actions/:id/confirm
  -> LifeBridge
  -> MockBridge | MacShortcutsBridge
  -> Apple Calendar / Reminders
```

Mutations require confirmation. Queries are read-only and execute immediately. The repository stores the external identifier returned by the bridge so later updates and deletes target the existing item.

## MVP stack

- Next.js and React with TypeScript
- Route Handlers for the local backend
- Zod as the single runtime contract
- DeepSeek JSON Output through its OpenAI-compatible API when `DEEPSEEK_API_KEY` is available
- OpenAI Responses API Structured Outputs as an optional alternative
- A deterministic parser for the Golden Path, so local validation has no API dependency
- JSON-file persistence under `.data/` for one local user
- macOS Calendar/Reminders automation as the zero-setup local bridge
- macOS Shortcuts CLI as an alternative bridge

JSON persistence is intentional for the local single-user MVP. Replace `ActionRepository` with SQLite before multi-user or hosted use.

## Bridge boundary

Application code depends only on `LifeBridge.execute(action)`. The macOS automation adapter writes through the installed Calendar and Reminders apps and relies on their normal permission prompts. The Shortcuts adapter serializes the action to a temporary JSON file and runs `shortcuts run`. A future EventKit adapter can implement the same interface without changing the parser, confirmation flow, or UI.

## Security and correctness rules

- Model output is untrusted and must pass Zod validation.
- The model never calls Calendar or Reminders directly.
- Create, update, and delete require a separate confirmation request.
- Update and delete must carry an `externalId` or an unambiguous query resolved by the bridge.
- Times are stored as ISO 8601 instants, with the originating IANA timezone retained.
