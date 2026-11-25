# Gemini delegation - always on (gemini-delegate plugin, data as of 2026-11-24)

If Google's Antigravity CLI (`agy`) is installed, offload suitable work to Gemini through the `gemini-delegate` skill. Gemini runs on the user's Google quota, not Claude's, so every piece it handles well saves Claude usage. Before spawning any Claude subagent or doing web research yourself, invoke the `gemini-delegate` skill with the Skill tool and decide whether agy does it: the skill has the commands, model ids, a domain-by-domain comparison with Claude, quota notes and security rules.

## Send to Gemini (default model: gemini-4-hydrogen-high)
- Web research, reports, fact lookup: `report` mode, Hydrogen high (hallucinates 8.7% vs 43-67% for Claude models on AA-Omniscience). Verify key figures and URLs.
- Scoped, well-specified edits, scripts, simple UI: `run` mode, Hydrogen high (AA 51 ~= Opus high 52), then review the full diff before `merge`.
- Mechanical/extraction work you'd give Haiku: gemini-4-neon-low. Fallback: Hydrogen medium.
- **gemini-4-neon-high for the hard part**: terminal/agentic work, reasoning Hydrogen failed, multi-file debugging, 256K-512K context, video, finance/legal. AA 60 (> Opus xhigh 58) at ~2x Hydrogen's quota. Keep runs short: its prompt cache still drops after 15-30 s between turns.
- **gemini-4-carbon-high** (now on paid Pro): terminal work Neon high failed, long/slow agentic sessions (its cache stays warm), context above 512K. Best single model on AA's Terminal-Bench 4.1 (66.2%) but ~4x Hydrogen's quota (~8x from 2026-12-01) and slow. Never for easy tasks; never carbon-low.
- **gemini-4-carbon-medium** for "must not hallucinate" answers (4.2%, lowest measured). Replaces Argon.
- Orchestrator (Carbon) (`gemini-pro-orchestrator`): long multi-step terminal/repo tasks where you'd use Carbon high (Google: near-Carbon results, 24% less quota). Orchestrator (Neon): long tasks where Hydrogen loses the plan; no savings shown over Neon high. Never Orchestrators for short tasks; for independent pieces launch parallel runs, each with its own `--tag`.
- Leaving 2026-11-30: Argon, Orchestrator (Argon), 3.8 Flash, GPT-OSS. Don't start new work on them.

## Claude models inside agy (Antigravity's "Claude and GPT" pool, not Claude Code quota)
- `claude-sonnet-5-5-high` (then `claude-opus-5-5-high`): when the Gemini pool is empty, terminal work Gemini failed, or Claude-strength work (frontend, prose) you want off Claude Code quota. Max effort is high; that pool is small.

## Keep in Claude Code
- Anything that depends on this conversation's context (Gemini starts cold), design decisions, reviewing delegated diffs, git commits and pushes.
- Where Claude clearly leads: complex or taste-heavy frontend (WebDev arena: Fable 1838, Opus 1815 vs Carbon 1768), PR-ready code with little review (FrontierSWE: Fable 69.9 vs Carbon 61.2), judgment prose, computer use, Fable-level science/reasoning.
- Work that failed on Neon high and Carbon high in agy, or needs Opus xhigh/max/Fable with this conversation's context.

## Never
- Point it at production or live systems: only a local copy of the project.
- Merge without reading the full diff. agy 1.5.16 can write into other git repos outside the copy without asking: check them if the summary mentions outside paths.
- Use Gemini 3.8 Flash for research (fabricates URLs) or GPT-OSS models.

Always grade agy results on tests or the diff, not on agy's summary (false "done" claims were reported 2026-11-15/22). When saving Claude tokens is the priority, try agy first for anything on the "send" list, before a Claude subagent.
