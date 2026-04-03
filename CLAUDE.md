# Claude Workflow Template

A 6-stage pipeline that transforms raw requirements into sprint-ready code — 4 planning stages + 2 implementation stages (multi-agent orchestration + story execution).

---

## How It Works

When user pastes ANY requirement:

1. Automatically run `/presearch {{args}}` → writes PRESEARCH.md (with requirement summary)
2. Auto-proceed → `/prd` → writes PRD.md (with golden evals embedded + deliberation if `--dual-review`)
3. **Pause** → `/architecture` — user makes 4 design decisions (+ deliberation if `--dual-review`) → writes ARCHITECTURE.md
4. Auto-proceed → `/stories` → writes STORIES.md + CHECKLIST.md + API-CONTRACTS.md (if multi-service)
5. **Pause** → `/orchestrate` — user reviews execution plan → builds dependency graph, parallel batches
6. On 'proceed', run `/implement` — coder/reviewer/tester subagents execute each batch in parallel worktrees

**Only 2 interaction points** in a full pipeline run: architecture decisions (Stage 3) and orchestration plan review (Stage 5). Stages 1-2 and 4 run continuously. Use `--interactive` to restore pause-at-every-stage behavior.

After implementation, use `/review`, `/verify`, `/test`, `/audit`, `/retro`, `/docs`, `/progress` throughout development.

---

## Pipeline Commands (Stages 1–6)

| Stage | Command | Reads | Produces |
|-------|---------|-------|----------|
| 1 | `/presearch [topic]` | — | PRESEARCH.md (with requirement summary) |
| 2 | `/prd [topic]` | PRESEARCH.md | PRD.md (with golden evals) |
| 3 | `/architecture [topic]` | ↑ + PRD.md | ARCHITECTURE.md |
| 4 | `/stories [topic]` | ↑ + ARCHITECTURE.md | STORIES.md, CHECKLIST.md, API-CONTRACTS.md |
| 5 | `/orchestrate [epic\|all]` | All artifacts above | Dependency graph, parallel batches, execution plan |
| 6 | `/implement` | Orchestration plan + all artifacts | Working code in `src/` via parallel subagents |

`/implement [story]` can also be used standalone for executing a single story sequentially outside the pipeline. Flags: `--all`, `--dry-run`, `--no-test`, `--no-verify`, `--tdd`.

### Stages 5–6: Multi-Agent Architecture

```
orchestrator (Sonnet) — reads STORIES.md, builds dependency graph, dispatches batches
    │                      reads .claude/model-config.yaml for model routing
    │
    ├── coder (configurable via model-config.yaml, default: Opus) — implements story code in isolated worktree
    │         supports BDD (default) and TDD (--tdd) modes
    ├── reviewer (configurable, default: Sonnet) — reviews diff against .claude/rules.md + CHECKLIST.md
    └── tester (configurable, default: Haiku) — runs tests, coverage analysis, gap detection
```

### Git Strategy

```
main
 └── epic/<slug>           ← created from main on first story
      ├── story/<slug-a>   ← worktree, merges into epic after review+test
      ├── story/<slug-b>   ← worktree, parallel with story-a
      └── story/<slug-c>   ← worktree, parallel with story-b
```

Stories branch from epics. Stories rebase onto epic then fast-forward merge (sequential within batch). Epics squash-merge into main. Merge conflicts are auto-resolved by coder subagent (1 attempt) before escalating to user.

### Execution Flow

1. Orchestrator checks for previous state file (crash recovery) — offers resume or fresh start
2. Groups stories into parallel batches (max 3 concurrent), initializes state file
3. Each batch: coder subagents run in parallel worktrees
4. On coder completion: **diff gate** checks for out-of-scope file modifications and cross-story file overlaps
5. On diff gate pass: reviewer + tester run in parallel per story
6. On pass: **sequential merge** — rebase story onto epic, then fast-forward merge
7. On merge conflict: **auto-resolve** via coder subagent (1 attempt) → user escalation if unresolvable
8. On review/test fail: **auto-retry once** with feedback, then **auto-skip** and continue (no user prompt)
9. Batch checkpoint between groups — **post-batch reflection** surfaces patterns from reports, proposes updates to planning artifacts
10. User confirms learnings (apply/skip) and proceeds to next batch
11. After all epics: full verification on epic branch before merge to main, state file cleaned up

## Development Commands

| Command | Description |
|---------|-------------|
| `/review [file]` | Review code against .claude/rules.md + CHECKLIST.md rules |
| `/progress [epic]` | Track story/checklist completion with codebase evidence |
| `/verify` | Pre-commit verification (type check, lint, format, tests, secrets scan) |
| `/test [scope]` | Test suite management (run all, coverage, gap analysis, security/perf variants) |
| `/audit [scope]` | Pre-milestone audit (architecture compliance, rule violations, story completion, security, debt) |
| `/learn "[insight]"` | Capture learning → route to appropriate artifact |
| `/cost [scope]` | Token usage and cost estimates per stage, story, and batch |
| `/dashboard` | Generate interactive React dashboard from PIPELINE-STATUS.json |
| `/retro [scope]` | Post-milestone retrospective with actionable improvements |
| `/docs [type]` | Generate docs (diagrams, README, API docs, setup/deploy guides, changelog) |
| `/deploy [sub]` | Generate deployment artifacts (CI/CD configs, Dockerfile, docker-compose, runbook) |

## Pipeline Modes

Multiple entry points for different project types:

| Scenario | Command | Stages | Best For |
|----------|---------|--------|----------|
| **New project** | `/pipeline [topic]` | All 6 stages | Greenfield development |
| **New project (TDD)** | `/pipeline [topic] --tdd` | All 6 stages, test-first | High-reliability systems, APIs with contracts |
| **New project (reviewed)** | `/pipeline [topic] --dual-review` | All 6 stages + dual-model deliberation on PRD & Architecture | High-stakes projects needing cross-model validation |
| **New project (by layer)** | `/pipeline [topic] --by-layer` | All 6 stages, layer batching | Multi-service or full-stack projects |
| **New feature** | `/pipeline [topic] --fast` | Presearch → Architecture → Stories → Orchestrate | Known features, adding to existing codebase |
| **Bug fix / refactor** | `/implement [description]` | Direct implementation | Small changes, no planning needed |

### Fast-track mode (`--fast`)

Runs 4 stages with `--quick` and `--auto` flags. Skips requirement-summary, PRD, checklist, and claude-md-rules (uses existing .claude/rules.md if present). Orchestrate plan review is always interactive.

### Range mode

- `/pipeline [topic] --from=architecture` — Resume pipeline from a specific stage
- `/pipeline [topic] --from=checklist --to=stories` — Run a range of stages
- `/pipeline [topic] --dry-run` — Show what would run without executing

## Skills

All skills live in `.claude/skills/` and are re-runnable with refinement flags:

| Skill | Purpose | Key Flags |
|-------|---------|-----------|
| `presearch` | Interactive research with one-question-at-a-time loop + requirement summary | `--quick`, `--deep`, `--refine` |
| `prd` | Full product requirements document with personas, features, acceptance criteria, golden evals | Interactive review loop, `--dual-review`, `--auto` |
| `architecture` | System design with 4 interactive tradeoff decisions + Mermaid diagrams | Interactive decisions, `--dual-review`, `--auto` |
| `stories` | Sprint-ready stories + implementation checklists + API contracts (merged stage) | `--export-csv` for Jira/Linear |
| `claude-md-rules` | Generate coding rules in .claude/rules.md | `--merge` to preserve custom rules |
| `pipeline` | Pipeline router — chains stages with correct flags, supports full/fast-track/range modes | `--fast`, `--from=stage`, `--to=stage`, `--dry-run`, `--tdd`, `--by-layer`, `--dual-review`, `--docs-first` |
| `orchestrator` | Multi-agent parallel implementation with dependency-aware batching, crash recovery, diff gate | `--dry-run`, `--sequential`, `--max-parallel=N`, `--resume`, `--fresh`, `--by-layer`, `--tdd` |
| `implement` | Write actual code files for a single story (BDD default, TDD optional) | `--all`, `--dry-run`, `--no-test`, `--tdd` |
| `impl-commands` | 11 utility commands for the development phase | See commands table above |

## Model Strategy

Default model assignments (overridable via `.claude/model-config.yaml`):

| Phase | Default Model | Thinking | Rationale |
|-------|---------------|----------|-----------|
| Planning (Stages 1–4) | **Opus 4.6** | Extended thinking enabled | Deep reasoning for research, architecture decisions, story decomposition |
| Orchestrator (Stage 5) | Sonnet | Standard | Dependency graph and batch planning — structured, not creative |
| Coder (Stage 6) | Opus | Standard | Complex code generation in isolated worktrees |
| Reviewer (Stage 6) | Sonnet | Standard | Rule-based diff review — pattern matching |
| Tester (Stage 6) | Haiku | Standard | Test execution and coverage — fast feedback |

**Model routing:** The orchestrator reads `.claude/model-config.yaml` (if present) to route different models to different stories based on layer (frontend/backend/etc.), complexity (story points), or service. Fallback chains ensure resilience if a model is unavailable. See `.claude/model-config.yaml` for configuration options.

**Launch command:** `claude --model opus` (or `claude --model opus --effort max` for deepest reasoning). Each planning skill includes a `## Thinking Mode` directive that instructs the model to use its full thinking budget for deep analysis. Alternatively, `claude --model opusplan` uses Opus for planning and automatically switches to Sonnet for execution.

## Deliberation (Dual-Model Review)

When `--dual-review` is set (or `deliberation.enabled: true` in `.claude/model-config.yaml`), PRD and Architecture stages get a single-pass critique from a second model (default: GPT-5.x, fallback: Gemini 2.5 Pro). The primary model (Opus) generates the artifact, the reviewer critiques it with a structured format (missing requirements, security gaps, scalability risks, contradictions), then Opus auto-incorporates Critical/High items and logs the full deliberation record as an appendix. One review pass only — no back-and-forth debate. Configurable via `.claude/model-config.yaml` deliberation section.

## Development Modes

Two development approaches, toggled via `--tdd` flag:

| | BDD (default) | TDD (`--tdd`) |
|---|---|---|
| **Flow** | Stories → Code → Tests → Verify | Stories → Tests (red) → Code (green) → Refactor |
| **Best for** | Feature-driven work, MVPs, rapid prototyping | High-reliability systems, APIs with contracts |
| **Command** | `/implement S004` | `/implement S004 --tdd` |

BDD is the default — no flag needed. TDD is opt-in at any level: `/pipeline [topic] --tdd`, `/orchestrate --tdd`, or `/implement S004 --tdd`.

## Layer Tracks

Stories include a `Layer` field (frontend, backend, shared, infra, database) and optional `Service` field for multi-service architectures. The orchestrator uses these for:

- **`--by-layer` batching:** Groups stories by technical track (infra → database → shared → backend → frontend) instead of dependency-only ordering
- **Model routing:** `.claude/model-config.yaml` can assign different models per layer (e.g., Sonnet for frontend, Opus for backend)

## Subagents

Defined in `.claude/subagents/`:

| Subagent | Default Model | Role |
|----------|---------------|------|
| `coder` | Opus (configurable) | Implements story code in isolated worktree. Supports BDD and TDD modes. Also resolves merge conflicts (1 attempt). Autonomous — no user interaction. |
| `reviewer` | Sonnet (configurable) | Reviews git diff against .claude/rules.md and CHECKLIST.md. Read-only. |
| `tester` | Haiku (configurable) | Runs tests, coverage analysis, and gap detection. Read-only on source files. |

## Hooks (settings.json)

- **PostToolUse (write|edit):** Auto-formats with Prettier after every file edit
- **PostToolUse (implement):** Auto-runs `npm test` after Implement stage

## Artifacts Produced

```
project/
├── PRESEARCH.md            # Research findings + requirement summary
├── PRD.md                  # Product requirements document + golden evals (embedded)
├── ARCHITECTURE.md         # System architecture + decisions log
├── CHECKLIST.md            # Implementation checklists (cross-reference view from stories)
├── API-CONTRACTS.md        # (multi-service only) Contract-first API definitions
├── STORIES.md              # Sprint-ready user stories with embedded checklists
├── STORIES-EXPORT.csv      # (optional) For Jira/Linear import
├── PIPELINE-CONTEXT.md     # Context handoffs across stages (decisions, rationale, preferences)
├── PIPELINE-COST.md        # Token usage and cost estimates per stage and story
├── PIPELINE-STATUS.json    # Structured status data (dashboard data source)
├── dashboard.jsx           # Interactive dashboard (generated by /dashboard)
├── CLAUDE.md               # Pipeline config (this file, never modified by pipeline)
├── .claude/
│   ├── model-config.yaml   # (optional) Model routing for subagents
│   ├── knowledge/          # Shared learning memory (patterns, pitfalls, decisions, stack tips)
│   ├── scripts/
│   │   └── llm-router.py   # Multi-provider LLM adapter (Gemini, OpenAI, Anthropic)
│   ├── skills/             # Pipeline skill definitions
│   └── subagents/          # Subagent prompts (coder, reviewer, tester)
└── src/                    # Actual implementation code
```
