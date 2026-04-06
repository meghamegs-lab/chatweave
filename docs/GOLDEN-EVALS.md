# ChatWeave Golden Evals

Evaluation suite for **new features only** — the plugin system, learning apps, admin infrastructure, and UI additions built on top of the inherited ChatBridge platform. Does not test auth, basic chat, Socket.io, or REST routing (those are ChatBridge baseline).

---

## Eval Categories

| Category | Feature Area | Eval Count |
|----------|-------------|------------|
| E1 | Tool-Calling Pipeline | 8 |
| E2 | postMessage Bridge Protocol | 7 |
| E3 | Iframe Sandbox Security | 5 |
| E4 | App Registry (Submission + Approval) | 6 |
| E5 | App Moderation (Rules + Removal) | 6 |
| E6 | App Discovery UI | 5 |
| E7 | Chess Learning Game | 6 |
| E8 | Math Quest Adventure | 5 |
| E9 | Word Lab | 5 |
| E10 | Money Sense | 5 |
| E11 | Fact or Fiction | 5 |
| E12 | System Prompt & AI Behavior | 5 |
| **Total** | | **68** |

---

## E1: Tool-Calling Pipeline

The AI decides which plugin to launch based on user intent, and the tool-call flows through the server to the frontend iframe.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E1.1 | Tool names are namespaced | Enable chess plugin, call `buildToolsForSession()` | Tools object contains key `chess-game__start_chess_game` | Key format is `{pluginId}__{toolName}` |
| E1.2 | Parse namespaced tool name | `parseToolName('math-quest__start_math_quest')` | `{ pluginId: 'math-quest', toolName: 'start_math_quest' }` | Correct split on `__` |
| E1.3 | Disabled plugins excluded | Disable chess plugin, call `buildToolsForSession()` | No `chess-game__*` keys in returned tools | Disabled plugins filtered out |
| E1.4 | Tool call triggers plugin:invoke | User says "Let's play chess", AI returns tool call | Server emits `plugin:invoke` event via Socket.io with `pluginId: 'chess-game'` | Socket event emitted with correct pluginId and args |
| E1.5 | Plugin parameters forwarded | AI calls `start_chess_game` with `{ color: 'black', difficulty: 'hard' }` | `TOOL_INVOKE` message contains same parameters | Parameters passed through unchanged |
| E1.6 | Tool result flows back to AI | Plugin sends `TOOL_RESULT` with game state | Server receives result, AI can reference game state in next response | Round-trip completion |
| E1.7 | Multiple tool calls in session | User asks for math, then chess in same session | Both plugins launch sequentially, each gets correct tool invocation | Independent plugin lifecycle per tool call |
| E1.8 | Invalid tool name handled | Tool call with name `nonexistent__fake_tool` | Server logs error, no crash, user sees graceful message | No unhandled exception |

---

## E2: postMessage Bridge Protocol

Communication between the platform (parent window) and plugin iframes via `window.postMessage`.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E2.1 | Plugin sends PLUGIN_READY on load | Load chess plugin iframe | Parent receives `{ type: 'PLUGIN_READY', payload: { version: '1.0.0' } }` | Message received with correct type and version |
| E2.2 | Platform sends PLUGIN_INIT | Plugin iframe loads | Plugin receives `{ type: 'PLUGIN_INIT', payload: { theme, locale, sessionId } }` | Init message sent before tool invoke |
| E2.3 | TOOL_INVOKE delivered after READY | Plugin sends READY, platform has pending tool call | Plugin receives `{ type: 'TOOL_INVOKE', payload: { toolName, parameters } }` | Correct sequencing: INIT → READY → INVOKE |
| E2.4 | STATE_UPDATE received by platform | Chess plugin: player makes a move | Parent receives `{ type: 'STATE_UPDATE', payload: { state: { fen, moveCount }, summary } }` | State update contains FEN and move count |
| E2.5 | PLUGIN_COMPLETE on game end | Chess game reaches checkmate | Parent receives `{ type: 'PLUGIN_COMPLETE', payload: { event: 'game_finished', data: { winner, pgn } } }` | Complete event with game results |
| E2.6 | PLUGIN_RESIZE adjusts iframe | Plugin sends `PLUGIN_RESIZE` with height: 600 | Iframe container adjusts to 600px height | Iframe dimensions update |
| E2.7 | THEME_UPDATE propagated | User toggles dark mode | Plugin receives `{ type: 'THEME_UPDATE', payload: { theme: 'dark' } }` and updates styles | Plugin re-renders with dark theme |

---

## E3: Iframe Sandbox Security

Plugins run in sandboxed iframes with restricted permissions.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E3.1 | Scripts execute in sandbox | Plugin contains JavaScript game logic | JS runs normally inside iframe | `allow-scripts` permission works |
| E3.2 | Top navigation blocked | Plugin tries `window.top.location = 'https://evil.com'` | Navigation blocked by browser | Sandbox prevents parent navigation |
| E3.3 | Cookie/storage access blocked | Plugin tries `document.cookie` or `localStorage.setItem()` | Access denied (SecurityError) | `allow-same-origin` NOT present |
| E3.4 | Form submission blocked | Plugin contains `<form action="https://external.com">` and submits | Submission blocked | `allow-forms` NOT present |
| E3.5 | Modal dialogs blocked | Plugin calls `alert()`, `confirm()`, or `prompt()` | Dialog blocked | `allow-modals` NOT present |

---

## E4: App Registry (Submission + Approval)

Third-party developers submit plugin manifests; admins approve or reject.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E4.1 | Valid manifest accepted | POST `/api/plugins/register` with valid manifest (name, version, tools, permissions) | 201 Created, plugin in pending state | Plugin stored with `status: 'pending'` |
| E4.2 | Invalid manifest rejected | POST `/api/plugins/register` missing required `tools` field | 400 Bad Request with Zod validation error | Error message identifies missing field |
| E4.3 | Admin approves plugin | PUT `/api/plugins/:id/approve` with admin JWT | Plugin status → `enabled`, tools available in `buildToolsForSession()` | Plugin appears in enabled tools |
| E4.4 | Admin rejects plugin | PUT `/api/plugins/:id/reject` with reason | Plugin status → `rejected`, reason stored | Rejection reason persisted |
| E4.5 | Non-admin cannot approve | PUT `/api/plugins/:id/approve` with regular user JWT | 403 Forbidden | Admin-only endpoint enforced |
| E4.6 | Duplicate plugin name rejected | Register two plugins with same `id` | Second registration returns 409 Conflict | Unique constraint enforced |

---

## E5: App Moderation (Rules + Removal)

Platform rules enforcement, violation tracking, and instant removal.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E5.1 | List platform rules | GET `/api/moderation/rules` | Returns 8 rules: Age-Appropriate, Data Privacy, No Ads, Educational Value, Accessibility, Performance, Sandbox Compliance, Offline Degradation | All 8 rules present with descriptions |
| E5.2 | Report violation | POST `/api/moderation/violations` with pluginId, ruleId, details | Violation created with timestamp | Violation stored in audit trail |
| E5.3 | Instant plugin removal | POST `/api/moderation/plugins/:id/remove` with reason | Plugin disabled immediately, removed from `buildToolsForSession()` | AI can no longer invoke the plugin |
| E5.4 | Violation history retrieved | GET `/api/moderation/plugins/:id/violations` | Returns all violations for plugin with timestamps and reasons | Full audit trail accessible |
| E5.5 | Removed plugin filtered from AI | Remove chess plugin, user says "Let's play chess" | AI does NOT call `chess-game__start_chess_game`, responds with text instead | Disabled plugin absent from tool definitions |
| E5.6 | Removal logged | Remove plugin with reason "Inappropriate content" | Violation log contains removal event with admin, reason, timestamp | Audit trail includes removal action |

---

## E6: App Discovery UI

Welcome screen showing available learning apps with click-to-launch.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E6.1 | Discovery loads on welcome | New user, no active session | Welcome screen shows 5 app cards with emojis and descriptions | All 5 apps visible in correct order |
| E6.2 | Card order correct | Load welcome screen | Cards appear: Chess, Money Sense, Fact or Fiction, Math Quest, Word Lab | Order matches `displayOrder` array |
| E6.3 | Click creates session and sends prompt | Click "Chess" card | New session created, message "I want to play chess!" sent, AI launches chess plugin | Full flow: click → session → message → plugin |
| E6.4 | Only enabled plugins shown | Disable Money Sense plugin | Discovery shows 4 cards, Money Sense absent | Disabled plugins filtered from discovery |
| E6.5 | Discovery hidden during active chat | User has active session with messages | Discovery grid not visible, chat messages shown instead | UI state transitions correctly |

---

## E7: Chess Learning Game

Interactive chess with AI opponent, difficulty levels, and game lifecycle.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E7.1 | Game starts with correct color | Tool invoke: `{ color: 'white', difficulty: 'medium' }` | Board renders with white on bottom, player moves first | Board orientation matches player color |
| E7.2 | AI moves as black | Player (white) makes opening move e4 | AI responds with a legal move within 1 second | AI move is legal, board updates |
| E7.3 | Invalid move rejected | Drag pawn backwards | Move rejected, "Invalid move!" error shown briefly | Error displays and clears after 2 seconds |
| E7.4 | Checkmate detected | Reach checkmate position | "Checkmate! You win!" / "AI wins!" displayed, `PLUGIN_COMPLETE` sent | Game over state, correct winner identified |
| E7.5 | Play Again resets board | Click "Play Again" after game ends | New game starts with same color and difficulty, fresh board | Board reset, move count = 0 |
| E7.6 | Difficulty affects AI behavior | Play on 'easy' vs 'hard' | Easy: random moves. Hard: prioritizes captures and checks | Observable difference in AI play strength |

---

## E8: Math Quest Adventure

Adaptive math practice across 6 topics with visual manipulatives.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E8.1 | Quest starts with topic | Tool invoke: `{ topic: 'multiplication', difficulty: 'medium' }` | Math problem displayed for multiplication at medium level | Correct topic and difficulty |
| E8.2 | Correct answer advances | Submit correct answer to math problem | "Correct!" feedback, next problem loads, progress increments | Score increases, new problem generated |
| E8.3 | Wrong answer provides help | Submit incorrect answer | Hint or explanation shown, same problem remains | Educational feedback, no penalty advancement |
| E8.4 | SVG manipulatives render | Fraction problem displayed | Visual fraction bars or shapes rendered as SVG | SVG elements present in DOM |
| E8.5 | Level-up system works | Complete series of correct answers | Difficulty increases, "Level Up!" notification | Adaptive difficulty progression |

---

## E9: Word Lab

Vocabulary, spelling, phonics, and word-building across 4 modes.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E9.1 | Mode selection works | Tool invoke: `{ mode: 'spelling' }` | Spelling challenge displayed with word to spell | Correct mode activated |
| E9.2 | Spelling check validates | Type correct spelling of prompted word | "Correct!" feedback, mastery progress updates | Case-insensitive match, progress tracked |
| E9.3 | Vocabulary mode shows definitions | Select vocabulary mode | Word with definition prompt, multiple choice or fill-in | Definition-based challenge |
| E9.4 | Phonics mode has audio cue | Select phonics mode | Phonics challenge with visual letter-sound mapping | Phonics-specific UI elements |
| E9.5 | Mastery tracking persists | Complete 5 words correctly across sessions | Mastery count reflects cumulative progress | 52+ word pool, tracked completion |

---

## E10: Money Sense

Financial literacy: counting money, making change, budgeting, shopping, saving.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E10.1 | Lesson starts with topic | Tool invoke: `{ topic: 'counting_money' }` | Coin/bill counting exercise displayed | Correct financial literacy topic |
| E10.2 | Making change exercise | Select "making change" topic | Given price and payment, calculate correct change | Interactive change calculation |
| E10.3 | Virtual store works | Select shopping/budgeting topic | Items with prices, budget constraint, purchase decisions | Budget tracking, item selection |
| E10.4 | Savings simulator runs | Select saving topic | Interest calculation, goal tracking over time | Savings growth visualization |
| E10.5 | Correct answer feedback | Submit correct money amount | Positive feedback, advance to next challenge | Progress through financial concepts |

---

## E11: Fact or Fiction

Media literacy: fake news detection, source evaluation, bias spotting.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E11.1 | Challenge starts | Tool invoke: `{ mode: 'fake_news' }` | News headline displayed, "Fact or Fiction?" prompt | Challenge UI with headline |
| E11.2 | Correct identification rewarded | Correctly identify fake headline | "Correct!" with explanation of why it's fake | Educational explanation provided |
| E11.3 | Source ranking works | Select source evaluation mode | List of sources to rank by reliability | Ranking interface functional |
| E11.4 | Bias detection exercise | Select bias spotting mode | Article excerpt with bias indicators to identify | Bias-specific challenge UI |
| E11.5 | Debate builder works | Select debate mode | Structured argument building with evidence | Argument construction interface |

---

## E12: System Prompt & AI Behavior

The AI correctly identifies student intent and launches appropriate plugins.

| ID | Test | Input | Expected Output | Pass Criteria |
|----|------|-------|----------------|---------------|
| E12.1 | Math intent → Math Quest | "I want to practice multiplication" | AI calls `math-quest__start_math_quest` with topic: multiplication | Tool call made, not just text response |
| E12.2 | Chess intent → Chess Game | "Can we play a game of chess?" | AI calls `chess-game__start_chess_game` | Tool call made with default parameters |
| E12.3 | Money intent → Money Sense | "Teach me about saving money" | AI calls `money-sense__start_money_lesson` | Tool call made, correct topic |
| E12.4 | Ambiguous intent → text response | "What's the capital of France?" | AI responds with text, does NOT launch any plugin | No tool call for non-app topics |
| E12.5 | Multiple intents prioritized | "I want to learn about money and then play chess" | AI launches Money Sense first (or acknowledges both) | At least one tool call, sensible prioritization |

---

## Running Evals

### Manual Testing
Each eval can be tested manually through the web UI at `https://chatweave.up.railway.app`:

1. **E1-E3**: Requires browser DevTools → Network/Console tab to inspect postMessage events and Socket.io frames
2. **E4-E5**: Use `curl` or Postman against REST API endpoints with admin JWT
3. **E6**: Visual inspection of welcome screen
4. **E7-E11**: Interactive testing through chat — type the intent, verify plugin launches and behaves correctly
5. **E12**: Type various prompts and verify AI chooses correct tool (or no tool)

### Automated Testing (Future)
```bash
# Unit tests for tool-calling pipeline
npm test -- --grep "buildToolsForSession"
npm test -- --grep "parseToolName"

# Integration tests for plugin lifecycle
npm test -- --grep "plugin:invoke"

# E2E tests with Playwright
npx playwright test tests/e2e/plugin-bridge.spec.ts
npx playwright test tests/e2e/app-discovery.spec.ts
npx playwright test tests/e2e/chess-game.spec.ts
```

---

## Pass Rates

| Status | Meaning |
|--------|---------|
| PASS | Expected output matches actual output |
| FAIL | Expected output does not match |
| SKIP | Feature not yet implemented or blocked |
| FLAKY | Passes intermittently (usually AI non-determinism in E12) |

**Target:** 100% pass rate on E1-E6 (deterministic platform features), 90%+ on E7-E11 (plugin apps), 80%+ on E12 (AI behavior is non-deterministic).

---

*68 golden evals covering all new ChatWeave features. ChatBridge baseline features (auth, chat streaming, Socket.io, REST routing, user management) are excluded per brownfield scope.*
