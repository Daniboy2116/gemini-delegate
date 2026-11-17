# Gemini delegation - always on (gemini-delegate plugin, data as of 2026-11-16)

If Google's Antigravity CLI (`agy`) is installed, offload suitable work to Gemini through the `gemini-delegate` skill. Gemini runs on the user's Google quota, not Claude's, so every piece it handles well saves Claude usage. Load the skill before the first delegation in a session: it has the commands, model ids, quota notes and security rules.

## Send to Gemini (default model: gemini-4-hydrogen-high)
- Web research and reports: `report` mode. Verify key figures and URLs before using them.
- Scoped, well-specified edits with a checkable result, scripts, bulk mechanical work, UI/frontend: `run` mode, then review the full diff before `merge`.
- Multimodal (audio, video), very long documents, finance/tax.
- gemini-4-argon-high only when needed: 256K-1M context, lowest hallucination, complex legal. Limited quota, slow, not smarter than Hydrogen. Never Argon low/medium.
- Long multi-file work: Hydrogen high too. Orchestrator (Argon) only if Hydrogen loses the plan: measured same result at ~4x the tokens; Google's terminal claim is for Carbon.
- Mechanical/extraction work you'd give Haiku: Hydrogen medium (beats Haiku max).
- Independent pieces: launch several runs in parallel, each with its own `--tag`.

## Claude models inside agy (Antigravity's "Claude and GPT" pool, not Claude Code quota)
- `claude-sonnet-5-5-high` (then `claude-opus-5-5-high`): long agentic terminal work, or anything when the Gemini pool is empty. Max effort is high; that pool is small, so don't spend it on work Hydrogen does equally well (measured: tie on well-specified code).

## Keep in Claude Code
- Terminal/agentic work that needs more than high effort, or failed in agy.
- Anything that depends on this conversation's context (Gemini starts cold).
- Git commits and pushes.

## Never
- Point it at production or live systems: only a local copy of the project.
- Merge without reading the full diff.
- Use Gemini 3.8 Flash for research (fabricates URLs) or GPT-OSS models.

AA index v5.0.1: Hydrogen high 51 > Sonnet high 42 and Haiku max 36, ~= Sonnet xhigh 50 and Opus high 52, at zero Claude cost; Hydrogen xhigh 54 is a retry step before Opus xhigh (57). It is weaker on terminal agents and hard multi-step repo coding. Research reports may come back with unverified redirect URLs (agy's security hook): verify in Claude. When saving Claude tokens is the priority, try agy first for anything on the "send" list, before a Claude subagent.
