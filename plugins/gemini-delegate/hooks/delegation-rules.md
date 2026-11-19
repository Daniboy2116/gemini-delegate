# Gemini delegation - always on (gemini-delegate plugin, data as of 2026-11-19)

If Google's Antigravity CLI (`agy`) is installed, offload suitable work to Gemini through the `gemini-delegate` skill. Gemini runs on the user's Google quota, not Claude's, so every piece it handles well saves Claude usage. Load the skill before the first delegation in a session: it has the commands, model ids, quota notes and security rules.

## Send to Gemini (default model: gemini-4-hydrogen-high)
- Web research and reports: `report` mode, Hydrogen high. Verify key figures and URLs before using them.
- Scoped, well-specified edits with a checkable result, scripts, bulk mechanical work, UI/frontend: `run` mode, Hydrogen high, then review the full diff before `merge`.
- Mechanical/extraction work you'd give Haiku: gemini-4-neon-low (AA 44 at $0.75/task beats Hydrogen medium 41 at $0.80; measured 62K tokens vs Hydrogen high's 166K on the same task). Fallback: Hydrogen medium.
- **gemini-4-neon-high for the hard part**: terminal/agentic work, reasoning Hydrogen failed, multi-file debugging, 256K-512K context, multimodal, finance/legal. AA index 60 (> Opus xhigh 57, ~= Opus max 59), Terminal-Bench 4.0 61.6% (Hydrogen high 54%), at zero Claude cost. It costs ~2x Hydrogen per token, so it is not the default for easy work.
- Neon xhigh almost never (+1 index point for 2.3x the output tokens). Neon medium: +4 index points over Hydrogen high at the same AA $/task, but measured ~1.5x Hydrogen's quota cost, so Hydrogen high stays the default. Never Neon low on terminal/agentic work (32.8%).
- Neon in long sessions: keep context under ~200K and avoid it when turns are >30 s apart for hours; its prompt cache drops (open bug, ~2.5x quota burn). Hydrogen's cache stays warm.
- gemini-4-argon-high only for "must not hallucinate" (4% vs Neon 14%). Neon replaces it for long context, legal and speed.
- Orchestrator (Neon) (`gemini-pro-orchestrator-neon`): only very long tasks where Hydrogen alone loses the plan. No published benchmark; fails on some accounts with `THINKING_LEVEL_XHIGH` 400 (switch to Neon high).
- Independent pieces: launch several runs in parallel, each with its own `--tag`.

## Claude models inside agy (Antigravity's "Claude and GPT" pool, not Claude Code quota)
- `claude-sonnet-5-5-high` (then `claude-opus-5-5-high`): when the Gemini pool is empty, or Neon high failed on terminal work. Max effort is high; that pool is small.

## Keep in Claude Code
- Work that failed on Neon high in agy, or needs Opus xhigh/max/Fable with this conversation's context.
- Anything that depends on this conversation's context (Gemini starts cold).
- Git commits and pushes.

## Never
- Point it at production or live systems: only a local copy of the project.
- Merge without reading the full diff.
- Use Gemini 3.8 Flash for research (fabricates URLs) or GPT-OSS models.

AA index v5.0.1: Hydrogen high 51 > Sonnet high 42 and Haiku max 36, ~= Opus high 52; Neon high 60 > Opus xhigh 57. Since 2026-11-17 some (mostly Ultra) accounts report degraded, near-zero-thinking answers and false "done" claims in Antigravity: always check results against tests or the diff. Research reports may come back with unverified redirect URLs (agy's security hook): verify in Claude. When saving Claude tokens is the priority, try agy first for anything on the "send" list, before a Claude subagent.
