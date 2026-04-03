# ChatBridge Demo Script

## Opening (30 seconds)

"ChatBridge started as an open-source AI chat application — a clean, functional chat interface with LLM integration. What we've built on top of it is a **plugin architecture** that lets third-party applications embed directly inside the chat conversation. Instead of switching tabs or opening separate apps, students interact with tools — like a chess game — right inside the AI chat. The AI decides when to launch a plugin based on the student's intent, and strict security guardrails ensure that third-party content is safe and appropriate for an educational setting."

---

## How We Extended the Open-Source Codebase (1 minute)

"The original open-source project gave us a solid foundation: an Express.js server, Socket.io real-time transport, and LLM streaming. Here's what we built on top of it to enable third-party app integration:"

| What We Inherited | What We Built |
|-------------------|---------------|
| Express server, JWT auth, SQLite | Plugin registry, manifest validation, sandboxed iframe system |
| Basic LLM chat streaming | Tool-calling pipeline — LLM decides when to invoke plugins |
| Socket.io real-time transport | Plugin lifecycle protocol (postMessage bridge) |
| User/session management | Plugin enable/disable controls, per-session plugin instances |
| REST API routing | Proxy layer to hide API keys from plugin iframes |

"We didn't fork and modify — we extended. The core chat works as-is; our plugin system layers on top without touching the original auth, session, or message-handling code."

---

## High-Level Architecture (1 minute)

```
                    +------------------+
                    |   Web Browser    |
                    | (Chat UI + Plugins)
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
                          (Claude       |
                           Sonnet)   Manifest
                                    Validation
                                       +
                                    Sandbox
                                    Enforcement
```

**Three layers:**

1. **Frontend** — Vanilla JS single-page app. Handles auth, chat UI, and plugin iframe management. Uses Socket.io for real-time streaming. Plugins render inside sandboxed iframes with strict permission boundaries.

2. **Backend** — Express.js server handling authentication (JWT + bcrypt), chat sessions (SQLite), LLM streaming (Vercel AI SDK), and plugin coordination. Every plugin manifest is validated against a strict Zod schema before registration.

3. **Plugin System** — Each plugin is an independent React app built with Vite, served as static files, and embedded as a sandboxed iframe. Communication happens exclusively via the postMessage bridge protocol — no direct DOM access, no shared JavaScript context.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Server** | Express.js |
| **Real-time** | Socket.io |
| **Database** | SQLite (better-sqlite3, WAL mode) |
| **Auth** | JWT (access + refresh tokens), bcrypt (12 rounds) |
| **LLM** | Vercel AI SDK v6 (Anthropic Claude Sonnet) |
| **Plugin Apps** | React 18 + Vite |
| **Plugin Communication** | postMessage bridge (iframe sandbox) |
| **Validation** | Zod schemas (server-side, all inputs) |
| **Language** | TypeScript throughout |

---

## Demo Flow (5 minutes)

### 1. Login (30 seconds)

- Open ChatBridge at the deployed URL
- Register with email + password (roles: Student/Teacher)
- JWT access token (1h expiry) stored securely; refresh token set as HttpOnly cookie
- "Notice the green 'Connected' badge — we have an authenticated WebSocket connection. The socket verified our JWT before accepting the connection."

### 2. Chess Plugin Demo (3 minutes)

- Click "+ New" to create a chat session
- Type: **"Let's play chess"**
- Watch the AI respond with text AND trigger a tool call
- "Here's what just happened under the hood:"

**Tool Calling Flow:**

1. The user's message went to Claude Sonnet via the Vercel AI SDK's `streamText()` — along with a **tools** definition automatically built from registered plugin manifests
2. Claude recognized the intent and returned a `tool-call` event for `chess-game__start_chess_game`
3. The server parsed the **namespaced tool name** (`pluginId__toolName` format) and emitted a `plugin:invoke` event via Socket.io
4. The frontend created a **sandboxed iframe** pointing to `/plugins/chess/`
5. The chess React app loaded and sent `PLUGIN_READY` via postMessage
6. The platform replied with `PLUGIN_INIT` (session context) and `TOOL_INVOKE` with `{difficulty: "medium", color: "white"}`
7. The chess app initialized the board and returned `TOOL_RESULT`
8. The LLM continued its response, now aware that a chess game is active

- **Play a few moves** — drag and drop pieces, the AI opponent responds
- "The chess game runs entirely inside a sandboxed iframe. It has no access to the parent page's DOM, cookies, or localStorage. It communicates through a strict postMessage protocol — the only bridge between the plugin and the platform."

### 3. Architecture Highlights (1 minute 30 seconds)

- "The LLM decides **when** to invoke a plugin based on user intent — there are no hard-coded keyword triggers. The AI has tool definitions in its context and makes the decision autonomously."
- "Plugins are **manifest-driven** — drop a folder with a `manifest.json` and a built `dist/` directory, and the server auto-discovers and registers it at startup."
- "Administrators can **enable or disable** any plugin via API. Disabled plugins are completely hidden from the LLM — their tools are not included in the prompt."
- "Everything streams in real-time via Socket.io — you see tokens appear as the AI generates its response."

---

## Security, Compliance & Guardrails Deep Dive

### Iframe Sandbox Isolation

"This is our primary defense for ensuring third-party plugins cannot show inappropriate content or interfere with the platform."

```
Plugin iframe sandbox attributes:
  allow-scripts       ✅  (plugin needs JS to run)
  allow-popups        ✅  (controlled, for OAuth flows)
  ─────────────────────────────────────────────────
  allow-top-navigation  ❌  BLOCKED — plugin cannot navigate the parent page
  allow-forms           ❌  BLOCKED — plugin cannot submit forms to external servers
  allow-same-origin     ❌  BLOCKED in Electron app — plugin cannot access parent cookies/storage
  allow-pointer-lock    ❌  BLOCKED — plugin cannot capture mouse
  allow-modals          ❌  BLOCKED — plugin cannot show alert/confirm/prompt dialogs
```

The manifest schema enforces this at registration time — plugins can only request `allow-scripts` and `allow-popups`. Any other permission is rejected by the Zod validation:

```typescript
sandbox: z.object({
  permissions: z.array(
    z.enum(['allow-scripts', 'allow-popups'])
  ).default(['allow-scripts']),
})
```

"Even if a malicious plugin tries to declare extra permissions in its manifest, the server rejects it before registration."

### postMessage Bridge Protocol — Controlled Communication

"Plugins don't get a JavaScript API or SDK injected. They communicate through a narrow, typed postMessage channel:"

```
Platform → Plugin (what we send):
  PLUGIN_INIT    → session context, theme, locale
  TOOL_INVOKE    → specific tool call with parameters
  THEME_UPDATE   → visual theme changes
  PLUGIN_DESTROY → cleanup signal

Plugin → Platform (what we accept):
  PLUGIN_READY    → ready signal with version
  TOOL_RESULT     → result of a tool invocation
  STATE_UPDATE    → state summary for AI context
  PLUGIN_COMPLETE → completion signal with event data
  PLUGIN_RESIZE   → height change request
```

"The platform validates every incoming message:"
- **`event.isTrusted`** check — rejects programmatically dispatched events
- **Origin verification** — messages only accepted from the registered plugin origin
- **Type validation** — message must have a valid `type` field matching the protocol

"A plugin cannot send arbitrary messages to the platform. It can only respond within this protocol. It cannot read the student's chat history, access other plugins, or exfiltrate data through the postMessage channel."

### Authentication & Authorization

| Control | Implementation |
|---------|---------------|
| **Password storage** | bcrypt with 12 rounds — passwords never stored in plaintext |
| **Access tokens** | JWT with 1-hour expiry |
| **Refresh tokens** | JWT with 7-day expiry, stored as HttpOnly secure cookie (not accessible to JavaScript/plugins) |
| **Socket.io auth** | JWT verified before WebSocket connection accepted |
| **Session ownership** | Every chat/session operation verifies the authenticated user owns the resource (403 if not) |
| **Role-based access** | Student/Teacher roles stored per user |

### Input Validation (Zod, Server-Side)

"Every input that enters the system is validated with Zod schemas before processing:"

- **User registration** — email format, password minimum 8 chars, display name 1-100 chars, role enum
- **Chat sessions** — title length 1-500, pagination limits (max 200 results)
- **Plugin manifests** — strict regex for IDs (`^[a-z][a-z0-9-]*$`), tool names (`^[a-z][a-z0-9_]*$`), description length caps, URL validation, enum-restricted categories and auth types
- **Plugin tools** — parameter schemas validated as proper JSON Schema objects
- **Messages** — role enum, non-empty content required

"Invalid input is rejected with a structured 400 error before it reaches any business logic."

### XSS Prevention

"The frontend escapes all dynamic content before rendering:"

```javascript
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;');
}
```

"This is applied to every user-generated string rendered in the DOM — session titles, message content, plugin names, user display names. Combined with iframe sandboxing, a plugin cannot inject scripts or HTML into the parent page."

### Plugin Enable/Disable Controls

"Administrators can control which plugins are available to students:"

```
POST /api/plugins/:id/enable    → plugin tools appear in LLM context
POST /api/plugins/:id/disable   → plugin tools hidden from LLM, cannot be invoked
```

"When a plugin is disabled, it's completely invisible to the AI — its tools are not included in the `streamText()` call. The LLM cannot invoke a disabled plugin because it doesn't know it exists."

### Guardrails Summary: How We Protect Students

| Threat | Mitigation |
|--------|------------|
| Plugin shows inappropriate content | Iframe sandbox prevents navigation, form submission, and modal dialogs. Plugin can only render within its own iframe bounds. |
| Plugin accesses student data | Sandbox blocks cookie/localStorage access. postMessage bridge only sends session ID and tool parameters — never auth tokens, personal data, or chat history. |
| Plugin injects malicious scripts into chat | Iframe sandbox isolates JavaScript context. `escapeHtml()` prevents XSS. postMessage origin verification rejects spoofed messages. |
| Plugin phones home with student data | Sandbox restrictions + CORS prevent unauthorized network requests from the iframe in strict configurations. |
| Malicious manifest bypasses validation | Zod schema rejects invalid manifests at registration. Sandbox permissions restricted to a whitelist of two (`allow-scripts`, `allow-popups`). |
| Disabled plugin invoked by LLM | Plugin registry filters disabled plugins from tool definitions — LLM never sees them. |
| Unauthorized user accesses sessions | JWT auth on all routes + session ownership verification (403 if not owner). |
| Brute-force password attacks | bcrypt with 12 rounds makes offline attacks computationally expensive. |

---

## Tool Calling Architecture

```
User: "Let's play chess"
  → Socket.io: chat:message { sessionId, content }
  → Server: verify session ownership
  → Server: build tools from enabled plugins (pluginRegistry.getToolsForEnabledPlugins())
  → Server: streamText() to Claude with tools
  → Claude: returns tool-call { chess-game__start_chess_game, {difficulty, color} }
  → Server: parse namespaced name → pluginId: "chess-game", toolName: "start_chess_game"
  → Socket.io: plugin:invoke → Frontend
  → Frontend: create sandboxed iframe → /plugins/chess/
  → Plugin: PLUGIN_READY (postMessage)
  → Platform: PLUGIN_INIT + TOOL_INVOKE (postMessage)
  → Plugin: processes tool call, renders chess board
  → Plugin: TOOL_RESULT (postMessage)
  → Frontend: forward result via Socket.io → Server
  → Server: feed result back to Claude
  → Claude: continues response with awareness of game state
```

---

## Manifest-Driven Plugin Registration

Each plugin declares its capabilities in a `manifest.json`:

```json
{
  "id": "chess-game",
  "name": "Chess Learning Game",
  "version": "1.0.0",
  "category": "games",
  "iframe_url": "/plugins/chess/",
  "tools": [
    {
      "name": "start_chess_game",
      "description": "Start a new chess game for the student",
      "parameters": {
        "type": "object",
        "properties": {
          "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] },
          "color": { "type": "string", "enum": ["white", "black"] }
        }
      }
    }
  ],
  "completion_events": ["game_finished"],
  "sandbox": {
    "permissions": ["allow-scripts"]
  }
}
```

At startup, the server scans `/plugins/*/manifest.json`, validates each against the Zod schema, registers tools with the LLM, and serves each plugin's `dist/` as static files. No code changes needed to add a new plugin.

---

## Running the Project

```bash
# Install dependencies
cd chatweave && pnpm install

# Set environment variables
cp server/.env.example server/.env
# Edit server/.env with API keys, JWT secrets

# Build the chess plugin
cd plugins/chess && pnpm install && pnpm build

# Start server
cd ../../server && pnpm dev

# Open http://localhost:3001
# Register → New Chat → "Let's play chess"
```
