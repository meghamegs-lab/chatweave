# ChatBridge Demo Script

## Opening (30 seconds)

"ChatBridge is an AI-powered learning platform where students can chat with an AI assistant that seamlessly integrates third-party apps — chess, weather, Spotify — directly inside the conversation. No tab switching, no separate apps. Everything lives in the chat."

---

## High-Level Architecture (1 minute)

```
                    +------------------+
                    |   Web Browser    |
                    |  (localhost:3001)|
                    +--------+---------+
                             |
                    Socket.io + REST API
                             |
                    +--------+---------+
                    |  Express Server  |
                    |  (Node.js)       |
                    +--+-----+-----+--+
                       |     |     |
              +--------+  +--+--+  +--------+
              | SQLite |  | LLM |  | Plugin |
              |   DB   |  | API |  |Registry|
              +--------+  +-----+  +--------+
                          (Claude/
                           GPT-4o)
```

**Three layers:**

1. **Frontend** — Vanilla JS single-page app served as static HTML. Handles auth, chat UI, and plugin iframe management. Uses Socket.io for real-time streaming.

2. **Backend** — Express.js server that handles authentication (JWT), manages chat sessions (SQLite), streams LLM responses (Vercel AI SDK), and coordinates plugin tool calls.

3. **Plugin System** — Each plugin is an independent React app built with Vite, served as static files, and embedded as sandboxed iframes inside the chat. Communication happens via the postMessage bridge protocol.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Server** | Express.js |
| **Real-time** | Socket.io |
| **Database** | SQLite (better-sqlite3, WAL mode) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **LLM** | Vercel AI SDK v6 (Anthropic Claude / OpenAI GPT-4o) |
| **Plugins** | React 18 + Vite (individual apps) |
| **Plugin Communication** | postMessage bridge (iframe sandbox) |
| **Validation** | Zod schemas |
| **Language** | TypeScript throughout |

---

## Demo Flow (5 minutes)

### 1. Login (30 seconds)

- Open `http://localhost:3001`
- Register with email + password (roles: Student/Teacher)
- JWT token stored in localStorage, Socket.io authenticates automatically
- "Notice the green 'Connected' badge — we have a live WebSocket connection"

### 2. Chess Plugin (2 minutes)

- Click "+ New" to create a chat
- Type: **"Let's play chess"**
- Watch the AI respond with text AND trigger a tool call
- "The AI recognized the intent and called the `start_chess_game` tool. Behind the scenes:"
  1. LLM returned a `tool-call` event for `chess-game__start_chess_game`
  2. Server parsed the namespaced tool name and emitted `plugin:invoke` via Socket.io
  3. Frontend created an iframe pointing to `/plugins/chess/`
  4. Chess React app loaded, sent `PLUGIN_READY` via postMessage
  5. Platform sent `TOOL_INVOKE` with `{difficulty: "medium", color: "white"}`
  6. Chess app initialized the board and sent back `TOOL_RESULT`
- **Play a few moves** — drag and drop pieces, AI responds automatically
- "The chess game runs entirely in a sandboxed iframe. It communicates through postMessage — no direct DOM access to the parent."

### 3. Weather Plugin (1 minute)

- Create another new chat
- Type: **"What's the weather in Tokyo?"**
- AI calls `get_weather` tool
- Weather dashboard appears inline with temperature, humidity, wind, and conditions
- "Same pattern — different plugin, same architecture. The plugin auto-completes after displaying data."

### 4. Spotify Plugin (1 minute)

- Create another new chat
- Type: **"Create a playlist for studying"**
- AI calls `search_tracks` tool
- Spotify-themed UI appears with track results
- "This plugin demonstrates OAuth2 integration — in production it would connect to the real Spotify API."

### 5. Architecture Highlights (30 seconds)

- "All three plugins run on the **same port** (3001) — no separate dev servers"
- "Plugins are **hot-swappable** — drop a new folder with a `manifest.json` and it's auto-discovered"
- "The LLM decides **when** to invoke a plugin based on user intent — no hard-coded triggers"
- "Everything streams in real-time via Socket.io — you see tokens appear as the AI thinks"

---

## Plugin System Deep Dive

### Manifest-Driven Registration

Each plugin has a `manifest.json`:

```json
{
  "id": "chess-game",
  "name": "Chess Learning Game",
  "iframe_url": "http://localhost:3001/plugins/chess/",
  "tools": [
    {
      "name": "start_chess_game",
      "description": "Start a new chess game",
      "parameters": {
        "type": "object",
        "properties": {
          "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] },
          "color": { "type": "string", "enum": ["white", "black"] }
        }
      }
    }
  ],
  "completion_events": ["game_finished"]
}
```

At startup, the server scans `/plugins/*/manifest.json`, registers tools with the LLM, and serves each plugin's `dist/` folder as static files.

### postMessage Bridge Protocol

```
Platform → Plugin:
  PLUGIN_INIT    → { sessionId, theme, locale }
  TOOL_INVOKE    → { toolName, parameters }
  THEME_UPDATE   → { theme }
  PLUGIN_DESTROY → cleanup

Plugin → Platform:
  PLUGIN_READY   → { version }
  TOOL_RESULT    → { result }
  STATE_UPDATE   → { state, summary }
  PLUGIN_COMPLETE → { event, data, summary }
  PLUGIN_RESIZE  → { height }
```

### Tool Call Flow

```
User: "Let's play chess"
  → Socket.io: chat:message
  → LLM: streamText() with tools
  → LLM returns: tool-call { chess-game__start_chess_game }
  → Server parses: pluginId=chess-game, toolName=start_chess_game
  → Socket.io: plugin:invoke → Frontend
  → Frontend: creates iframe, sends TOOL_INVOKE via postMessage
  → Chess app: processes, returns TOOL_RESULT via postMessage
  → Frontend: forwards result via Socket.io
  → LLM: continues generation with tool result
```

---

## Database Schema (SQLite)

- **users** — email, password_hash (bcrypt), display_name, role
- **sessions** — user_id, title, timestamps
- **messages** — session_id, role (user/assistant/system), content, metadata
- **plugins** — manifest data, enabled/disabled state
- **plugin_tools** — tool definitions extracted from manifests
- **plugin_instances** — runtime state per session
- **oauth_tokens** — OAuth2 credentials per user per plugin

---

## Key Design Decisions

1. **Single port** — Plugins built to static files and served from Express, not separate dev servers
2. **Incremental DOM** — Chat UI uses direct DOM manipulation (not innerHTML) to preserve plugin iframes across state updates
3. **Namespaced tools** — `pluginId__toolName` format lets the LLM call any plugin's tools without conflicts
4. **Sandbox isolation** — Plugins run in `allow-scripts allow-same-origin allow-popups` sandbox
5. **Streaming architecture** — Vercel AI SDK's `fullStream` captures both text deltas and tool call events in a single async iterator
6. **Empty message filtering** — Tool-only LLM responses produce no text; these are filtered before sending to the API to avoid Anthropic's "non-empty text" requirement

---

## Running the Project

```bash
# Install dependencies
cd chatweave && pnpm install

# Set environment variables
cp server/.env.example server/.env
# Edit server/.env with your API keys

# Build plugins
cd plugins/chess && pnpm build
cd ../weather && pnpm build
cd ../spotify && pnpm build

# Start server
cd ../../server && npx ts-node src/index.ts

# Open http://localhost:3001
```
