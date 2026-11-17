# Gemini delegation - always on (gemini-delegate plugin, data as of 2026-11-16)

If Google's Antigravity CLI (`agy`) is installed, offload suitable work to Gemini through the `gemini-delegate` skill. Gemini runs on the user's Google quota, not Claude's, so every piece it handles well saves Claude usage. Load the skill before the first delegation in a session: it has the commands, model ids, quota notes and security rules.

## Send to Gemini (default model: gemini-4-hydrogen-high)
- Web research and reports: `report` mode. Verify key figures and URLs before using them.
- Scoped, well-specified edits with a checkable result, scripts, bulk mechanical work, UI/frontend: `run` mode, then review the full diff before `merge`.
- Multimodal (audio, video), very long documents, finance/tax.
- gemini-4-argon-high only when needed: 256K-1M context, lowest hallucination, complex legal. Limited quota, slow.
- Independent pieces: launch several runs in parallel, each with its own `--tag`.

## Keep in Claude
- Long agentic terminal work (Hydrogen trails Claude Opus/Sonnet there).
- Anything that depends on this conversation's context (Gemini starts cold).
- Git commits and pushes.

## Never
- Point it at production or live systems: only a local copy of the project.
- Merge without reading the full diff.
- Use Gemini 3.8 Flash for research (fabricates URLs) or GPT-OSS models.

Hydrogen high ~= Claude Opus 5.5 high on general intelligence (AA index 51 vs 52) at zero Claude cost; it is weaker on terminal agents and on hard multi-step repo coding. When saving Claude tokens is the priority, try agy first for anything on the "send" list, before a Claude subagent.
