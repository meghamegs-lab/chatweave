# ChatWeave Demo Script

## Opening (30 seconds)

"ChatWeave is an AI-powered learning platform where educational apps live inside the chat. Students don't switch tabs — they interact with chess, math, vocabulary, financial literacy, and media literacy tools right in the conversation. The AI decides when to launch an app based on intent. An admin layer enforces platform rules and can instantly remove non-compliant apps — critical when your users are kids."

---

## What We Built on Open Source (45 seconds)

| Inherited | Built |
|-----------|-------|
| Express + JWT auth + PostgreSQL | Plugin registry, manifest validation, sandboxed iframes |
| LLM chat streaming | Tool-calling pipeline — AI invokes plugins by intent |
| Socket.io real-time | postMessage bridge protocol for plugin lifecycle |
| User/session management | App Registry (submission + approval workflow) |
| REST API routing | App Moderation (rules engine, violation tracking, instant removal) |

We extended — not forked. Core chat is untouched; the plugin system layers on top.

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
           | PostgreSQL | | LLM  | |  Plugin  |
           |   DB   | | API  | | Registry |
           +--------+ +------+ +----+-----+
                                     |
                              Manifest Validation
                              Sandbox Enforcement
                              Rules Engine
                              Moderation API
```

**Three layers:** Frontend (React + plugin iframes) → Backend (Express, JWT, PostgreSQL, Vercel AI SDK) → Plugin System (independent React/Vite apps in sandboxed iframes, postMessage-only communication).

---

## The 5 Learning Apps

| App | Domain | Key Features |
|-----|--------|-------------|
| **Chess** | Logic & Strategy | AI opponent, 3 difficulty levels, FEN board state, move history |
| **Math Quest** | STEM / Numeracy | 6 topics, adaptive difficulty, SVG manipulatives, level-up system |
| **Word Lab** | Literacy / Language | 4 modes (spelling/vocabulary/phonics/word-building), 52+ words, mastery tracking |
| **Money Sense** | Financial Literacy | Counting, making change, budgeting, virtual store, savings simulator |
| **Fact or Fiction** | Media Literacy | Fake news detection, source ranking, bias spotting, debate builder |

Each is a standalone React app communicating through the postMessage bridge. The AI decides which to launch based on student intent — no hardcoded triggers.

---

## Demo Flow (5 minutes)

### 1. Login (30 seconds)

- Open ChatWeave → Register (Student/Teacher role)
- JWT access token (1h) + HttpOnly refresh cookie (7d)
- Green "Connected" badge = authenticated WebSocket

### 2. Plugin in Action (2 minutes)

- New Chat → Type: **"I want to practice multiplication"**
- Watch the AI trigger `math-quest__start_math_quest` with `{topic: "multiplication", difficulty: "beginner"}`
- **Under the hood:**
  1. Message → Claude via `streamText()` with tool definitions from enabled plugins
  2. Claude returns `tool-call` → server parses namespaced tool name
  3. Frontend creates sandboxed iframe → `/plugins/math-quest/`
  4. Plugin sends `PLUGIN_READY` → platform sends `TOOL_INVOKE`
  5. Math Quest renders, student solves problems, results flow back to AI
- Try: **"Let's play chess"** → Chess plugin launches
- Try: **"Help me learn new words"** → Word Lab launches
- Try: **"Teach me about money"** → Money Sense launches
- Try: **"How do I spot fake news?"** → Fact or Fiction launches

### 3. App Registry (1 minute)

- Settings → **App Registry**
- Show "Register New App" flow: name, ID, description, URL, tools JSON
- Submission goes to **pending review** queue
- Admin can **Approve** (plugin registered + enabled) or **Reject** (with reason)
- "Third-party developers submit apps. Nothing goes live without admin approval."

### 4. App Moderation — Instant Removal (1 minute 30 seconds)

- Settings → **App Moderation**
- Show the **8 platform rules**: Age-Appropriate Content, Data Privacy, No Ads, Educational Value, Accessibility, Performance, Sandbox Compliance, Offline Degradation
- Pick any plugin → click **"Remove Now"**
  - Select rule violated, enter reason
  - Plugin is **immediately deleted** from registry + database
  - Violation logged with timestamp and reason
  - All active sessions using that plugin are terminated
- "With 2 million student users, we can't wait for a review cycle. If an app violates rules, it's gone in one click."
- Show **Violation History** log

---

## Security & Guardrails

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

Manifest schema enforces this — plugins can only request `allow-scripts` and `allow-popups`. Anything else is rejected at registration.

### postMessage Bridge — Narrow Channel

```
Platform → Plugin:  PLUGIN_INIT, TOOL_INVOKE, THEME_UPDATE, PLUGIN_DESTROY
Plugin → Platform:  PLUGIN_READY, TOOL_RESULT, STATE_UPDATE, PLUGIN_COMPLETE, PLUGIN_RESIZE
```

Every incoming message validated: `event.isTrusted` check, origin verification, type validation. Plugins never see auth tokens, chat history, or other plugins.

### Guardrails Summary

| Threat | Mitigation |
|--------|------------|
| Inappropriate content | Sandbox + admin moderation + instant removal |
| Student data access | Sandbox blocks cookies/storage; bridge sends only tool params |
| XSS injection | Iframe isolation + HTML escaping + origin verification |
| Malicious manifest | Zod schema rejects invalid manifests at registration |
| Non-compliant app | 8 platform rules + violation tracking + one-click removal |
| Disabled plugin invoked | Filtered from tool definitions — AI never sees it |

---

## Scalability: Path to 2M Users

**Current stack:** PostgreSQL + Express + Socket.io. Already migrated from PostgreSQL to PostgreSQL with connection pooling (20 connections). Remaining scale targets:

| Challenge | Fix |
|-----------|-----|
| **Single process** | PM2 cluster (4-8 workers) + NGINX |
| **Socket.io at scale** | Redis adapter + horizontal sharding |
| **Plugin assets** | CDN (CloudFront/Cloudflare) |

Priority: **Cluster mode → Redis → CDN**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server | Express.js, Node.js |
| Real-time | Socket.io |
| Database | PostgreSQL (pg, connection pooling) |
| Auth | JWT + bcrypt (12 rounds) |
| LLM | Vercel AI SDK v6 (Claude) |
| Plugin Apps | React 18 + Vite (5 independent apps) |
| Plugin Comm | postMessage bridge (iframe sandbox) |
| Validation | Zod schemas (all server inputs) |
| Language | TypeScript throughout |

---

## Running the Project

```bash
# Install and build
cd chatweave && pnpm install

# Build all plugins
for dir in plugins/chess plugins/math-quest plugins/word-lab plugins/money-sense plugins/fact-or-fiction; do
  cd $dir && npm install && npm run build && cd ../..
done

# Configure server
cp server/.env.example server/.env
# Edit with API keys and JWT secrets

# Start
cd server && pnpm dev

# Open http://localhost:3001
# Register → New Chat → "Let's practice math!"
```
