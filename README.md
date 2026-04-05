# ChatWeave

**AI-Powered Learning Platform Where Educational Apps Live Inside the Chat**

Students don't switch tabs — they interact with chess, math, vocabulary, financial literacy, and media literacy tools right in the conversation. The AI decides when to launch an app based on intent. An admin layer enforces platform rules and can instantly remove non-compliant apps.

**Live Demo:** [https://chatweave.up.railway.app](https://chatweave.up.railway.app)

---

## What We Built on Open Source

| Inherited (ChatBridge) | Built (ChatWeave) |
|---|---|
| Express + JWT auth + PostgreSQL | Plugin registry, manifest validation, sandboxed iframes |
| LLM chat streaming | Tool-calling pipeline — AI invokes plugins by intent |
| Socket.io real-time | postMessage bridge protocol for plugin lifecycle |
| User/session management | App Registry (submission + approval workflow) |
| REST API routing | App Moderation (rules engine, violation tracking, instant removal) |
| | App Discovery (kid-friendly welcome screen with 5 learning apps) |

We extended — not forked. Core chat is untouched; the plugin system layers on top.

---

## The 5 Learning Apps

| App | Domain | Key Features |
|-----|--------|-------------|
| **Chess** | Logic & Strategy | AI opponent, 3 difficulty levels, FEN board state, move history, play-again |
| **Math Quest** | STEM / Numeracy | 6 topics, adaptive difficulty, SVG manipulatives, level-up system |
| **Word Lab** | Literacy / Language | 4 modes (spelling/vocabulary/phonics/word-building), 52+ words, mastery tracking |
| **Money Sense** | Financial Literacy | Counting, making change, budgeting, virtual store, savings simulator |
| **Fact or Fiction** | Media Literacy | Fake news detection, source ranking, bias spotting, debate builder |

Each is a standalone React app communicating through the postMessage bridge. The AI decides which to launch based on student intent — no hardcoded triggers.

---

## Architecture

```
                 +--------------------+
                 |   Browser / App    |
                 | Chat UI + 5 Plugin |
                 |    Iframes         |
                 +--------+-----------+
                          |
                 Socket.io + REST API
                          |
                 +--------+-----------+
                 |   Express Server   |
                 +--+-----+-----+----+
                    |     |     |
           +--------+ +---+--+ +----------+
           |PostgreSQL| | LLM  | |  Plugin  |
           |   (Neon) | | API  | | Registry |
           +---------+ +------+ +----+-----+
                                      |
                               Manifest Validation
                               Sandbox Enforcement
                               Rules Engine
                               Moderation API
```

**Three layers:** Frontend (vanilla JS chat + plugin iframes) → Backend (Express, JWT, PostgreSQL, Vercel AI SDK) → Plugin System (independent React/Vite apps in sandboxed iframes, postMessage-only communication).

See [architecture-diagram.html](./architecture-diagram.html) for the full interactive diagram.

---

## Plugin System

### Iframe Sandbox

```
allow-scripts       ✅  Plugin JS runs
allow-popups        ✅  OAuth flows only
────────────────────────────────────
allow-top-navigation  ❌  Can't navigate parent
allow-forms           ❌  Can't POST externally
allow-same-origin     ❌  Can't access cookies/storage
allow-modals          ❌  Can't show alert/confirm
```

### postMessage Bridge Protocol

```
Platform → Plugin:  PLUGIN_INIT, TOOL_INVOKE, THEME_UPDATE, PLUGIN_DESTROY
Plugin → Platform:  PLUGIN_READY, TOOL_RESULT, STATE_UPDATE, PLUGIN_COMPLETE, PLUGIN_RESIZE
```

Every message validated: `event.isTrusted` check, origin verification, type validation. Plugins never see auth tokens, chat history, or other plugins.

### Tool-Calling Pipeline

1. User message → Claude via `streamText()` with tool definitions from enabled plugins
2. Claude returns `tool-call` → server parses namespaced tool name (`pluginId__toolName`)
3. Server emits `plugin:invoke` via Socket.io to frontend
4. Frontend creates sandboxed iframe → `/plugins/{pluginId}/`
5. Plugin sends `PLUGIN_READY` → platform sends `TOOL_INVOKE`
6. Plugin renders interactive UI, student interacts, results flow back to AI

---

## Admin Infrastructure

### App Registry
- Third-party developers submit plugin manifests for review
- Admin can **approve** (plugin registered + enabled) or **reject** (with reason)
- Nothing goes live without admin approval
- Manifest schema validation with Zod

### App Moderation
- **8 platform rules:** Age-Appropriate Content, Data Privacy, No Ads, Educational Value, Accessibility, Performance, Sandbox Compliance, Offline Degradation
- **Instant removal:** One-click plugin removal with violation logging
- **Violation history:** Full audit trail with timestamps and reasons

---

## Security & Guardrails

| Threat | Mitigation |
|--------|------------|
| Inappropriate content | Sandbox + admin moderation + instant removal |
| Student data access | Sandbox blocks cookies/storage; bridge sends only tool params |
| XSS injection | Iframe isolation + HTML escaping + origin verification |
| Malicious manifest | Zod schema rejects invalid manifests at registration |
| Non-compliant app | 8 platform rules + violation tracking + one-click removal |
| Disabled plugin invoked | Filtered from tool definitions — AI never sees it |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server | Express.js, Node.js, TypeScript |
| Real-time | Socket.io |
| Database | PostgreSQL (Neon, connection pooling, max 20) |
| Auth | JWT + bcrypt (12 rounds) |
| LLM | Vercel AI SDK v6 (Claude Sonnet) |
| Plugin Apps | React 18 + Vite (5 independent apps) |
| Plugin Comm | postMessage bridge (iframe sandbox) |
| Validation | Zod schemas (all server inputs) |
| Deployment | Railway |

---

## Running Locally

```bash
# Clone and install
git clone https://github.com/meghamegs-lab/chatweave.git
cd chatweave && pnpm install

# Build all plugins
for dir in plugins/chess plugins/math-quest plugins/word-lab plugins/money-sense plugins/fact-or-fiction; do
  cd $dir && npm install && npm run build && cd ../..
done

# Configure server
cp server/.env.example server/.env
# Edit with your API keys, JWT secrets, and DATABASE_URL

# Start
cd server && pnpm dev

# Open http://localhost:3001
# Register → New Chat → Click any learning app or type "I want to practice math!"
```

---

## Deployment

Deployed on [Railway](https://railway.app):

```bash
railway login
railway link    # Link to your project
railway up      # Deploy
```

**Live URL:** [https://chatweave.up.railway.app](https://chatweave.up.railway.app)

---

## Project Structure

```
chatweave/
├── server/                    # Express backend
│   ├── src/
│   │   ├── db/                # PostgreSQL schema + queries
│   │   ├── routes/            # Auth, chat, plugins, moderation
│   │   ├── services/          # LLM, socket, plugin registry
│   │   └── types/             # Zod schemas
│   └── public/                # Web chat UI (vanilla JS)
├── plugins/
│   ├── chess/                 # Chess learning game
│   ├── math-quest/            # Math practice
│   ├── word-lab/              # Vocabulary & spelling
│   ├── money-sense/           # Financial literacy
│   ├── fact-or-fiction/        # Media literacy
│   └── sdk/                   # Plugin SDK (postMessage bridge)
├── src/renderer/              # Electron React frontend (optional)
├── architecture-diagram.html  # Interactive architecture diagram
├── COST-ANALYSIS.md           # Infrastructure cost projections
├── GOLDEN-EVALS.md            # Test evaluation suite
└── DEMO-SCRIPT.md             # Demo walkthrough
```

## License

[LICENSE](./LICENSE)
