# gemini-delegate

A Claude Code plugin that lets Claude hand work to **Gemini** through Google's **Antigravity CLI (`agy`)**: scoped edits, scripts, UI work and web research run on your Google quota instead of your Claude usage. Claude stays the orchestrator — it writes the task, Gemini works on an **isolated copy** of your project, and Claude reviews the full diff before anything is merged back.

> **⚠️ Security — read before installing.** The bundled script runs `agy` with `--dangerously-skip-permissions` (required for headless use). agy's `--sandbox` does **not** contain the model in practice: with that flag, agy also auto-approves the model's own requests to leave the sandbox (open issue google-antigravity/antigravity-cli#36). agy runs with your user's permissions. The protections are: work happens on a disposable copy, `.env*` files and agy rules files (`AGENTS.md`, `GEMINI.md`, `.agent/`, `.agents/`) are never copied, a tripwire flags writes to sensitive folders, and nothing reaches your project until Claude reviews the diff and you merge. **Never point it at production or live systems.** See the Security section of the skill for details.

## What you get

- **`gemini-delegate` skill** — commands, model ids, effort levels, quota notes and security rules. Claude loads it before delegating.
- **`delegate.mjs` script** — `run` (edit on a copy, return a diff), `report` (research/analysis, return text), `merge`, `discard`, `cleanup`. No git repo needed: it copies the current disk state and diffs with `git diff --no-index`.
- **SessionStart hook** — a short set of rules (~2.4K characters) injected in every session, so Claude remembers what to send to Gemini and what to keep: research and scoped edits go to Gemini; terminal-heavy work goes to the Claude models inside agy (Antigravity quota); conversation-dependent work, above-high effort and git commits stay in Claude Code.

Works well alongside [model-routing](https://github.com/Daniboy2116/model-routing), which covers choosing between Claude models.

## Requirements

- Claude Code
- Node.js 18+
- git (only for `git diff --no-index`; your project doesn't need to be a repo)
- Antigravity CLI (`agy`) installed and signed in. The script finds it via the `AGY_PATH` environment variable, the default Windows location (`%LOCALAPPDATA%\agy\bin\agy.exe`), or `agy` on your `PATH`.
- A Google account for Antigravity. Which models you get depends on your Google AI plan (Antigravity docs, Nov 2026):

  | Plan | Models in agy |
  |---|---|
  | Free / Plus (no plan) | 3.8 Flash only |
  | Google AI Pro trial | Flash; Neon, Argon and the Orchestrators only on eligible premium devices. No Hydrogen, no Claude |
  | Google AI Pro (paid) | Hydrogen, Neon, Flash, Argon, Orchestrator (Neon / Argon), Claude Sonnet/Opus 5.5 |
  | Google AI Ultra | + Gemini 4 Carbon, Orchestrator (Carbon) |

## Install

```
/plugin marketplace add Daniboy2116/gemini-delegate
/plugin install gemini-delegate@gemini-delegate-marketplace
```

Then start a new session (or run `/reload-plugins`). In that first session Claude asks once which Google AI plan you have and saves it to `~/.claude/gemini-delegate.json`, so its routing only uses models you actually have. To change it later:

```
node <plugin path>/scripts/delegate.mjs plan --set <free|pro-trial|pro|ultra>
```

The skill pre-approves its own script during the turn it's used. To skip permission prompts for background runs in later turns too, add an allow rule for `node <plugin path>/scripts/delegate.mjs` to your settings — only if you accept the security trade-off above.

## Models (as of 2026-11-19)

| Model (`agy models` id) | Use |
|---|---|
| `gemini-4-hydrogen-high` | Default: research, scoped code, UI |
| `gemini-4-neon-high` | Terminal/agentic work, multi-file debugging, harder reasoning, long context, multimodal, finance/legal (AA index 60, above Opus 5.5 xhigh). ~2× Hydrogen's quota per token |
| `gemini-4-neon-low` | Mechanical/extraction work (beats Hydrogen medium on AA, measured ~⅓ of Hydrogen high's tokens) |
| `gemini-4-argon-high` | Lowest hallucination (4%), context above 512K. Limited quota, slow |
| `gemini-pro-orchestrator-neon` | Orchestrator (Neon): Neon plans, Hydrogen executes. Only very long tasks where a single model loses the plan. No published benchmark |
| `claude-sonnet-5-5-high` / `claude-opus-5-5-high` | Claude inside agy, on Antigravity's Claude pool: when the Gemini pool is empty or Neon failed on terminal work. Max effort high |
| `gemini-3.8-flash-*` | Fallback only — never for research (fabricates URLs) |
| Neon xhigh, Argon low/medium, `gpt-oss-120b` | Never or almost never (+1 point for 2.3× tokens / no gain over Argon high / AA index ~4; GPT-OSS removed 2026-11-18) |

Benchmarks are from Artificial Analysis Intelligence Index v5.0.1, Google model cards and Antigravity docs; models and quotas change often. PRs with fresher data are welcome.

## License

MIT
