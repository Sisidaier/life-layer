# Life Layer

A small local-first MVP that turns a chat message into a confirmed Apple Calendar event or Reminder.

## Golden Path

```text
明天下班后 7 点去游泳。
```

The app parses this as a 60-minute Calendar event, shows a confirmation card, then sends it to the configured bridge only after confirmation.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The example configuration uses a mock bridge. Use `LIFE_LAYER_BRIDGE=applescript` for direct local macOS Calendar and Reminders access.

Alternatively, follow [docs/SHORTCUTS_BRIDGE.md](docs/SHORTCUTS_BRIDGE.md), then set `LIFE_LAYER_BRIDGE=shortcuts`.

## DeepSeek intent parsing

The Golden Path has a deterministic local parser. Other natural-language create, query, update, and delete requests can use DeepSeek's OpenAI-compatible JSON API:

```bash
LIFE_LAYER_AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

Keep the key in `.env.local`; that file is ignored by Git. Restart the development server after changing it.

## Documents

- [Architecture and scope](docs/ARCHITECTURE.md)
- [Structured action schema](docs/ACTION_SCHEMA.md)
- [Apple Shortcuts bridge](docs/SHORTCUTS_BRIDGE.md)
- [iPhone PWA path](docs/IPHONE_PWA.md)

## Directory structure

```text
app/
  api/chat/                   parse a user message
  api/actions/[id]/           confirm or cancel a pending mutation
  page.tsx                    chat and confirmation UI
lib/
  parser/                     deterministic and OpenAI intent parsers
  bridge/                     replaceable Apple integration boundary
  action-schema.ts            canonical Zod contract
  repository.ts               local pending-action persistence
docs/                         architecture, schema, and bridge setup
```

## Golden Path development order

1. Define and validate the structured action contract.
2. Parse the target sentence into a Calendar create action.
3. Persist it as pending and render the confirmation card.
4. Execute only after confirmation through the bridge interface.
5. Verify with the mock bridge.
6. Switch to the macOS automation bridge and approve Calendar access.
7. Verify the event appears in Apple Calendar and syncs to iPhone.
8. Exercise query, update, and delete through the same contract.
