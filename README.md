# gemini-delegate

A Claude Code plugin that lets Claude hand work to **Gemini** through Google's **Antigravity CLI (`agy`)**: scoped edits, scripts, UI work and web research run on your Google quota instead of your Claude usage. Claude stays the orchestrator — it writes the task, Gemini works on an **isolated copy** of your project, and Claude reviews the full diff before anything is merged back.

> **⚠️ Security — read before installing.** The bundled script runs `agy` with `--dangerously-skip-permissions` (required for headless use). agy's `--sandbox` does **not** contain the model in practice: with that flag, agy also auto-approves the model's own requests to leave the sandbox (open issue google-antigravity/antigravity-cli#36). agy runs with your user's permissions. The protections are: work happens on a disposable copy, `.env*` files and agy rules files (`AGENTS.md`, `GEMINI.md`, `.agent/`, `.agents/`) are never copied, a tripwire flags writes to sensitive folders, and nothing reaches your project until Claude reviews the diff and you merge. **Never point it at production or live systems.** See the Security section of the skill for details.

## What you get

- **`gemini-delegate` skill** — commands, model ids, effort levels, quota notes and security rules. Claude loads it before delegating.
- **`delegate.mjs` script** — `run` (edit on a copy, return a diff), `report` (research/analysis, return text), `merge`, `discard`, `cleanup`. No git repo needed: it copies the current disk state and diffs with `git diff --no-index`.
- **SessionStart hook** — a short set of rules (~1.7K characters) injected in every session, so Claude remembers what to send to Gemini and what to keep: research and scoped edits go to Gemini; long terminal agents, conversation-dependent work and git commits stay in Claude.

Works well alongside [model-routing](https://github.com/Daniboy2116/model-routing), which covers choosing between Claude models.

## Requirements

- Claude Code
- Node.js 18+
- git (only for `git diff --no-index`; your project doesn't need to be a repo)
- Antigravity CLI (`agy`) installed and signed in. The script finds it via the `AGY_PATH` environment variable, the default Windows location (`%LOCALAPPDATA%\agy\bin\agy.exe`), or `agy` on your `PATH`.

## Install

```
/plugin marketplace add Daniboy2116/gemini-delegate
/plugin install gemini-delegate@gemini-delegate-marketplace
```

Then start a new session (or run `/reload-plugins`).

The skill pre-approves its own script during the turn it's used. To skip permission prompts for background runs in later turns too, add an allow rule for `node <plugin path>/scripts/delegate.mjs` to your settings — only if you accept the security trade-off above.

## Models (as of 2026-11-16)

| Model (`agy models` id) | Use |
|---|---|
| `gemini-4-hydrogen-high` | Default: research, scoped code, UI, multimodal, finance |
| `gemini-4-argon-high` | 256K–1M context, lowest hallucination, complex legal. Limited quota, slow |
| `gemini-pro-orchestrator-g1-pro` | Orchestrator (Argon): Argon plans, Hydrogen executes. Long multi-file tasks |
| `gemini-3.8-flash-*` | Fallback only — never for research (fabricates URLs) |

Benchmarks are from Artificial Analysis Intelligence Index v5.0.1, Google model cards and Antigravity docs; models and quotas change often. PRs with fresher data are welcome.

## License

MIT
