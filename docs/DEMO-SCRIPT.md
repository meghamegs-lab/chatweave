# ChatWeave — 5-Minute Demo Script

---

## 0:00–0:30 | What Is ChatWeave

"ChatWeave is an AI chat platform where third-party educational apps live inside the conversation. Students say 'let's play chess' and a chess board appears — right in chat. The AI decides which app to launch, stays aware of what's happening inside it, and resumes the conversation when the app finishes. Teachers control which apps are available. Everything runs in sandboxed iframes — critical when your users are children."

"Built on top of the open-source Chatbox project. We kept the core chat and layered on: a plugin registry, a tool-calling pipeline, a postMessage bridge protocol, three auth patterns, and a moderation system."

---

## 0:30–1:30 | High-Level Architecture

```
  Browser
  ┌─────────────────────────────┐
  │  Chat UI (React)            │
  │  ┌────────┐ ┌────────┐     │   postMessage only
  │  │ Plugin │ │ Plugin │ ... │   (sandboxed iframes)
  │  └────────┘ └────────┘     │
  └──────────┬──────────────────┘
             │ Socket.io (WSS) + REST (HTTPS)
  ┌──────────┴──────────────────┐
  │     Express.js Server       │
  │  ┌──────────────────────┐   │
  │  │ LLM Service          │   │ ← Vercel AI SDK v6 (Claude/OpenAI)
  │  │ Tool Router          │   │ ← dynamic tool schemas from registry
  │  │ Plugin Registry      │   │ ← manifest validation (Zod)
  │  │ Moderation Engine    │   │ ← 8 rules, violations, instant removal
  │  │ Auth (JWT + OAuth)   │   │ ← 3 auth patterns
  │  └──────────────────────┘   │
  │  SQLite (better-sqlite3)    │ ← users, sessions, messages, plugins, violations
  └─────────────────────────────┘
```

"Three layers. **Frontend**: React chat UI with plugin iframes — each plugin is its own React/Vite app in a sandboxed iframe. **Backend**: Express server handling auth, chat streaming, tool routing, and moderation. **Plugin system**: 7 standalone apps communicating exclusively through postMessage. No shared state, no DOM access, no cookie access."

"The AI sees registered plugins as tool definitions. When a student's message matches a tool, the LLM immediately calls it — no follow-up questions, just launches the app with smart defaults. The server emits `plugin:invoke` via Socket.io. The frontend creates the iframe, sends `TOOL_INVOKE` via postMessage, the plugin does its thing, sends `TOOL_RESULT` back up the chain, and the LLM continues the conversation with full context of what happened inside the app."

---

## 1:30–3:00 | Live Demo — 7 Apps, 3 Auth Patterns

### Login (15s)
- Open https://chatweave.up.railway.app
- Register as student. JWT access token (1hr) + HttpOnly refresh cookie (7d).
- Notice: a **waiting bubble** (animated dots) appears while the LLM processes each message.

### Internal Apps — No Auth (45s)
- **"Let's play chess"** → Chess board appears instantly (AI picks difficulty + color, no questions asked)
- Play a few moves → **"What should I do here?"** → AI analyzes board state via `get_board_state` tool
- **"Help me with fractions"** → Math Quest launches with topic=fractions
- Quick switch: **"Let's practice spelling"** → Word Lab launches in same conversation
- "5 internal apps — Chess, Math Quest, Word Lab, Money Sense, Fact or Fiction. All `auth_type: none`. AI routes by intent and launches immediately with smart defaults."

### API Key App — Server-Side Proxy (15s)
- **"Quiz me on astronomy"** → Science Quiz launches
- "This app has `auth_type: api_key`. Questions route through `/api/proxy/trivia` — the API key is stored server-side, never exposed to the plugin iframe. The plugin has no idea what the key is."

### OAuth App — User Authorization (30s)
- **"Help me create a study plan for math"** → Study Planner launches
- Show "Connect with Google" screen — **note it shows "Connected as Teacher" or "Connected as Student" based on your actual login role**
- Click "Connect with Google" → **Google-style account picker popup** appears with demo accounts (Ms. Teacher, Alex Student, Jamie Parent)
- Select an account → spinner shows "Signing in..." → redirects to OAuth callback → popup closes automatically
- "This app has `auth_type: oauth2`. The manifest declares Google's auth URL, token URL, and scopes. The platform handles the OAuth popup, exchanges the code for tokens, stores them server-side, and passes credentials to the plugin via the backend — never through the iframe."
- After connecting: study plan appears with weekly sessions, milestones, progress tracking
- The tool result flows back to the LLM, which responds with a brief summary of the created plan

### Context Retention (15s)
- After chess game ends → **"How did I do?"**
- AI remembers the game result because completion data was injected as a system message
- "Completion signaling feeds plugin results back into the LLM context. Tool interactions are saved to conversation history so the AI stays aware across app boundaries — even across multiple messages."

---

## 3:00–3:30 | App Registry + Moderation

### Registry (15s)
- Settings → App Registry → "Register New App"
- "Third-party developers submit a manifest — name, tools, iframe URL. It goes into a pending queue. Nothing is live until an admin approves it."

### Moderation (15s)
- Settings → App Moderation → Show 8 platform rules
- Pick any plugin → "Remove Now" → select violated rule → gone instantly
- "One click. Plugin deleted from registry, violation logged, active sessions terminated. When 200,000 students are using this daily, you can't wait for a review cycle."

---

## 3:30–4:15 | Security Flow

```
  Plugin iframe sandbox:
    allow-scripts       YES   (JS runs)
    allow-popups        YES   (OAuth popups)
    allow-same-origin   YES   (required for postMessage bridge)
    allow-forms         NO    (can't POST externally)
    allow-top-navigation NO   (can't redirect parent)
```

"Every plugin message is validated: origin verification ensures it's from the registered iframe URL, type validation rejects malformed payloads. Plugins never see auth tokens, chat history, or other plugins' data. The postMessage bridge is the only communication channel — plugins can't access parent DOM, cookies, or localStorage."

| Threat | Mitigation |
|--------|------------|
| Malicious app content | Iframe sandbox + 8 moderation rules + instant removal |
| Student data exfiltration | Bridge sends only tool params; plugins can't access parent storage |
| XSS / DOM injection | Iframe isolation + origin verification + Zod manifest validation |
| API key exposure | Server-side proxy — keys in env vars, never sent to client |
| Brute force auth | bcrypt-12 passwords, JWT expiry, CORS restricted to platform origin |
| Hung/crashed plugin | 30s tool call timeout + `plugin:error` handler marks instance as errored |
| Stalled LLM response | Multi-step tool loop capped at 5 steps (`stopWhen: stepCountIs(5)`) |

---

## 4:15–4:45 | Architecture at Scale (200K+ DAU)

"The case study says 200,000+ daily users across 10,000 districts. That's ~30,000 concurrent at peak school hours. Here's the production path:"

```
  CDN (Cloudflare)           ← plugin static assets, zero origin hits
       │
  WAF + DDoS Protection      ← rate limiting (50 msg/student/day), bot detection
       │
  Load Balancer (ALB/nginx)  ← sticky sessions for Socket.io, health checks
       │
  ┌────┴────┬────────┬───────────┐
  │ Express │Express │ Express   │  ← 8-12 instances, auto-scaling
  │ Node 1  │Node 2  │ Node N    │
  └────┬────┴───┬────┴─────┬─────┘
       │        │          │
  Redis Cluster             │      ← Socket.io adapter (pub/sub across instances)
  (session cache +          │        + BullMQ job queue for async LLM requests
   rate limiting)           │
       │                    │
  PostgreSQL + PgBouncer           ← replaces SQLite; 200+ app connections
  (read replicas, sharded          over 20 DB connections; shard by district
   by district)
```

| Scale metric | Target |
|---|---|
| DAU | 200K+ (10K districts) |
| Peak concurrent | 30K (~15% DAU) |
| Messages/day | 4-6M |
| Plugin launches/day | 600K-1M |
| Estimated cost | ~$26K/mo (with model tiering) |

---

## 4:45–5:00 | Trade-Offs

| Decision | Trade-off | Why |
|----------|-----------|-----|
| **SQLite now, PostgreSQL later** | Not horizontally scalable today | Zero ops cost for MVP; migration path is clean (same query API wrapper) |
| **Iframe sandbox** over Web Components | Higher memory per plugin, no shared styling | Strongest isolation for K-12 safety — worth the overhead |
| **postMessage** over direct API | Higher latency per message (~2ms) | Prevents plugins from accessing parent DOM, cookies, or chat data |
| **LLM-based routing** over keyword matching | Higher cost per message (~$0.002) | Handles ambiguous queries ("help me learn") that keyword matching can't |
| **Immediate tool calling** over conversational clarification | May use suboptimal defaults | Faster UX for kids; LLM picks smart defaults and launches instantly |
| **Single Express process** (current) | Can't scale past ~500 concurrent | Sufficient for demo; cluster mode + Redis is a config change, not a rewrite |
| **Synchronous plugin loading** | Plugins block on iframe load | Simpler lifecycle; async lazy-loading is a future optimization |
| **Demo OAuth with simulated Google picker** | Not production-ready for real Google API | Platform OAuth infrastructure is complete — popup flow, callback handling, token storage all work; only needs a real Google client_id/secret for production |

---

## Closing Line

"ChatWeave: 7 educational apps, 3 auth patterns, sandboxed iframes, AI-powered routing with instant tool calling, real-time streaming with waiting indicators, full OAuth flow simulation, and instant moderation — deployed and live at chatweave.up.railway.app."
