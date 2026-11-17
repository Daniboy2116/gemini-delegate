---
name: gemini-delegate
description: "Delegate an edit/implementation task (run) or a research/analysis/report task (report) to Gemini through Google's Antigravity CLI (agy), on an isolated copy of the project — no git required. Default model: Gemini 4 Hydrogen high (Flash's successor; best tested option for web research). Covers which Gemini model and effort level to pick, parallel runs, diff review and merge, quota, and the security limits of agy. Never against a production or live system."
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs *)
---

# gemini-delegate

Delegates work to Gemini (Antigravity CLI, the user's Google quota — no Claude tokens) on an isolated copy of the project, in the background, without needing git. Claude reviews the result before accepting it — same pattern as any subagent: self-contained prompt, runs in the background, result reviewed before trusting it.

Requirements: Node.js 18+, git (used only for `git diff --no-index`, the project does not need to be a repo), and the Antigravity CLI (`agy`) installed and signed in. The script finds `agy` via `--agy <path>`, the `AGY_PATH` environment variable, the default Windows install location (`%LOCALAPPDATA%\agy\bin\agy.exe`), or `agy` on `PATH`.

## When to delegate (as of 2026-11-16)

### Gemini vs Claude on the same scale

Artificial Analysis Intelligence Index v5.0.1 (checked 2026-11-16 on artificialanalysis.ai/models/<id>):

| Model | low | medium | high | xhigh | max |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 19 | 25 | 30 | 35 | 36 |
| Claude Sonnet 5.5 | 26 | 31 | 42 | 50 | 55 |
| Claude Opus 5.5 | 35 | 48 | 52 | 57 | 59 |
| Claude Fable 5.2 | — | — | 62 | 62 | 65 |
| **Gemini 4 Hydrogen** | 27 | 41 | **51** | 54 | — |
| Gemini 4 Argon | no data | 48 | 50 | — | — |
| Gemini 4 Carbon (Ultra only) | — | — | 60 | — | — |
| Gemini 3.8 Flash | 23 | 30 | 31 | — | — |

What this means for routing:
- **Hydrogen high (51) beats every Haiku level and Sonnet up to high, and roughly equals Sonnet xhigh and Opus high.** Any task you'd give a Haiku or Sonnet subagent, or a cold Opus-high subagent, goes to Hydrogen high first if it can be fully specified in the prompt.
- **Hydrogen medium (41) still beats Haiku max (36)** and costs about half as much as Hydrogen high: use it for mechanical or extraction work where you'd have used Haiku.
- **Hydrogen xhigh (54) sits between Opus high and Opus xhigh**: a retry level before you spend Opus xhigh on cold, well-specified reasoning.
- **What Claude still does better:** terminal/agentic work, anything above index ~55 (Opus xhigh/max, Fable), and anything that needs this conversation. Terminal-Bench 4.1 (tbench.ai/leaderboard, checked 2026-11-16): Opus 5.5 max 65.8%, Fable 5.2 max 65.8%, Carbon high 64.5%, Sonnet 5.5 max 63.9% (all Claude rows in the Claude Code harness), Hydrogen high 56.4%, Argon high 55.5% (Antigravity CLI), Haiku 5.5 max 40.0%. Note the Claude figures are at **max**; agy only offers Claude up to high.
- **Hallucination** (AA-Omniscience, checked 2026-11-16): Argon high 4%, Carbon medium 4%, Hydrogen xhigh 8%. AA shows no rate for the Claude 5.5 models.

### Claude inside agy (`claude-sonnet-5-5-*`, `claude-opus-5-5-*`)

Same Anthropic models, but billed to Antigravity's **"Claude and GPT" pool** (separate from the Gemini pool, non-trial paid plans only), so they cost no Claude Code quota. Limits:
- Effort goes only up to **high** (no xhigh/max). Sonnet medium reported 0 thinking tokens.
- That pool is smaller than the Gemini one, and forum users report it draining fast. Spend it where Claude beats Hydrogen, not on work Hydrogen does equally well.
- They run in agy's harness, not Claude Code's: same model, different tools and sandbox. `node` was not on the sandbox PATH; Sonnet high ran it outside the sandbox (auto-approved, see Security), Sonnet medium shipped without running its tests.

**Measured 2026-11-16** (agy 1.5.9, `run`, same prompt, graded on hidden tests the model never saw):

| Model in agy | Test 1: duration parser (45 tests) | Test 2: expression evaluator with error kinds/positions (55 tests) |
|---|---|---|
| `claude-sonnet-5-5-medium` | 45/45 · 42 s · 29K tok | 55/55 · 104 s · 32K tok |
| `claude-sonnet-5-5-high` | 45/45 · 57 s · 34K tok | 55/55 · 126 s · 55K tok |
| `claude-opus-5-5-high` | 45/45 · 130 s · 47K tok | 55/55 · 132 s · 43K tok |
| `gemini-4-hydrogen-high` | 45/45 · 153 s · 83K tok | 55/55 · 149 s · 82K tok |

Test 3, terminal-style (fix 2 buggy modules with failing tests, discover undocumented data quirks — gzip, CRLF, `s` vs `ms` units, timezone offsets, malformed lines — and write a CLI; graded on a second, unseen dataset):

| Model in agy | Result | Time | Tokens |
|---|---|---|---|
| `claude-sonnet-5-5-high` | visible + hidden exact | 91 s | 49K |
| `gemini-4-hydrogen-high` | visible + hidden exact | 195 s | 88K |
| `gemini-pro-orchestrator-g1-pro` (Orchestrator Argon) | visible + hidden exact | 496 s | 337K |
| `gemini-4-argon-high` | visible + hidden exact | 574 s | 112K |

All four solved both well-specified tasks and the terminal task perfectly, so for this kind of work quality is a tie: **pick by quota pool, not model**. Hydrogen uses ~2× the tokens and is slower, but from the larger Gemini pool. These tests don't separate the models on hard debugging or long terminal work. Use the public benchmarks above for that.

Routing between them:
1. Well-specified code/scripts/UI/research → **Hydrogen high** (Gemini pool).
2. Gemini pool exhausted, or the task is terminal-heavy / multi-step agentic and you want to save Claude Code quota → **`claude-sonnet-5-5-high`** in agy, then `claude-opus-5-5-high`.
3. Needs Claude above high (xhigh/max/Fable), this conversation's context, or the Claude Code harness → Claude Code itself.
- **Argon is not smarter than Hydrogen** (50 vs 51/54) and takes ~29 min per task, costing ~2.7× as much. Pick it only for what it measurably does better (below). Argon medium gives no time saving over high (28.7 vs 29.4 min), so use high. Argon low has no data, and an independent test saw it produce no reasoning tokens, so avoid it.

### Decision table

| Work | First choice | If it fails / not suitable |
|---|---|---|
| Web research, source gathering | agy `report`, Hydrogen high | Claude verifies the URLs and figures (WebFetch or a Haiku subagent); redo in Claude only the parts that failed |
| Well-specified edit, script, UI, bulk mechanical change | agy `run`, Hydrogen high (medium if mechanical) | Hydrogen xhigh → Claude per model-routing |
| Long multi-file refactor or feature | agy `run`, Hydrogen high | Orchestrator (Argon) only if Hydrogen lost the plan on a very long task → Claude Opus medium/high |
| Long context 256K–1M, video, complex legal, "must not hallucinate" | Argon high | Claude Opus high with sources |
| Long agentic terminal work (services, many chained commands) | agy `claude-sonnet-5-5-high` (Claude model, Antigravity quota) on a local copy | Claude Code Opus high/xhigh if it needs more than high effort or fails |
| Gemini pool exhausted | agy `claude-sonnet-5-5-high` | Claude Code |
| Depends on this conversation, design decisions, code review of the delegated diff | Claude | — |
| Hard bug, subtle logic, above-Opus-high reasoning | Claude Opus xhigh / Fable | — |

**Yes:**
- **Web research and reports** → `report` with Hydrogen high (default). In a 10-question test with known answers, Hydrogen in auto mode got 10/10 with 8/8 real URLs, versus ~5/10 for Claude Haiku 5.5. Takes 5–17 min and ~150K tokens per run. Still verify key figures. **Seen 2026-11-16 (agy 1.5.9):** agy's own pre-tool security hook blocked Hydrogen's URL-resolving script, so it returned only grounded summaries with `vertexaisearch` redirect links and no verified URLs (7.5 min, ~190K tokens). When that happens, treat its figures as leads and verify them from the primary pages in Claude.
- Scoped edits, scripts, well-specified bulk/mechanical work, UI/frontend → `run` with Hydrogen.
- Multimodal (audio/video), very long documents, finance/tax → Hydrogen high; Argon high when you need 256K–1M context, the lowest hallucination rate, or complex legal work.
- Large multi-file refactors without spending Claude quota → Hydrogen high; Orchestrator (Argon) only if Hydrogen loses the plan (it costs ~4× the quota).
- Any part that can run in parallel: launch several runs at once.

**No — keep it in Claude:**
- **Long agentic terminal work** (chaining tools, starting services) — not on Hydrogen, which trails Claude there (Terminal-Bench 4.1: 56% vs ~64–66%). Use a Claude model: agy's `claude-sonnet-5-5-high` to save Claude Code quota, or Claude Code when it needs more than high effort.
- Anything that depends on the current conversation's context: Gemini starts cold.

**Never:**
- Gemini 3.8 Flash for research (fabricates URLs). Flash is only a fallback if Hydrogen is unavailable.
- Against a production or live system (a running server, any real deploy) — only against a local copy.
- Merging without reading the full diff (for `run`).
- Git commits or pushes through agy: Claude does those directly (agy was seen mangling non-ASCII characters in a commit message).

## Models in agy (`agy models`, CLI v1.5.9, 2026-11-16)

Always pass `--model <id>` explicitly. List what your plan offers with `agy models`; if an id is missing, use the next row down.

| id | Use | Quota |
|---|---|---|
| `gemini-4-hydrogen-high` | **Default.** Research, scoped code, UI, multimodal, finance | Gemini pool |
| `gemini-4-hydrogen-medium` / `-low` | Mechanical work only (low scores 6.6% on terminal tasks) | Gemini pool |
| `gemini-4-hydrogen-xhigh` | Only if `high` failed on reasoning. On terminal work it doesn't beat high and costs ~70% more | Gemini pool |
| `gemini-4-argon-high` | 256K–1M context, lowest hallucination, complex legal, video. Slow (~30 min per task) | Gemini pool, limited |
| `gemini-4-argon-medium` / `-low` | Avoid: medium is 2 points below high at the same speed; low has no data and may not reason at all | Gemini pool, limited |
| `gemini-pro-orchestrator-g1-pro` ("Orchestrator (Argon)") | Argon plans read-only, Hydrogen executes, Argon re-plans after 2 failed verifications. Not a default. Google's "near-Carbon success, 24% less quota, 19% faster" (Terminal-Bench 4.1) compares against **Carbon**. It doesn't say which variant was tested, and it publishes no figure for Orchestrator (Argon). tbench.ai has no Orchestrator entry. Measured here: same result as Hydrogen alone on a terminal task, but 2.5× slower and 3.8× the tokens (337K vs 88K). Use it only for very long tasks where Hydrogen alone loses the plan. Fixed effort (`--effort` doesn't apply) | Gemini pool, limited |
| `claude-sonnet-5-5-{low,medium,high}`, `claude-opus-5-5-{low,medium,high}` | Terminal/agentic work, or anything when the Gemini pool is empty, without spending Claude Code quota. Max effort is high. See "Claude inside agy" | "Claude and GPT" pool, limited |
| `gemini-3.8-flash-*` | Fallback only; never for research | Gemini pool |
| `gpt-oss-120b-medium` | Never (AA index ~4). Removed from Antigravity on 2026-11-18 | "Claude and GPT" pool |

Plan availability (Antigravity docs, Nov 2026): Hydrogen and Flash on all plans; Argon and Orchestrator (Argon) on paid Pro and Ultra; Gemini 4 Carbon and Orchestrator (Carbon) on Ultra/Enterprise only; Claude models on non-trial paid plans.

### Effort levels

Start at **high** with Hydrogen (its default; medium drops from 51 to 41 on the AA index). Go down to low only for mechanical work. Go up to xhigh only if high fails.

Artificial Analysis Intelligence Index v5.0.1 (2026-11-13) — index · $ per task · Terminal-Bench 4.0:

| Model | low | medium | high | xhigh |
|---|---|---|---|---|
| Hydrogen | 27 · $0.29 · 6.6% | 41 · $0.80 · 29.3% | **51 · $1.87 · 54.0%** | 54 · $3.16 · 53.5% |
| Argon | no data | 48 · — · — | **50 · $4.97 · 57.1%** | — |
| 3.8 Flash | 23 · — | 30 · $6.26 | 31 · $7.77 · 19.1% | — |

Argon vs Hydrogen: Argon hallucinates about half as much (4.3% vs 8.7% on AA-Omniscience) and is better at 256K–1M context (GraphWalks 84.2%), video (LVBench 91.7%) and complex legal work; Hydrogen is 2.7× faster and 62% cheaper at the same index. Against Claude: see "Gemini vs Claude on the same scale" above.

## Parallel runs

Tested: 3 concurrent `run` tasks without errors or cross-contamination, and 4 concurrent Hydrogen `report` runs (9–27 min each). Each run uses its own `--tag`, and all its state (copy, log, diff) lives under a path unique to that tag. From Claude: several Bash calls in one message, each with `run_in_background: true` and a different `--tag`; review each result as its notification arrives. The concurrency ceiling (Google's rate limit) hasn't been tested beyond 4.

## How to use it

Everything goes through the bundled script. Never call `agy` directly with `--dangerously-skip-permissions` outside this flow.

Script path (always use it exactly like this):

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs
```

Run it with `run_in_background: true` in the Bash tool. For long prompts, write the prompt to a file and pass `--task "$(cat prompt.txt)"`.

### No git needed — how isolation works

The script copies the **current state on disk** (committed or not) into a separate folder under `~/.claude/gemini-delegate-worktrees/` with `fs.cpSync` (skipping `.git`, `node_modules`, `.venv`, `dist`, `build`, etc.), and compares original and copy with `git diff --no-index` — which works on any two folders.

### 1a. Edit something (`run`)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs run \
  --dir "<project folder or subfolder to change>" \
  --task "<clear, scoped description of the task>" \
  --model gemini-4-hydrogen-high --timeout 20m
```

1. Copies the current state of `--dir` to a separate folder
2. Runs `agy` there with `--mode=accept-edits --dangerously-skip-permissions --sandbox`
3. Returns a digest: full diff, changed files, agy's summary and the tripwire

### 1b. Research or analyze (`report`)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs report \
  --dir "<folder to analyze; for pure web research, an empty folder>" \
  --task "<question or request>" \
  --model gemini-4-hydrogen-high --timeout 30m
```

- **Default mode: `auto`.** In `--mode plan`, Hydrogen only writes a plan and asks for approval instead of answering. `--mode plan|accept-edits` remain available.
- No diff or merge; the copy is deleted at the end. The digest has `response` with Gemini's text.
- In `auto`, to get exact URLs Hydrogen downloads pages with its own scripts (likely leaving the sandbox — see Security). So use an empty folder or a copy with nothing sensitive.
- A research prompt that worked: ask for the exact, verified URL for each figure; separate official / independent / third-party sources; "NOT FOUND" instead of inventing; the effort level of each benchmark figure; markdown with tables and a word cap.
- On receipt: check the URLs (`curl -s -o /dev/null -L -w '%{http_code}' <url>`) and spot-check 2–3 key figures by hand.

### 2. When a `run` finishes — review before trusting

Read `diffPath` (the full diff, not just `diffStat`), `agySummary`, `filesChanged` and `tripwire`. If `tripwire` is not empty, treat it as a real alarm. **Don't trust `agySummary.status`** — it was measured reporting `ERROR`/timeout even when the edit was fine; the real signal is the diff.

Minimum check: read the whole diff, run the project's tests/lint against `copyPath` if they exist, and confirm it does what was asked, not just that it "compiles".

### 3a. Good → accept (`merge`)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs merge --tag <tag> --dir <project>
```

Copies back only the changed files (modified and new are copied, deleted are deleted) and removes the copy. If the real project changed while the task ran, conflicting files are skipped instead of overwritten.

### 3b. Not good → discard (`discard`)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs discard --tag <tag>
```

### 4. Orphaned copies (`cleanup`)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs cleanup
```

Also use it after stopping a run halfway. `merge`/`discard` already retry deletion, but if something external locks a file (seen: an IDE language server indexing the same project), `cleanup` retries later — it **never kills processes or forces anything**. It tells "finished, only the deletion failed" apart from "may still be running" (including a task from another Claude session) by the `<tag>.meta.json` file: if it's gone, retrying is safe; if it's still there, the copy is left alone.

## agy quota (antigravity.google/docs/plans and /docs/models, Nov 2026)

- Two pools: **Gemini models** (Hydrogen, Argon, Orchestrator, Flash) and **Claude and GPT models**. Each has a 5-hour window up to a weekly cap; once the weekly cap is spent it doesn't refill until the weekly reset. Google publishes no per-model numbers.
- Usage scales with agent work (steps, tools, re-sent context), not with the number of prompts. A heavy agentic task on a limited model can eat 30–50% of the weekly cap in minutes (user reports).
- Flash used so little that users treated it as unlimited. **Hydrogen's real consumption hasn't been measured yet** — check `/usage` (alias `/quota`) in interactive agy after big runs; it may show stale data until agy restarts.
- Forum report (unofficial): headless `agy -p`, which this script uses, spends ~26% more than interactive mode because of a cold cache.
- When it runs out: wait for the reset, or use AI credits if "AI Credit Overages" is set to Always.

## Security — what this does NOT guarantee

Read this before using it.

- **`.env` and every `.env.*` are never copied** (keys and tokens). Neither is `.env.example`, so the copy filter and the diff/merge filter stay identical. If a task needs environment variables, give example values in the prompt.
- **`--sandbox` contains nothing in practice.** Open issue in `google-antigravity/antigravity-cli` (#36): `--dangerously-skip-permissions` (required headless) also auto-approves the model's own request to leave the sandbox (`bypassSandbox: true`). Seen live: Hydrogen asked for `BypassSandbox: true` to resolve URLs; in `plan` mode it asked, in `auto` it was granted automatically.
- No container or separate OS user — agy runs with the current user's permissions.
- The post-run tripwire is shallow (top level of Desktop, Documents, `.ssh`, `.aws`, plus the file below), not a full disk scan.
- agy also has its own pre-tool security hook that sometimes blocks download scripts; Hydrogen reports it and marks the data as NOT FOUND.
- **The real safety net:** an isolated, disposable copy + Claude reviewing the diff before merge + never pointing this at production. Everything else (`--sandbox`, `--add-dir`, tripwire) is an auxiliary signal, not containment.

### Known agy vulnerability: persistent backdoor via rules files

agy reads `AGENTS.md`, `GEMINI.md` and `.agent/rules/` or `.agents/rules/` from the project as trusted rules. Mindgard documented that a malicious rules file can make the agent write a persistent backdoor into the **global** config (`~/.gemini/antigravity/mcp_config.json`), which runs in every future agy session and survives reinstalling. Google: "Won't Fix — Intended Behavior".

**Mitigated in the script** (tested with a real malicious `AGENTS.md`): `AGENTS.md`, `GEMINI.md`, `.agent/` and `.agents/` are excluded from the copy, and the tripwire watches `~/.gemini/antigravity/mcp_config.json` directly. Also check agy's `trustedWorkspaces` setting: a broad entry (such as your whole home folder) pre-trusts everything.

### Browser policy — read-only unless it's your own app

agy ships browser tools (`browser_click_element`, `open_browser_url`, `browser_input`, `search_web`, `read_url_content`, `capture_browser_screenshot`, etc.) on its own persistent Chromium profile (`~/.gemini/antigravity-browser-profile`). `search_web` returns Google redirect URLs (`vertexaisearch.cloud.google.com/grounding-api-redirect/...`), not the final ones — that's why Hydrogen downloads pages to resolve them.

- **Always allowed:** read-only use — search, read pages, describe, screenshots for analysis.
- **Real interaction (clicks, forms, logged-in flows):** only against pages/apps you develop yourself (a local dev server, your own deployed project). Never third-party sites.
- **Why:** a malicious page could inject instructions to write a rules file and trigger the backdoor above.
