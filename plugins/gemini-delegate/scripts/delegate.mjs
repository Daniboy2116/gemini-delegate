#!/usr/bin/env node
// Wrapper: delegate a scoped task to `agy` (Antigravity CLI / Gemini) against a
// plain filesystem copy of the target folder — no git required, so it always
// reflects the current disk state (committed or not). Runs headless, meant
// to be invoked in the background like any other subagent. See ../skills/gemini-delegate/SKILL.md.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WORKTREES_ROOT = path.join(os.homedir(), '.claude', 'gemini-delegate-worktrees');
const DEFAULT_MODEL = 'gemini-4-hydrogen-high';
const COPY_EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', 'target', '.cache', '.agent', '.agents']);
// AGENTS.md/GEMINI.md are excluded for a different reason than the dirs above:
// agy (CLI, not just the IDE) reads these as trusted "rules" files. A malicious
// one in a delegated project could instruct agy to write a persistent backdoor
// to the GLOBAL ~/.gemini/antigravity/mcp_config.json — a real, unpatched
// vulnerability (Google: "Won't Fix / Intended Behavior") that survives across
// every future agy session, not just this one. We never need project-authored
// rules here — the task prompt is already self-contained — so just never let
// agy see them.
const COPY_EXCLUDE_FILES = new Set(['AGENTS.md', 'GEMINI.md']);
// .env and every .env.* (API keys, tokens) never reach the delegated model.
// The pathspecs below must cover exactly the same names, or merge would see them
// as deleted in the copy and delete them for real. .env.example goes too: keeping
// filter and pathspec identical matters more than the template.
const isEnvFile = (base) => base === '.env' || base.startsWith('.env.');
// Same excludes as git pathspecs — WITHOUT this, git diff --no-index compares
// targetDir (real, has .git/node_modules/AGENTS.md/etc.) against copyPath
// (filtered, doesn't) and reports every excluded path as deleted. merge then
// deletes them for real — this destroyed a real project's .git history in
// testing. Dirs need /** to match contents; files must NOT have it (that
// pattern only matches paths *inside* a directory of that name).
const EXCLUDE_PATHSPECS = [
  ...[...COPY_EXCLUDE_DIRS].map((name) => `:(exclude,glob)**/${name}/**`),
  ...[...COPY_EXCLUDE_FILES].map((name) => `:(exclude,glob)**/${name}`),
  ':(exclude,glob)**/.env',
  ':(exclude,glob)**/.env.*',
];
// The exact file the backdoor vulnerability above writes to. Not covered by
// the Desktop/Documents/.ssh/.aws tripwire sentinels — watched directly here
// so a delegated task touching it is never silently missed.
const GLOBAL_AGY_CONFIG = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${res.status}):\n${res.stderr || res.stdout}`);
  }
  return res;
}

// git diff --no-index exit codes: 0 = identical, 1 = differences found (both
// normal, not errors), >1 = a real git error. Bug found in review: treating
// exit >1 as "just no output" silently reported "nothing changed" on a real
// diff failure (huge excluded build dir choking the diff). Surfaces the
// error instead of swallowing it.
function gitDiffNoIndex(a, b, extraArgs = []) {
  const res = spawnSync('git', ['diff', '--no-index', ...extraArgs, a, b, '--', ...EXCLUDE_PATHSPECS], { encoding: 'utf8' });
  const error = res.status > 1 ? (res.stderr || `git diff --no-index exited ${res.status}`).trim() : null;
  return { stdout: res.stdout || '', error };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'task';
}

// Order: --agy flag, AGY_PATH env var, the default Windows install location, then plain 'agy' on PATH.
function findAgy(explicit) {
  if (explicit) return explicit;
  if (process.env.AGY_PATH) return process.env.AGY_PATH;
  const candidates = [path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin', 'agy.exe')];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'agy';
}

function parseArgs(argv) {
  const out = { action: 'run', timeout: '20m' };
  if (argv[0] && !argv[0].startsWith('--')) out.action = argv.shift();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') out.dir = argv[++i];
    else if (a === '--task') out.task = argv[++i];
    else if (a === '--tag') out.tag = argv[++i];
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--mode') out.mode = argv[++i];
    else if (a === '--timeout') out.timeout = argv[++i];
    else if (a === '--trailer') out.trailer = argv[++i];
    else if (a === '--agy') out.agyPath = argv[++i];
  }
  return out;
}

function fwd(p) {
  return p.replace(/\\/g, '/');
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function metaPathFor(copyPath) {
  return `${copyPath}.meta.json`;
}

// Deletes a directory tree with retries — a file Windows still has locked
// (seen with a .exe/.dll under target/debug right after a build) throws
// EBUSY even with force:true, which crashed the whole script uncaught.
// Returns null on success, an error message string if it never clears.
function safeRemoveDir(p) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      return null;
    } catch (err) {
      if (attempt === 3) return err.message;
      sleepSync(300 * attempt);
    }
  }
}

// Copies the CURRENT disk state (committed or not) of src into dest, skipping
// common bulky/generated directories and agent-rules files that agy doesn't
// need to see (see COPY_EXCLUDE_FILES comment above for why the .md files
// matter security-wise, not just noise-wise).
function copyDirFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (source) => {
      const base = path.basename(source);
      return !COPY_EXCLUDE_DIRS.has(base) && !COPY_EXCLUDE_FILES.has(base) && !isEnvFile(base);
    },
  });
}

function invokeAgy({ agyBin, agyArgs, logPath, cwd }) {
  const run = spawnSync(agyBin, agyArgs, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(logPath, (run.stdout || '') + '\n---STDERR---\n' + (run.stderr || ''));
  return run;
}

function parseAgyResult(run) {
  try { return JSON.parse(run.stdout); } catch { return null; }
}

// Cheap, shallow tripwire: only catches things written to top-level of a few
// sensitive folders during the run, plus the one specific global file the
// known agy backdoor vulnerability targets. Not a real sandbox — see SKILL.md.
// Deliberately excludes home-dir top-level and .claude/* — this very Claude
// Code session touches those constantly, which was a false positive early on.
function computeTripwire(startTime) {
  const sentinelDirs = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), '.ssh'),
    path.join(os.homedir(), '.aws'),
  ].filter(fs.existsSync);
  const tripwire = [];
  for (const dir of sentinelDirs) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (p.startsWith(WORKTREES_ROOT)) continue;
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs > startTime) tripwire.push(p);
      } catch { }
    }
  }
  if (fs.existsSync(GLOBAL_AGY_CONFIG)) {
    try {
      const st = fs.statSync(GLOBAL_AGY_CONFIG);
      if (st.mtimeMs > startTime) tripwire.push(`${GLOBAL_AGY_CONFIG} (possible persistent backdoor - see SKILL.md)`);
    } catch { }
  }
  return tripwire;
}

function buildAgyArgs({ task, scopedPath, timeout, model, mode }) {
  return [
    `--print=${task}`,
    `--mode=${mode}`,
    '--dangerously-skip-permissions',
    '--sandbox',
    `--add-dir=${scopedPath}`,
    '--output-format=json',
    `--print-timeout=${timeout}`,
    `--model=${model}`,
  ];
}

// Resolves an absolute path relative to whichever of targetDir/copyPath
// prefixes it (git diff --no-index reports the modified side's path for M,
// the copy-only side for A, the target-only side for D).
function relFrom(p, targetDir, copyPath) {
  if (p.startsWith(targetDir + '/')) return path.posix.relative(targetDir, p);
  if (p.startsWith(copyPath + '/')) return path.posix.relative(copyPath, p);
  return p;
}

function runDelegate(args) {
  if (!args.dir || !args.task) {
    console.error('Usage: delegate.mjs run --dir <path> --task "<task>" [--tag name] [--model id] [--timeout 20m] [--agy path]');
    process.exit(2);
  }
  const targetDir = fwd(path.resolve(args.dir));
  if (!fs.existsSync(targetDir)) throw new Error(`Not found: ${targetDir}`);
  const agyBin = findAgy(args.agyPath);

  const tag = args.tag || `${slugify(args.task)}-${Date.now()}`;
  fs.mkdirSync(WORKTREES_ROOT, { recursive: true });
  const copyPath = fwd(path.join(WORKTREES_ROOT, 'copies', tag));

  // Recorded BEFORE the copy, not after — used at merge time (a separate,
  // later invocation) to detect if the real project changed concurrently
  // while agy was working. Real scenario that surfaced this: the user edited
  // the same project by hand while a `run` was in flight; merge would have
  // silently overwritten those edits with agy's stale pre-edit snapshot.
  const snapshotTime = Date.now();
  copyDirFiltered(targetDir, copyPath);
  fs.writeFileSync(metaPathFor(copyPath), JSON.stringify({ targetDir, snapshotTime }));

  const startTime = Date.now();
  const model = args.model || DEFAULT_MODEL;
  const agyArgs = buildAgyArgs({ task: args.task, scopedPath: copyPath, timeout: args.timeout, model, mode: 'accept-edits' });
  const logPath = path.join(WORKTREES_ROOT, `${tag}.log`);

  const run = invokeAgy({ agyBin, agyArgs, logPath, cwd: copyPath });

  const diffFullRes = gitDiffNoIndex(targetDir, copyPath);
  const diffStatRes = gitDiffNoIndex(targetDir, copyPath, ['--stat']);
  const nameStatusRes = gitDiffNoIndex(targetDir, copyPath, ['--name-status']);
  const diffPath = path.join(WORKTREES_ROOT, `${tag}.diff`);
  fs.writeFileSync(diffPath, diffFullRes.stdout);
  const diffError = diffFullRes.error || diffStatRes.error || nameStatusRes.error || null;

  const tripwire = computeTripwire(startTime);
  const agyJson = parseAgyResult(run);

  const filesChanged = nameStatusRes.stdout.trim() ? nameStatusRes.stdout.trim().split('\n') : [];
  const ok = run.status === 0 && agyJson?.status !== 'ERROR' && tripwire.length === 0 && !diffError;
  const digest = {
    tag,
    targetDir,
    copyPath,
    model,
    agyExitCode: run.status,
    agySummary: agyJson || { raw: (run.stdout || '').slice(0, 4000) },
    filesChanged,
    diffStat: diffStatRes.stdout,
    diffError,
    diffPath,
    logPath,
    tripwire,
    nextSteps: diffError
      ? 'ERROR: git diff --no-index really failed (this is not "no changes") - check diffError before trusting filesChanged.'
      : tripwire.length
        ? 'TRIPWIRE: files outside the copy were modified during the run. Review them manually before trusting anything else.'
        : `Review diffPath, then: node delegate.mjs merge --tag ${tag} --dir ${targetDir}  (or) discard instead of merge. If the real project was edited while this task ran, merge detects and skips any conflicting file instead of overwriting it.`,
  };
  console.log(JSON.stringify(digest, null, 2));
  process.exit(ok ? 0 : 1);
}

// Read-only analysis/report — no copy kept afterward, no diff/merge/discard
// cycle. Default --mode=auto: in plan mode Hydrogen only writes a plan and never answers; the copy is discarded anyway.
function reportDelegate(args) {
  if (!args.dir || !args.task) {
    console.error('Usage: delegate.mjs report --dir <path> --task "<question or analysis>" [--model id] [--mode auto|plan|accept-edits] [--timeout 20m] [--agy path]');
    process.exit(2);
  }
  const targetDir = fwd(path.resolve(args.dir));
  if (!fs.existsSync(targetDir)) throw new Error(`Not found: ${targetDir}`);
  const agyBin = findAgy(args.agyPath);

  const tag = args.tag || `report-${slugify(args.task)}-${Date.now()}`;
  fs.mkdirSync(WORKTREES_ROOT, { recursive: true });
  const copyPath = fwd(path.join(WORKTREES_ROOT, 'copies', tag));
  copyDirFiltered(targetDir, copyPath);

  const startTime = Date.now();
  const model = args.model || DEFAULT_MODEL;
  const agyArgs = buildAgyArgs({ task: args.task, scopedPath: copyPath, timeout: args.timeout, model, mode: args.mode || 'auto' });
  const logPath = path.join(WORKTREES_ROOT, `${tag}.log`);

  const run = invokeAgy({ agyBin, agyArgs, logPath, cwd: copyPath });

  const tripwire = computeTripwire(startTime);
  const agyJson = parseAgyResult(run);

  const cleanupError = safeRemoveDir(copyPath); // read-only — nothing to keep

  const ok = run.status === 0 && agyJson?.status !== 'ERROR' && tripwire.length === 0;
  const digest = {
    tag,
    targetDir,
    model,
    agyExitCode: run.status,
    response: agyJson?.response ?? null,
    agySummary: agyJson || { raw: (run.stdout || '').slice(0, 4000) },
    tripwire,
    cleanupError,
  };
  console.log(JSON.stringify(digest, null, 2));
  process.exit(ok ? 0 : 1);
}

function mergeDelegate(args) {
  if (!args.tag || !args.dir) {
    console.error('Usage: delegate.mjs merge --tag <name> --dir <project>');
    process.exit(2);
  }
  const targetDir = fwd(path.resolve(args.dir));
  const copyPath = fwd(path.join(WORKTREES_ROOT, 'copies', args.tag));
  if (!fs.existsSync(copyPath)) throw new Error(`Copy not found: ${copyPath}`);

  // If the real project changed after agy's snapshot was taken (someone
  // editing it by hand, or another delegated task on the same --dir), a file
  // this merge is about to write may now be stale in copyPath relative to
  // targetDir. Detected per-file below and skipped, not blindly overwritten.
  let snapshotTime = null;
  const metaFile = metaPathFor(copyPath);
  if (fs.existsSync(metaFile)) {
    try { snapshotTime = JSON.parse(fs.readFileSync(metaFile, 'utf8')).snapshotTime; } catch { }
  }

  const nameStatusRes = gitDiffNoIndex(targetDir, copyPath, ['--name-status']);
  if (nameStatusRes.error) {
    console.log(JSON.stringify({ tag: args.tag, targetDir, error: nameStatusRes.error, applied: [] }, null, 2));
    process.exit(1);
  }

  const applied = [];
  const conflicts = [];
  for (const line of nameStatusRes.stdout.trim().split('\n')) {
    if (!line) continue;
    const [status, p] = line.split('\t');
    const rel = relFrom(p, targetDir, copyPath);
    const dest = path.join(targetDir, rel);

    if (snapshotTime && fs.existsSync(dest)) {
      let destMtime = null;
      try { destMtime = fs.statSync(dest).mtimeMs; } catch { }
      if (destMtime && destMtime > snapshotTime) {
        conflicts.push(`${status} ${rel} - the real file changed after agy took its copy; NOT applied (to avoid overwriting that change); review by hand`);
        continue;
      }
    }

    if (status === 'D') {
      fs.rmSync(dest, { force: true });
    } else {
      const src = path.join(copyPath, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    applied.push(`${status} ${rel}`);
  }
  const cleanupError = safeRemoveDir(copyPath);
  fs.rmSync(metaFile, { force: true });
  console.log(JSON.stringify({ tag: args.tag, targetDir, applied, conflicts, cleanupError }, null, 2));
}

function discardDelegate(args) {
  if (!args.tag) {
    console.error('Usage: delegate.mjs discard --tag <name>');
    process.exit(2);
  }
  const copyPath = path.join(WORKTREES_ROOT, 'copies', args.tag);
  const cleanupError = safeRemoveDir(copyPath);
  fs.rmSync(metaPathFor(copyPath), { force: true });
  console.log(JSON.stringify({ discarded: args.tag, copyPath, cleanupError }, null, 2));
}

// Retries deleting leftover copy folders whose cleanup failed earlier
// (Windows file lock from some unrelated process — a build tool, an IDE
// language server — that has since let go). Only touches a copy whose
// <tag>.meta.json is already gone: merge/discard both delete that file as
// their last step, so its absence proves that task's lifecycle already
// finished and only the physical directory removal failed — never touches a
// copy still mid-task (meta.json present), including ones from another
// concurrent Claude session.
function cleanupDelegate() {
  const copiesRoot = path.join(WORKTREES_ROOT, 'copies');
  const cleaned = [];
  const stillLocked = [];
  const skippedActive = [];
  if (fs.existsSync(copiesRoot)) {
    for (const e of fs.readdirSync(copiesRoot, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const tag = e.name;
      const copyPath = path.join(copiesRoot, tag);
      if (fs.existsSync(metaPathFor(copyPath))) {
        skippedActive.push(tag); // task not finalized yet — leave it alone
        continue;
      }
      const err = safeRemoveDir(copyPath);
      if (err) {
        stillLocked.push({ tag, error: err });
      } else {
        cleaned.push(tag);
        // these are only useful while the copy exists to review against
        fs.rmSync(path.join(WORKTREES_ROOT, `${tag}.log`), { force: true });
        fs.rmSync(path.join(WORKTREES_ROOT, `${tag}.diff`), { force: true });
      }
    }
  }
  console.log(JSON.stringify({ cleaned, stillLocked, skippedActive }, null, 2));
}

const args = parseArgs(process.argv.slice(2));
if (args.action === 'run') runDelegate(args);
else if (args.action === 'report') reportDelegate(args);
else if (args.action === 'merge') mergeDelegate(args);
else if (args.action === 'discard') discardDelegate(args);
else if (args.action === 'cleanup') cleanupDelegate();
else {
  console.error('Unknown action. Use: run | report | merge | discard | cleanup');
  process.exit(2);
}