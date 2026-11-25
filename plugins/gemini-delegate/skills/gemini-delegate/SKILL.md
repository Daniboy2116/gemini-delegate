---
name: gemini-delegate
description: "Use BEFORE spawning any Claude subagent, doing web research, or making bulk/mechanical/scoped edits: check whether Gemini (agy) should do it instead, on the user's Google quota. Delegate an edit/implementation task (run) or a research/analysis/report task (report) to Gemini through Google's Antigravity CLI (agy), on an isolated copy of the project — no git required. Default model: Gemini 4 Hydrogen high (best tested option for web research and well-specified code); Gemini 4 Neon high for terminal/agentic and harder reasoning; Gemini 4 Carbon for long terminal sessions and low-hallucination answers. Compares every Gemini model and the Orchestrators against Claude Haiku/Sonnet/Opus/Fable by domain, and says what to send and what to keep. Covers which Gemini model and effort level to pick, parallel runs, diff review and merge, quota, and the security limits of agy. Never against a production or live system."
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/delegate.mjs *)
---

# gemini-delegate

Delegates work to Gemini (Antigravity CLI, the user's Google quota — no Claude tokens) on an isolated copy of the project, in the background, without needing git. Claude reviews the result before accepting it — same pattern as any subagent: self-contained prompt, runs in the background, result reviewed before trusting it.

Requirements: Node.js 18+, git (used only for `git diff --no-index`, the project does not need to be a repo), and the Antigravity CLI (`agy`) installed and signed in. The script finds `agy` via `--agy <path>`, the `AGY_PATH` environment variable, the default Windows install location (`%LOCALAPPDATA%\agy\bin\agy.exe`), or `agy` on `PATH`.

## When to delegate (as of 2026-11-24)

### What changed on 2026-11-23/24

- **Gemini 4 Carbon and Orchestrator (Carbon) are now on paid Google AI Pro** (they were Ultra-only). Ids: `gemini-4-carbon-{low,medium,high}` (no xhigh) and `gemini-pro-orchestrator` = "Orchestrator (Carbon)".
- **Leaving Antigravity on 2026-11-30:** Gemini 4 Argon, Orchestrator (Argon) (`gemini-pro-orchestrator-argon`, formerly `-g1-pro`), Gemini 3.8 Flash, GPT-OSS-120b and Claude 4.6. Their roles move to Carbon medium (low hallucination) and Hydrogen/Neon low (cheap fallback).
- **Hydrogen is now on every plan, Free included** (Free/Plus: Hydrogen, plus Flash until 2026-11-30).
- **Carbon's API price doubles on 2026-12-01** ($2/$10 → $4/$20 per 1M in/out). Since quota is drawn by API price, Carbon gets ~2× more expensive in quota on that date.
- Orchestrator planner/executor and their effort can be chosen in `/model` since CLI 1.5.14 (saved under `"orchestrator"` in agy's `settings.json`); default effort is `high` since 1.5.15, which removed most `THINKING_LEVEL_XHIGH` 400 errors.

### How quota is charged (official)

Antigravity draws one shared Gemini pool **in proportion to each model's API price** (antigravity.google/blog/changes-to-antigravity-plans). Claude/GPT models have their own, smaller fixed pool. Ultra $100 = 5× Pro quota, Ultra $200 = 20×. So AA's $-per-task column is the best available proxy for quota per task:

| Model | API $/1M in / out | AA $/task at high (v5.0.2) | Quota vs Hydrogen high |
|---|---|---|---|
| Hydrogen | 1.50 / 7.50 | $1.87 | 1× |
| Neon | 3 / 15 | $3.74 | ~2× |
| Carbon | 2 / 10 until 2026-11-30, then 4 / 20 | $7.76 | ~4× now, probably ~8× from Dec 1 (if AA priced it at the launch price) |
| Argon (leaving) | 2 / 10 → 4 / 20 | $9.95 | ~5× |

Carbon is cheap per token but spends many tokens (123K output per AA task at high vs Neon 90K) and is the slowest model here (38 min per AA task, ~54 tok/s).

### Gemini vs Claude on the same scale

Artificial Analysis Intelligence Index **v5.0.2** (artificialanalysis.ai, checked 2026-11-24; v5.0.2 swapped Terminal-Bench 4.0 for 4.1):

| Model | low | medium | high | xhigh | max |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 19 | 25 | 30 | 35 | 37 |
| Claude Sonnet 5.5 | 26 | 31 | 41 | 50 | 55 |
| Claude Opus 5.5 | 35 | 48 | 52 | 58 | 59 |
| Claude Fable 5.2 | 54 | 56 | 62 | 62 | 65 |
| **Gemini 4 Carbon** | 54 | 58 | **60** | — | — |
| **Gemini 4 Neon** | 44 | 55 | **60** | 62 | — |
| **Gemini 4 Hydrogen** | 27 | 41 | **51** | 54 | — |
| Gemini 4 Argon (leaving 11-30) | — | 48 | 51 | — | — |
| Gemini 3.8 Flash (leaving 11-30) | 23 | 30 | 31 | — | — |

Per-effort detail — index · AA $/task · minutes/task · AA hallucination rate:

| Model | low | medium | high | xhigh |
|---|---|---|---|---|
| Carbon | 54 · $7.19 · 29 min · 19.8% | **58 · $6.59 · 26 min · 4.2%** | 60 · $7.76 · 38 min · 11.4% | — |
| Neon | 44 · $0.75 · 4 min | 55 · $1.90 · 8 min | **60 · $3.74 · 15 min · 13.9%** | 62 · $6.44 · 26 min · 14.4% |
| Hydrogen | 27 · $0.29 | 41 · $0.80 | **51 · $1.87 · 8 min · 8.7%** | 54 · $3.16 · 16 min · 8.5% |
| Argon | — | 48 | 51 · $9.95 · 23 min · 4.3% | — |

What this means for routing:
- **Hydrogen high (51) ≈ Opus high (52) and beats Sonnet up to high and every Haiku level.** Anything you'd give a Haiku/Sonnet subagent or a cold Opus-high subagent goes to Hydrogen high first if it can be fully specified.
- **Neon high (60) = Carbon high (60) at half the quota and 2.5× the speed**, and beats Opus xhigh (58). Neon high stays the "hard part" model.
- **Carbon low is never worth it** (54 at $7.19; Neon medium gives 55 for $1.90). **Carbon medium is the "must not hallucinate" model** (4.2%, the lowest of any model here, at index 58) and replaces Argon high.
- **Carbon high earns its cost only where it is measurably ahead:** long terminal work (below), stable prompt cache in long slow sessions (Known issues), and 256K–1M retrieval (GraphWalks 96.2%, Google-reported).
- **Neon xhigh (62)**: +2 points over high for 1.7× the quota and where its cache bug hurts most: almost never.

### Domain by domain: Gemini vs Claude

Sources: AA (independent, same harness), tbench.ai (independent), LMArena/DesignArena/EQ-Bench (independent), Google and Anthropic model cards (official, effort usually not stated). Checked 2026-11-24.

| Domain | Best Gemini | Best Claude | Route |
|---|---|---|---|
| Terminal / agentic (tbench.ai TB 4.1, each vendor's harness) | Carbon high 64.5%, Neon xhigh 61.2%, Hydrogen high 56.4% | Opus max 65.8%, Fable max 65.8%, Sonnet max 63.9%, Haiku max 40.0% | Neon high first; Carbon high / Orchestrator (Carbon) on long ones; Claude Code Opus if both fail |
| Terminal (AA's own TB 4.1 run, same harness) | **Carbon high 66.2%**, Neon xhigh 65.2% | Sonnet max 65.2%, Fable max 61.6%, Opus xhigh 59.6% | Same harness: Carbon high is the best single model |
| Real-repo coding / PR quality | Carbon FrontierSWE v2 61.2% | Fable FrontierSWE v2 69.9%, Opus SWE-bench Multimodal 70.2% | Code that must be PR-ready with little review, multi-turn design: Claude. Well-specified pieces: Hydrogen |
| Frontend / UI | LMArena WebDev Carbon 1768; DesignArena Website Neon 1355 | WebDev Fable 1838, Opus 1815, Sonnet 1772; DesignArena Fullstack Fable 1475 | Complex or taste-heavy UI: Claude. Simple pages, scaffolding, well-specified components: Hydrogen high |
| Prose, emails, specs | LMArena text Carbon 1527 (no style split) | EQ-Bench Creative Writing v3 Opus 2051 vs Argon 1758 | Judgment prose: Claude (Sonnet) |
| Factual accuracy / hallucination (AA-Omniscience) | Carbon medium 4.2%, Hydrogen 8.5–8.7%, Carbon high 11.4%, Neon 14% | Claude 43–67% hallucination rate (Fable max has the most correct answers: index 66.8 vs Neon xhigh 54.8) | Research, fact lookup: Gemini (Hydrogen high; Carbon medium when a wrong answer is costly). Fable knows more but guesses more |
| Science (AA HLE-Diamond) | Neon xhigh 71.3%, Carbon high 69.1% | Fable max 80.2%, Opus max 67.9% | Hardest science: Fable; otherwise Neon high |
| Math | FrontierMath T4 Neon 97.6%, Carbon 95.1% (Epoch) | Fable 100%, Opus 95.0% | Tie below Fable; AIME is saturated (100% for most) |
| Long context retrieval 256K–1M (GraphWalks, Google table) | Carbon 96.2%, Neon 95.2% | Opus 66.8% | Huge documents/repos: Gemini (Neon capped at 512K in agy; Carbon's agy cap not documented) |
| Long-context reasoning (AA-LCR) | no Carbon entry | Opus 84.7%, Fable 83.3% | Under ~200K with hard reasoning: Claude is fine |
| Video | LVBench Argon 91.7%, Neon 89.0% | Opus 83.7% | Gemini (Neon high after Argon leaves) |
| Computer use (OSWorld 2.1, Anthropic table) | Carbon 81.5% | Fable 89.3%, Opus 87.2% | Claude |
| Tool use | MCP Atlas Argon 90.7%; AutomationBench-AA Neon xhigh 79.3%, Carbon 77.8% | MCP Atlas Opus 85.4%; AutomationBench Fable max 76.4% | Gemini is competitive |
| Speed (AA tok/s) | Hydrogen 172, Neon 101, Carbon 54 | Haiku 258, Sonnet 155, Opus 117, Fable 112 | Latency is free for this user; ignore unless asked |

Third-party coding tests agree: on a small parser task Carbon high took 308 s and 19.7K tokens vs Neon 49 s / 6K and Opus 12 s / 1.4K (flaviocopes.com); in a multi-turn PR-quality comparison Opus 5.5 scored 89.4% vs Neon 77.4% (bito.ai). **Carbon over-thinks easy tasks.**

### Claude inside agy (`claude-sonnet-5-5-*`, `claude-opus-5-5-*`)

Same Anthropic models, billed to Antigravity's **"Claude and GPT" pool** (separate from the Gemini pool, non-trial paid plans only), so they cost no Claude Code quota. Limits:
- Effort goes only up to **high** (no xhigh/max). Sonnet medium reported 0 thinking tokens.
- That pool is smaller than the Gemini one and drains fast. Spend it where Claude beats Gemini (frontend, PR-ready code, prose), not on work Hydrogen does equally well.
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
| Orchestrator (Argon) | visible + hidden exact | 496 s | 337K |
| `gemini-4-argon-high` | visible + hidden exact | 574 s | 112K |

**Measured 2026-11-19, Gemini 4 Neon** (agy 1.5.9, `run`, hidden tests). Test 3 rebuilt with the same kind of quirks; Test 4: spreadsheet engine from a spec (formulas, precedence, ranges, error propagation order, cycle detection, recalculation; 60 hidden tests):

| Model in agy | Test 3 | Test 4 | Test 4 time · tokens |
|---|---|---|---|
| `gemini-4-neon-low` | — | 60/60 | 234 s · 62K |
| `gemini-4-neon-medium` | visible + hidden exact (618 s · 63K) | 60/60 | 418 s · 127K |
| `gemini-4-neon-high` | visible + hidden exact | 60/60 | 604 s · 172K |
| `gemini-4-neon-xhigh` | visible + hidden exact | — | — |
| `gemini-pro-orchestrator-neon` | visible + hidden exact | — | — |
| `gemini-4-hydrogen-high` | — | 60/60 | 401 s · 166K |

Every model tied on quality in these well-specified tasks, so they only show cost: Neon low solved the 60-test spec with ~⅓ of Hydrogen high's tokens; Orchestrator (Argon) spent 3.8× Hydrogen's tokens for the same result. Carbon has not been measured here; use the public benchmarks above.

### Orchestrators — when they pay off

How they work (antigravity.google/docs/models): one conversation, two models. The **planner** (Neon, Carbon or Argon in the CLI; Claude Opus 5.5 too in the App) explores read-only and writes a plan with re-plan conditions; the **executor** (Hydrogen by default; Sonnet 5.5 in the App) edits, builds and tests. Control returns to the planner after a verification fails twice, an interface behaves unexpectedly, a design choice is open, or periodically on long tasks. Questions and reviews are answered by the planner directly. It is **sequential, single-agent**: no parallel workers (that's `/swarm`, subagents or several `run`s with different tags). In the CLI the effort is fixed (`--effort` doesn't apply); since 1.5.15 the default is high for both roles, and a choice made in interactive `/model` persists in agy's `settings.json` and also applies to headless runs.

Evidence:
- **Official only:** Orchestrator (Carbon + Hydrogen) reaches "near-Carbon" success on Terminal-Bench with **24% less quota and 19% faster** than Carbon alone (Google, Hydrogen launch post; effort not stated; the two Google posts disagree on TB 4.0 vs 4.1). Google calls Orchestrator the "recommended default" for day-to-day work.
- **No independent benchmark** of any Orchestrator (not on tbench.ai or AA as of 2026-11-24).
- **User analysis** (discuss.ai.google.dev #202028, 3 logged sessions of Orchestrator (Neon medium)): cache misses on each Hydrogen → Neon hand-back re-read 50–100K tokens; Neon alone would have cost between 10% less and 2% more. Reported (#203336): reviewer/critic subagents inside an Orchestrator run inherit Hydrogen, not the planner.
- **Measured here:** Orchestrator (Argon) 3.8× the tokens of Hydrogen alone for the same result on a short terminal task; Orchestrator (Neon) exact on Test 3.
- Claude-side analogues: Anthropic's multi-agent research system beat single-agent Opus by 90.2% on its internal research eval but used ~15× the tokens of a chat, and Anthropic notes that coding has few truly parallel parts. Claude Code's `opusplan` (Opus plans, Sonnet executes) has no published figure either.

| Orchestrator | Use it for | Don't use it for |
|---|---|---|
| **Orchestrator (Carbon)** `gemini-pro-orchestrator` | Long, multi-step terminal or repo tasks (>30 min of agent work) where you'd otherwise pick Carbon high: Google's only figure says it gets near-Carbon results for ~¾ of the quota | Short tasks, questions, anything Neon high or Hydrogen already solves |
| **Orchestrator (Neon)** `gemini-pro-orchestrator-neon` | Long tasks where Hydrogen alone loses the plan and the steps are mostly mechanical once planned | Expecting savings over Neon high (none shown); long sessions with slow turns (Neon cache bug hits every hand-back) |
| Orchestrator (Argon) `gemini-pro-orchestrator-argon` | Nothing: leaves 2026-11-30 and was the costliest measured | — |

Rule of thumb: an Orchestrator is worth it only when the task is long enough that a cheap executor doing most of the steps outweighs the hand-off overhead. For independent pieces, parallel `run`s with their own `--tag` beat any Orchestrator.

### Decision table

| Work | First choice | If it fails / not suitable |
|---|---|---|
| Web research, source gathering, fact lookup | agy `report`, Hydrogen high | Claude verifies URLs and key figures; Carbon medium when a wrong fact is costly |
| Well-specified edit, script, simple UI | agy `run`, Hydrogen high | Neon high → Claude per model-routing |
| Bulk mechanical change, extraction | agy `run`, Neon low | Hydrogen medium/high |
| Long multi-file refactor or feature | agy `run`, Hydrogen high | Neon high → Orchestrator (Carbon) if it's long and both lost the plan → Claude Opus medium/high |
| Multi-file debugging, hard reasoning, cold above-Opus-high work | agy `run`, Neon high | Carbon high → Claude Opus xhigh / Fable |
| Terminal-heavy / multi-step agentic, short (<~200K context, turns <30 s apart) | agy Neon high | Carbon high → agy `claude-sonnet-5-5-high` → Claude Code Opus high/xhigh |
| Terminal-heavy, long or slow (hours, long gaps between turns, big context) | agy Carbon high or Orchestrator (Carbon) (stable cache) | agy `claude-sonnet-5-5-high` → Claude Code Opus high/xhigh |
| "Must not hallucinate" answers | Carbon medium (4.2%) | Hydrogen high/xhigh (8.5–8.7%) → Claude Opus high with sources |
| Long context 256K–1M, video, finance, complex legal | Neon high (agy cap 512K) | Carbon high above 512K (check `/context`) → Claude Opus high with sources |
| Complex or taste-heavy frontend, PR-ready code with little review, judgment prose | Claude (Sonnet/Opus per model-routing) | agy `claude-sonnet-5-5-high` to save Claude Code quota |
| Gemini pool exhausted | agy `claude-sonnet-5-5-high` | Claude Code |
| Depends on this conversation, design decisions, review of the delegated diff | Claude | — |

**Yes:**
- **Web research and reports** → `report` with Hydrogen high (default). In a 10-question test with known answers, Hydrogen got 10/10 with 8/8 real URLs, versus ~5/10 for Claude Haiku 5.5. Takes 5–17 min and ~150K tokens per run. Still verify key figures. agy's own security hook sometimes blocks Hydrogen's URL-resolving script, leaving `vertexaisearch` redirect links: then treat its figures as leads and verify them from the primary pages in Claude.
- Scoped edits, scripts, simple UI → `run` with Hydrogen high; bulk mechanical work → Neon low.
- Terminal/agentic work, multi-file debugging, reasoning Hydrogen failed → Neon high; Carbon high when Neon failed or the session is long and slow.
- Multimodal, long documents, finance/tax, legal → Neon high; Carbon above 512K.
- Any part that can run in parallel: several runs at once.

**No — keep it in Claude:**
- Anything that depends on the current conversation's context: Gemini starts cold.
- Work that already failed on Neon high and Carbon high, or that needs Fable-level reasoning (HLE, hardest science, FrontierSWE-style repo work).
- Complex frontend, computer use, and prose where taste matters: Claude leads every arena for these.
- **Not Hydrogen for long agentic terminal work** (56% vs 64–66%).
- **Not Carbon for easy or short tasks** (it over-thinks: 6× Neon's time on a small parser), **not Carbon low ever**, and not Carbon where Neon high is enough (2× the quota now, ~4× from Dec 1).

**Never:**
- Against a production or live system — only a local copy.
- Merging without reading the full diff (for `run`).
- Git commits or pushes through agy: Claude does those directly (agy was seen mangling non-ASCII characters in a commit message).
- Gemini 3.8 Flash for research (fabricates URLs), GPT-OSS, or anything leaving on 2026-11-30 for new work.

## Models in agy (`agy models`, CLI v1.5.16, 2026-11-24)

Always pass `--model <id>` explicitly. List what your plan offers with `agy models`; if an id is missing, use the next row down.

| id | Use | Quota |
|---|---|---|
| `gemini-4-hydrogen-high` | **Default.** Research, scoped code, simple UI | 1× |
| `gemini-4-neon-high` | Terminal/agentic work, multi-file debugging, reasoning Hydrogen failed, long context (512K cap in agy), multimodal, finance/legal | ~2× |
| `gemini-4-neon-low` | Mechanical/extraction work (beats Hydrogen medium on AA at lower cost). Never for terminal work (32.8%) | ~0.4× |
| `gemini-4-neon-medium` | Rarely: index 55 at Hydrogen high's AA $/task, but measured ~1.5× its quota | ~1–1.5× |
| `gemini-4-neon-xhigh` | Almost never: +2 points over high for 1.7× the quota | ~3.5× |
| `gemini-4-carbon-medium` | "Must not hallucinate" (4.2%, lowest measured), index 58. Replaces Argon high | ~3.5× |
| `gemini-4-carbon-high` | Terminal work Neon high failed; long, slow agentic sessions (cache stays warm); context above 512K. Slow (~38 min per AA task) | ~4× (~8× from Dec 1) |
| `gemini-4-carbon-low` | Never: Neon medium scores higher for ¼ of the quota | ~4× |
| `gemini-pro-orchestrator` ("Orchestrator (Carbon)") | Long multi-step terminal/repo tasks where you'd otherwise use Carbon high. See Orchestrators | ~¾ of Carbon high (Google) |
| `gemini-pro-orchestrator-neon` ("Orchestrator (Neon)") | Long tasks where Hydrogen alone loses the plan. No savings shown over Neon high | ~Neon high |
| `gemini-4-hydrogen-medium` / `-low` | Fallback for mechanical work if Neon is unavailable (low scores 6.6% on terminal tasks) | ~0.4× / ~0.15× |
| `gemini-4-hydrogen-xhigh` | Superseded by Neon high as the retry step | ~1.7× |
| `claude-sonnet-5-5-{low,medium,high}`, `claude-opus-5-5-{low,medium,high}` | Gemini pool empty, terminal work Gemini failed, or Claude-strength work (frontend, prose) without spending Claude Code quota. Max effort high | "Claude and GPT" pool |
| `gemini-4-argon-*`, `gemini-pro-orchestrator-argon`, `gemini-3.8-flash-*`, `gpt-oss-120b-medium` | **Leaving 2026-11-30.** Don't start new work on them | — |

Plan availability (antigravity.google/docs/models and /docs/plans, checked 2026-11-24): **Free/Plus:** Hydrogen (and Flash until 11-30), weekly quota. **Pro trial:** Hydrogen plus a limited set; Neon, Carbon, Argon and Orchestrator only on eligible premium devices; no Claude. **Pro (paid):** Hydrogen, Neon, Carbon, Argon (until 11-30), Orchestrator, Claude Sonnet/Opus 5.5; 5-hour window up to a weekly cap. **Ultra:** same models, 5× ($100) or 20× ($200) Pro's quota. **Enterprise:** Orchestrator is fixed to Carbon high + Hydrogen high.

The user's plan is stored in `~/.claude/gemini-delegate.json` and injected by the SessionStart hook with plan-specific substitutions. Read or change it with `node C:/Users/Daniel/Documents/GitHub/gemini-delegate/plugins/gemini-delegate/scripts/delegate.mjs plan [--set free|pro-trial|pro|ultra]`. If the hook says the plan is unknown, ask the user once (AskUserQuestion) and save it before delegating.

### Effort levels

Start Hydrogen at **high** (its default; medium drops from 51 to 41). For mechanical work use Neon low instead of lowering Hydrogen. When Hydrogen high fails, go to Neon high, not Hydrogen xhigh. Carbon: medium for accuracy, high for hard terminal work, never low. Terminal-Bench by effort (AA): Neon low 32.8%, medium 54.5%, high 61.6%, xhigh 63.6% (TB 4.0); Carbon low 62.1%, medium 61.6%, high 66.2% (TB 4.1); Hydrogen low 6.6%, medium 29.3%, high 54.0%.

Neon and Carbon limits: knowledge cutoff March 2026 (Claude 5.x: June 2026), 64K synchronous output, 1M context in the API (Neon 512K in Antigravity; Carbon's Antigravity cap isn't documented and users report compaction around 250–276K, issue #1245).

### Known issues (as of 2026-11-24)

- **Neon's prompt cache still drops after ~15–30 s between turns** (antigravity-cli #1665, open, updated 2026-11-23): after the 2026-11-21 patch, hit rate by gap was Neon 85% (<15 s), 64% (15–30 s), 33% (30–60 s); **Carbon 96/95/91%** and Hydrogen 95/88/93%. One user's day of Neon took their Ultra weekly quota from 40% to 77%. Keep Neon runs short and context small; for long, slow sessions use Carbon or Hydrogen.
- **`THINKING_LEVEL_XHIGH` 400** (#1609, #1616): still open on GitHub, but users report it fixed from CLI 1.5.13, and 1.5.15 made Orchestrator default to high. If it appears, switch to Neon high and update agy.
- **Degraded answers and false "done" claims** (mostly Ultra, 2026-11-15/17): Google traced it to an entitlements bug routing accounts to the free tier; users report recovery from 2026-11-19/22 after updating to App 2.33 / CLI 1.5.13+ or signing in again. Still grade every result on tests or the diff, never on agy's summary.
- **Headless cost** (discuss.ai.google.dev #198073): `agy -p` has no quota multiplier, but every new process starts with a cold cache, so the first turn pays the full system/tool prompt. Negligible on long runs; it adds up with many tiny runs, so batch small tasks into one run.
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

## agy quota (antigravity.google/docs/plans, /docs/models and the plans blog, checked 2026-11-24)

- Two pools: **Gemini models** (Hydrogen, Neon, Carbon, Orchestrator, …) and **Claude and GPT models**. The Gemini pool is drawn **in proportion to API price** (see "How quota is charged"). Paid plans have a 5-hour window up to a weekly cap; Free/Plus refresh weekly. Once the weekly cap is spent it doesn't refill until the weekly reset. Google publishes no absolute numbers; Ultra is 5× or 20× Pro.
- Google reset everyone's Gemini quota on 2026-11-21 and 2026-11-23 (a caching fix gave ~22% more work per quota).
- Usage scales with agent work (steps, tools, re-sent context), not with the number of prompts. A heavy agentic task on a limited model can eat 30–50% of the weekly cap in minutes (user reports).
- Check `/usage` (alias `/quota`) in interactive agy after big runs; since 1.5.16 it refreshes during long turns.
- Headless `agy -p`, which this script uses, has no quota multiplier but starts each process with a cold cache (see Known issues).
- When it runs out: wait for the reset, or use AI credits if "AI Credit Overages" is set to Always.

## Security — what this does NOT guarantee

Read this before using it.

- **`.env` and every `.env.*` are never copied** (keys and tokens). Neither is `.env.example`, so the copy filter and the diff/merge filter stay identical. If a task needs environment variables, give example values in the prompt.
- **`--sandbox` contains nothing in practice.** Open issue in `google-antigravity/antigravity-cli` (#36): `--dangerously-skip-permissions` (required headless) also auto-approves the model's own request to leave the sandbox (`bypassSandbox: true`). Seen live: Hydrogen asked for `BypassSandbox: true` to resolve URLs; in `plan` mode it asked, in `auto` it was granted automatically.
- No container or separate OS user — agy runs with the current user's permissions.
- The post-run tripwire is shallow (top level of Desktop, Documents, `.ssh`, `.aws`, `~/.agents` and `~/.agents/skills`, plus the file below), not a full disk scan.
- **agy 1.5.14+ Auto mode reads files outside the workspace without asking, and 1.5.16+ also creates or edits files outside it without asking when they're inside any version-controlled repo or the change only appends.** With `--dangerously-skip-permissions` everything was already auto-approved, so the copy does not stop Gemini from writing into your other repos: check `git status` in nearby repos if the tripwire or the summary mentions outside paths.
- agy 1.5.16+ loads user-global skills from `~/.agents/skills` in every session: a malicious write there persists like the `mcp_config.json` backdoor below, so the tripwire watches it.
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
