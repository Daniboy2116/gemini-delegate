---
name: gemini-delegate
description: "Delegate an edit/implementation task (run) or a research/analysis/report task (report) to Gemini through Google's Antigravity CLI (agy), on an isolated copy of the project — no git required. Default model: Gemini 4 Hydrogen high (best tested option for web research and well-specified code); Gemini 4 Neon high for terminal/agentic and harder reasoning. Covers which Gemini model and effort level to pick, parallel runs, diff review and merge, quota, and the security limits of agy. Never against a production or live system."
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs *)
---

# gemini-delegate

Delegates work to Gemini (Antigravity CLI, the user's Google quota — no Claude tokens) on an isolated copy of the project, in the background, without needing git. Claude reviews the result before accepting it — same pattern as any subagent: self-contained prompt, runs in the background, result reviewed before trusting it.

Requirements: Node.js 18+, git (used only for `git diff --no-index`, the project does not need to be a repo), and the Antigravity CLI (`agy`) installed and signed in. The script finds `agy` via `--agy <path>`, the `AGY_PATH` environment variable, the default Windows install location (`%LOCALAPPDATA%\agy\bin\agy.exe`), or `agy` on `PATH`.

## When to delegate (as of 2026-11-19)

### Gemini vs Claude on the same scale

Artificial Analysis Intelligence Index v5.0.1 (checked 2026-11-16, Neon 2026-11-19, on artificialanalysis.ai/models/<id>):

| Model | low | medium | high | xhigh | max |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 19 | 25 | 30 | 35 | 36 |
| Claude Sonnet 5.5 | 26 | 31 | 42 | 50 | 55 |
| Claude Opus 5.5 | 35 | 48 | 52 | 57 | 59 |
| Claude Fable 5.2 | — | — | 62 | 62 | 65 |
| **Gemini 4 Neon** (new 2026-11-18) | 44 | 55 | **60** | 61 | — |
| **Gemini 4 Hydrogen** | 27 | 41 | **51** | 54 | — |
| Gemini 4 Argon | no data | 48 | 50 | — | — |
| Gemini 4 Carbon (Ultra only) | — | — | 60 | — | — |
| Gemini 3.8 Flash | 23 | 30 | 31 | — | — |

What this means for routing:
- **Hydrogen high (51) beats every Haiku level and Sonnet up to high, and roughly equals Sonnet xhigh and Opus high.** Any task you'd give a Haiku or Sonnet subagent, or a cold Opus-high subagent, goes to Hydrogen high first if it can be fully specified in the prompt.
- **Hydrogen medium (41) still beats Haiku max (36)** and costs about half as much as Hydrogen high: use it for mechanical or extraction work where you'd have used Haiku.
- **Neon high (60) beats Opus xhigh (57) and roughly equals Opus max (59)** at zero Claude cost, so it replaces Hydrogen xhigh as the retry step and covers much of what used to stay in Claude. Neon xhigh (61) adds 1 point for 2.3× the output tokens: almost never worth it.
- **Neon low (44, $0.75/task) beats Hydrogen medium (41, $0.80)**: use it for mechanical work. **Neon medium (55, $1.90) costs the same per task as Hydrogen high (51, $1.87) on AA**, but measured here it used ~1.5× Hydrogen's quota (Neon's per-token price is 2× Hydrogen's: $3/$15 vs $1.50/$7.50 per 1M), so Hydrogen high stays the default for well-specified work.
- **What Claude still does better:** anything above index ~61 (Fable), anything that needs this conversation, and terminal work Neon high failed. Terminal-Bench 4.1 (tbench.ai/leaderboard, checked 2026-11-19): Opus 5.5 max 65.8%, Fable 5.2 max 65.8%, Carbon high 64.5%, Sonnet 5.5 max 63.9% (all Claude rows in the Claude Code harness), Hydrogen high 56.4%, Argon high 55.5% (Antigravity CLI), Haiku 5.5 max 40.0%. Neon is not on tbench.ai yet; Google reports 65.2% (effort not stated). AA's own Terminal-Bench 4.0 run (same harness for all): Neon xhigh 63.6%, **Neon high 61.6%**, Opus 5.5 max/xhigh 59.6%, Opus high 56.6%, Hydrogen high 54.0%, Neon medium 54.5%, Neon low 32.8%.
- **Hallucination** (AA-Omniscience, checked 2026-11-16/19): Argon high 4%, Carbon medium 4%, Hydrogen xhigh 8%, Carbon high 11%, Neon high 14% (as cited by eesel.ai from AA; AA's page doesn't show it yet), Opus 5.5 max 50%. Neon guesses more than Hydrogen/Argon, so it is not the research model.

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

**Measured 2026-11-19, Gemini 4 Neon** (agy 1.5.9, `run`, hidden tests). Test 3 rebuilt with the same kind of quirks (2 buggy modules, gzip, CRLF, `s`/`ms`, timezones, malformed lines, CLI graded on an unseen dataset); Test 4: spreadsheet engine from a spec (formulas, precedence, ranges, MIN/MAX/AVG, error propagation order, cycle detection, recalculation; 60 hidden tests):

| Model in agy | Test 3 | Test 4 | Test 4 time · tokens |
|---|---|---|---|
| `gemini-4-neon-low` | — | 60/60 | 234 s · 62K |
| `gemini-4-neon-medium` | visible + hidden exact (618 s · 63K) | 60/60 | 418 s · 127K |
| `gemini-4-neon-high` | visible + hidden exact | 60/60 | 604 s · 172K |
| `gemini-4-neon-xhigh` | visible + hidden exact | — | — |
| `gemini-pro-orchestrator-neon` | visible + hidden exact | — | — |
| `gemini-4-hydrogen-high` | — | 60/60 | 401 s · 166K |

Quality was again a tie at every level, so these tasks don't show where Neon pulls ahead (use the benchmarks for that). What they do show is cost: **Neon low solved the 60-test spec with ~⅓ of Hydrogen high's tokens**; Neon high used about the same tokens as Hydrogen high, which at Neon's 2× price means ~2× the quota (assuming Antigravity weights quota like API price; Google publishes no per-model figure). The Test 3 runs for high/xhigh/Orchestrator ended with a network error *after* the work was done (launch day plus a local DNS outage), so their times aren't comparable.

Routing between them:
1. Well-specified code/scripts/UI/research → **Hydrogen high** (Gemini pool). Mechanical → **Neon low**.
2. Terminal-heavy / multi-step agentic, or reasoning Hydrogen failed → **Neon high** (Gemini pool).
3. Gemini pool exhausted, or Neon high failed on terminal work → **`claude-sonnet-5-5-high`** in agy, then `claude-opus-5-5-high`.
4. Needs Fable, this conversation's context, or failed everywhere above → Claude Code itself.
- **Argon is not smarter than Hydrogen** (50 vs 51/54) and takes ~29 min per task, costing ~2.7× as much. Pick it only for what it measurably does better (below). Argon medium gives no time saving over high (28.7 vs 29.4 min), so use high. Argon low has no data, and an independent test saw it produce no reasoning tokens, so avoid it.

### Decision table

| Work | First choice | If it fails / not suitable |
|---|---|---|
| Web research, source gathering | agy `report`, Hydrogen high | Claude verifies the URLs and figures (WebFetch or a Haiku subagent); redo in Claude only the parts that failed |
| Well-specified edit, script, UI | agy `run`, Hydrogen high | Neon high → Claude per model-routing |
| Bulk mechanical change, extraction | agy `run`, Neon low | Hydrogen medium/high |
| Long multi-file refactor or feature | agy `run`, Hydrogen high | Neon high → Orchestrator (Neon) only if both lost the plan on a very long task → Claude Opus medium/high |
| Multi-file debugging, hard reasoning, cold above-Opus-high work | agy `run`, Neon high | Claude Opus xhigh / Fable |
| Long context 256K–512K, video, finance, complex legal | Neon high | Argon high (up to 1M; Antigravity caps Neon at 512K) → Claude Opus high with sources |
| "Must not hallucinate" | Argon high (4%) | Claude Opus high with sources |
| Long agentic terminal work (services, many chained commands) | agy Neon high on a local copy | agy `claude-sonnet-5-5-high` → Claude Code Opus high/xhigh |
| Gemini pool exhausted | agy `claude-sonnet-5-5-high` | Claude Code |
| Depends on this conversation, design decisions, code review of the delegated diff | Claude | — |

**Yes:**
- **Web research and reports** → `report` with Hydrogen high (default). In a 10-question test with known answers, Hydrogen in auto mode got 10/10 with 8/8 real URLs, versus ~5/10 for Claude Haiku 5.5. Takes 5–17 min and ~150K tokens per run. Still verify key figures. **Seen 2026-11-16 (agy 1.5.9):** agy's own pre-tool security hook blocked Hydrogen's URL-resolving script, so it returned only grounded summaries with `vertexaisearch` redirect links and no verified URLs (7.5 min, ~190K tokens). When that happens, treat its figures as leads and verify them from the primary pages in Claude.
- Scoped edits, scripts, UI/frontend → `run` with Hydrogen high; bulk mechanical work → Neon low.
- Terminal/agentic work, multi-file debugging, reasoning Hydrogen failed → `run` with Neon high.
- Multimodal (audio/video), long documents, finance/tax, legal → Neon high (GraphWalks 256K–1M 95.2% per Google, LVBench 89%); Argon high only for the lowest hallucination rate or context above Antigravity's 512K Neon cap.
- Large multi-file refactors without spending Claude quota → Hydrogen high; Neon high if Hydrogen loses the plan; Orchestrator only as a last resort (it cost ~4× the quota with Argon).
- Any part that can run in parallel: launch several runs at once.

**No — keep it in Claude:**
- Anything that depends on the current conversation's context: Gemini starts cold.
- Work that already failed on Neon high, or that needs Fable-level reasoning.
- **Not Hydrogen for long agentic terminal work** (Terminal-Bench 4.1: 56% vs ~64–66%): use Neon high there.

**Never:**
- Gemini 3.8 Flash for research (fabricates URLs). Flash is only a fallback if Hydrogen is unavailable.
- Against a production or live system (a running server, any real deploy) — only against a local copy.
- Merging without reading the full diff (for `run`).
- Git commits or pushes through agy: Claude does those directly (agy was seen mangling non-ASCII characters in a commit message).

## Models in agy (`agy models`, CLI v1.5.12, 2026-11-19)

Always pass `--model <id>` explicitly. List what your plan offers with `agy models`; if an id is missing, use the next row down.

| id | Use | Quota |
|---|---|---|
| `gemini-4-hydrogen-high` | **Default.** Research, scoped code, UI | Gemini pool |
| `gemini-4-neon-high` | Terminal/agentic work, multi-file debugging, reasoning Hydrogen failed, long context (Antigravity caps it at 512K), multimodal, finance/legal. ~2× Hydrogen's per-token price | Gemini pool |
| `gemini-4-neon-low` | Mechanical/extraction work (beats Hydrogen medium on AA at lower cost). Never for terminal work (32.8%) | Gemini pool |
| `gemini-4-neon-medium` | Rarely: better than Hydrogen high on AA at the same $/task, but measured ~1.5× its quota | Gemini pool |
| `gemini-4-neon-xhigh` | Almost never: +1 index point over high for 2.3× the output tokens, and where its cache bug hurts most | Gemini pool |
| `gemini-4-hydrogen-medium` / `-low` | Fallback for mechanical work if Neon is unavailable (low scores 6.6% on terminal tasks) | Gemini pool |
| `gemini-4-hydrogen-xhigh` | Superseded by Neon high as the retry step. Fails with `THINKING_LEVEL_XHIGH` 400 on some accounts since 2026-11-17 | Gemini pool |
| `gemini-pro-orchestrator-neon` ("Orchestrator (Neon)") | Neon plans read-only, Hydrogen executes, Neon re-plans after 2 failed verifications and reviews progress on long tasks. No published benchmark. Measured here: exact result on Test 3. Fails on some accounts with `THINKING_LEVEL_XHIGH` 400 (issue #1609); switch to Neon high. Only for very long tasks where Hydrogen and Neon alone lose the plan. Fixed effort | Gemini pool |
| `gemini-4-argon-high` | Lowest hallucination (4%), context above 512K. Neon beats it on everything else and is 2× faster. Slow (~30 min per task) | Gemini pool, limited |
| `gemini-4-argon-medium` / `-low` | Avoid: medium is 2 points below high at the same speed; low has no data and may not reason at all | Gemini pool, limited |
| `gemini-pro-orchestrator-g1-pro` ("Orchestrator (Argon)") | Superseded by Orchestrator (Neon). Argon plans read-only, Hydrogen executes, Argon re-plans after 2 failed verifications. Not a default. Google's "near-Carbon success, 24% less quota, 19% faster" (Terminal-Bench 4.1) compares against **Carbon**. It doesn't say which variant was tested, and it publishes no figure for Orchestrator (Argon). tbench.ai has no Orchestrator entry. Measured here: same result as Hydrogen alone on a terminal task, but 2.5× slower and 3.8× the tokens (337K vs 88K). Use it only for very long tasks where Hydrogen alone loses the plan. Fixed effort (`--effort` doesn't apply) | Gemini pool, limited |
| `claude-sonnet-5-5-{low,medium,high}`, `claude-opus-5-5-{low,medium,high}` | When the Gemini pool is empty, or terminal work Neon high failed, without spending Claude Code quota. Max effort is high. See "Claude inside agy" | "Claude and GPT" pool, limited |
| `gemini-3.8-flash-*` | Fallback only; never for research | Gemini pool |
| `gpt-oss-120b-medium` | Never (AA index ~4). Removed from Antigravity on 2026-11-18 | "Claude and GPT" pool |

Plan availability (antigravity.google/docs/models, checked 2026-11-19): **Free/Plus: only Gemini 3.8 Flash** (Claude 4.6 and GPT-OSS were removed 2026-11-18). Hydrogen and Claude 5.5: paid non-trial Pro, Ultra (Hydrogen also Enterprise). Neon, Argon, Orchestrator (Neon), Orchestrator (Argon): paid Pro or Pro trial on eligible premium devices, and Ultra (Neon and Argon also Enterprise). Carbon and Orchestrator (Carbon): Ultra (Carbon also Enterprise).

The user's plan is stored in `~/.claude/gemini-delegate.json` and injected by the SessionStart hook with plan-specific substitutions. Read or change it with `node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs plan [--set free|pro-trial|pro|ultra]`. If the hook says the plan is unknown, ask the user once (AskUserQuestion) and save it before delegating.

### Effort levels

Start at **high** with Hydrogen (its default; medium drops from 51 to 41 on the AA index). For mechanical work use Neon low instead of lowering Hydrogen. When Hydrogen high fails, go to Neon high rather than Hydrogen xhigh.

Artificial Analysis Intelligence Index v5.0.1 (2026-11-13; Neon 2026-11-19) — index · $ per task · Terminal-Bench 4.0:

| Model | low | medium | high | xhigh |
|---|---|---|---|---|
| Neon | 44 · $0.75 · 32.8% | 55 · $1.90 · 54.5% | **60 · $3.74 · 61.6%** | 61 · $6.44 · 63.6% |
| Hydrogen | 27 · $0.29 · 6.6% | 41 · $0.80 · 29.3% | **51 · $1.87 · 54.0%** | 54 · $3.16 · 53.5% |
| Argon | no data | 48 · — · — | **50 · $4.97 · 57.1%** | — |
| 3.8 Flash | 23 · — | 30 · $6.26 | 31 · $7.77 · 19.1% | — |

Argon vs Hydrogen: Argon hallucinates about half as much (4.3% vs 8.7% on AA-Omniscience) and is better at 256K–1M context (GraphWalks 84.2%), video (LVBench 91.7%) and complex legal work; Hydrogen is 2.7× faster and 62% cheaper at the same index. Against Claude: see "Gemini vs Claude on the same scale" above.

Neon (Google model card, effort not stated; AA rows above are independent): GraphWalks 256K–1M 95.2% (Opus 5.5 66.8%), LVBench 89.0%, CursorBench 4.1 65.4%, FrontierCode 2.0 46.2% (Opus 47.3%), SWE-sweep 39.0% in Antigravity's harness but 12.8% in mini-SWE (the harness matters). Time per AA task: low 3.7, medium 8.3, high 14.8, xhigh 21.5 min (Hydrogen high 8.6). Limits: 512K context in Antigravity (1M in the API), 64K synchronous output, knowledge cutoff March 2026.

### Known issues (as of 2026-11-19)

- **Neon/Carbon prompt cache drops after ~25–30 s between turns** (antigravity-cli #1665, #1664): with >30 s gaps Neon hit the cache 34% of the time vs Hydrogen 91%, re-billing the whole context each miss; one user measured ~2.5× weekly quota burn, worst above ~200K context and on xhigh. Keep Neon runs short or context small; Hydrogen is safer for long, slow sessions.
- **`THINKING_LEVEL_XHIGH` 400** on all Orchestrators and Hydrogen xhigh for some accounts since 2026-11-17 (#1609, #1616), server-side; Neon high still works there.
- **Degraded answers since 2026-11-15/17** reported mostly by Ultra users with subscription sign-in (near-zero thinking, false "done" claims; same model via API key works). Google hasn't responded. Grade every result on tests or the diff, never on agy's summary.
- **Network errors on long runs** (`There was a network issue connecting to the server`): the work in the copy may already be complete; grade the copy before retrying.
- `invoke_subagent` `Model: "pro"` inside agy resolves to Hydrogen, not Neon (#1652).

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
