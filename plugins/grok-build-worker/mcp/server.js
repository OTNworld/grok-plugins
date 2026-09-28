#!/usr/bin/env node
/**
 * Grok build worker — local stdio MCP for Grok Build jobs on this VM.
 * Tools: submit_job, status, fetch_artifacts, cancel_job. One job at a time.
 * Artifacts live under <workspace>/jobs/<job_id>/ (GROK_BUILD_JOBS_ROOT overrides).
 */
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildGrokArgs, resolveJobOptions } from "./args.mjs";
import { assertJobId, defaultWorkspaceRoot, resolveJobsRoot, resolveWorkCwd } from "./guard.mjs";
import { jsonResult, serveMcp } from "./mcp-stdio.mjs";

const JOBS_ROOT = resolveJobsRoot();
const GROK_BIN = process.env.GROK_BIN || path.join(process.env.HOME || "", ".grok/bin/grok");
const LOCK_PATH = path.join(JOBS_ROOT, ".lock");
const LOG_MAX_LINES = 80;
const CANCEL_GRACE_MS = 2000;

fs.mkdirSync(JOBS_ROOT, { recursive: true });

function jobDir(id) {
  return path.join(JOBS_ROOT, assertJobId(id));
}

function readMeta(id) {
  const p = path.join(jobDir(id), "meta.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeMeta(id, meta) {
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

function clearLockIfJob(id) {
  try {
    if (!fs.existsSync(LOCK_PATH)) return;
    const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    if (lock.job_id === id) fs.unlinkSync(LOCK_PATH);
  } catch {}
}

function activeLock() {
  if (!fs.existsSync(LOCK_PATH)) return null;
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    const meta = readMeta(lock.job_id);
    if (meta && meta.status === "running") {
      if (meta.pid) {
        try {
          process.kill(meta.pid, 0);
          return lock;
        } catch {
          meta.status = "failed";
          meta.finished_at = new Date().toISOString();
          meta.exit_code = meta.exit_code ?? 1;
          writeMeta(lock.job_id, meta);
          try { fs.unlinkSync(LOCK_PATH); } catch {}
          return null;
        }
      }
      return lock;
    }
    try { fs.unlinkSync(LOCK_PATH); } catch {}
    return null;
  } catch {
    try { fs.unlinkSync(LOCK_PATH); } catch {}
    return null;
  }
}

function excerptLog(id, maxLines = 20) {
  const logPath = path.join(jobDir(id), "log.txt");
  if (!fs.existsSync(logPath)) return "";
  const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/);
  return lines.slice(-maxLines).join("\n").slice(0, 4000);
}

function writeDiffArtifacts(id, workCwd, beforeSha) {
  const dir = jobDir(id);
  let isGit = false;
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: workCwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    isGit = true;
  } catch {
    isGit = false;
  }
  if (!isGit) {
    fs.writeFileSync(path.join(dir, "diffstat.txt"), "(cwd is not a git repo)\n");
    fs.writeFileSync(path.join(dir, "changed_paths.txt"), "");
    return;
  }
  try {
    const args = beforeSha
      ? ["diff", "--stat", beforeSha]
      : ["diff", "--stat", "HEAD"];
    const ds = execFileSync("git", args, {
      cwd: workCwd,
      encoding: "utf8",
      maxBuffer: 2_000_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    fs.writeFileSync(path.join(dir, "diffstat.txt"), ds.slice(0, 50_000));
  } catch {
    fs.writeFileSync(path.join(dir, "diffstat.txt"), `(no git diffstat)\n`);
  }
  try {
    const args = beforeSha
      ? ["diff", "--name-only", beforeSha]
      : ["diff", "--name-only", "HEAD"];
    const names = execFileSync("git", args, {
      cwd: workCwd,
      encoding: "utf8",
      maxBuffer: 2_000_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    fs.writeFileSync(path.join(dir, "changed_paths.txt"), names);
  } catch {
    fs.writeFileSync(path.join(dir, "changed_paths.txt"), "");
  }
}

function finalizeJob(id, code, workCwd, beforeSha) {
  const m = readMeta(id) || { job_id: id };
  if (m.status === "cancelled") {
    if (!fs.existsSync(path.join(jobDir(id), "diffstat.txt"))) {
      writeDiffArtifacts(id, workCwd || m.cwd || defaultWorkspaceRoot(), beforeSha || "");
    }
    clearLockIfJob(id);
    return;
  }
  writeDiffArtifacts(id, workCwd, beforeSha);
  m.status = code === 0 ? "done" : "failed";
  m.exit_code = code;
  m.finished_at = new Date().toISOString();
  writeMeta(id, m);
  fs.writeFileSync(path.join(jobDir(id), "exit_code.txt"), String(code));
  clearLockIfJob(id);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killJobProcess(pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
}

function forceKillJobProcess(pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
}

async function cancelJob(job_id) {
  const meta = readMeta(job_id);
  if (!meta) {
    return { ok: false, error: `unknown job_id: ${job_id}` };
  }
  if (meta.status !== "running") {
    return {
      ok: true,
      job_id,
      status: meta.status,
      note: "already done",
    };
  }

  const pid = meta.pid;
  if (pid) {
    killJobProcess(pid);
    await sleep(CANCEL_GRACE_MS);
    if (pidAlive(pid)) {
      forceKillJobProcess(pid);
      await sleep(300);
    }
  }

  const beforeShaPath = path.join(jobDir(job_id), "before_sha.txt");
  let beforeSha = "";
  try {
    if (fs.existsSync(beforeShaPath)) {
      beforeSha = fs.readFileSync(beforeShaPath, "utf8").trim();
    }
  } catch {}

  const workCwd = meta.cwd || defaultWorkspaceRoot();
  writeDiffArtifacts(job_id, workCwd, beforeSha);

  const m = readMeta(job_id) || meta;
  m.status = "cancelled";
  m.exit_code = m.exit_code != null && m.exit_code !== 0 ? m.exit_code : 1;
  m.finished_at = new Date().toISOString();
  writeMeta(job_id, m);
  fs.writeFileSync(path.join(jobDir(job_id), "exit_code.txt"), String(m.exit_code));
  clearLockIfJob(job_id);

  return { ok: true, job_id, status: "cancelled" };
}

function truncateArgv(argv, maxLen = 2000) {
  if (!Array.isArray(argv)) return undefined;
  const s = JSON.stringify(argv);
  if (s.length <= maxLen) return argv;
  return {
    truncated: true,
    length: argv.length,
    preview: s.slice(0, maxLen),
  };
}

function boundedReceipt(id) {
  const dir = jobDir(id);
  const meta = readMeta(id) || {};
  const logPath = path.join(dir, "log.txt");
  let log_excerpt = "";
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/);
    log_excerpt = lines.slice(-LOG_MAX_LINES).join("\n");
    if (log_excerpt.length > 12000) log_excerpt = log_excerpt.slice(-12000);
  }
  let diffstat = "";
  const dsPath = path.join(dir, "diffstat.txt");
  if (fs.existsSync(dsPath)) diffstat = fs.readFileSync(dsPath, "utf8").slice(0, 4000);

  const paths = [];
  for (const name of ["meta.json", "log.txt", "diffstat.txt", "exit_code.txt", "changed_paths.txt"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) paths.push(p);
  }
  const changedPath = path.join(dir, "changed_paths.txt");
  if (fs.existsSync(changedPath)) {
    for (const p of fs.readFileSync(changedPath, "utf8").trim().split(/\r?\n/).filter(Boolean).slice(0, 40)) {
      paths.push(p);
    }
  }
  return {
    job_id: id,
    status: meta.status || "unknown",
    goal: meta.goal,
    cwd: meta.cwd,
    mode: meta.mode,
    started_at: meta.started_at,
    finished_at: meta.finished_at,
    exit_code: meta.exit_code ?? null,
    argv: truncateArgv(meta.argv),
    diffstat,
    log_excerpt,
    paths: [...new Set(paths)].slice(0, 60),
  };
}

function startJob(raw) {
  const lock = activeLock();
  if (lock) {
    return { ok: false, error: `busy: job ${lock.job_id} still running` };
  }
  if (!fs.existsSync(GROK_BIN)) {
    return { ok: false, error: `grok binary missing: ${GROK_BIN}` };
  }

  const resolved = resolveJobOptions(raw);
  if (!resolved.goal) {
    return { ok: false, error: "goal is required (empty after envelope strip)" };
  }

  let workCwd;
  try {
    workCwd = resolveWorkCwd(resolved.cwd);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }

  const job_id = randomUUID();
  const dir = jobDir(job_id);
  fs.mkdirSync(dir, { recursive: true });

  let beforeSha = "";
  try {
    beforeSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: workCwd,
      encoding: "utf8",
    }).trim();
    fs.writeFileSync(path.join(dir, "before_sha.txt"), beforeSha + "\n");
  } catch {
    fs.writeFileSync(path.join(dir, "before_sha.txt"), "");
  }

  const argvOpts = { ...resolved, cwd: workCwd };
  let args;
  try {
    args = buildGrokArgs(argvOpts);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }

  const started_at = new Date().toISOString();
  const meta = {
    job_id,
    status: "running",
    goal: resolved.goal,
    goal_raw: raw.goal,
    cwd: workCwd,
    mode: resolved.mode || "review_readonly",
    flags: resolved.flags || [],
    options: {
      model: resolved.model ?? null,
      effort: resolved.effort ?? null,
      max_turns: resolved.max_turns ?? null,
      worktree: resolved.worktree ?? null,
      worktree_ref: resolved.worktree_ref ?? null,
      sandbox: resolved.sandbox ?? null,
      agent: resolved.agent ?? null,
      resume: resolved.resume ?? null,
      rules: resolved.rules ?? null,
      json_schema: resolved.json_schema ?? null,
      permission_mode: resolved.permission_mode ?? null,
      tools_allow: resolved.tools_allow ?? null,
      tools_deny: resolved.tools_deny ?? null,
      output_format: resolved.output_format ?? null,
    },
    argv: args,
    started_at,
    finished_at: null,
    exit_code: null,
    pid: null,
  };
  writeMeta(job_id, meta);
  fs.writeFileSync(LOCK_PATH, JSON.stringify({ job_id, started_at }, null, 2));

  const logPath = path.join(dir, "log.txt");
  const outFd = fs.openSync(logPath, "w");

  const child = spawn(GROK_BIN, args, {
    cwd: workCwd,
    env: {
      ...process.env,
      PATH: `${path.dirname(GROK_BIN)}:${process.env.PATH || ""}`,
    },
    stdio: ["ignore", outFd, outFd],
    detached: true,
  });
  fs.closeSync(outFd);
  meta.pid = child.pid;
  writeMeta(job_id, meta);
  child.unref();

  child.on("exit", (code, signal) => {
    finalizeJob(job_id, code == null ? (signal ? 1 : 0) : code, workCwd, beforeSha);
  });
  child.on("error", (err) => {
    try {
      fs.appendFileSync(logPath, `\nspawn error: ${err.message}\n`);
    } catch {}
    finalizeJob(job_id, 127, workCwd, beforeSha);
  });

  return { ok: true, job_id };
}

const TOOLS = [
  {
    name: "submit_job",
    description:
      "Queue one async Grok Build job on this VM. Returns {job_id}. One job at a time.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string" },
        cwd: { type: "string" },
        mode: { type: "string", enum: ["build", "review_readonly", "plan_only"] },
        flags: { type: "array", items: { type: "string" } },
        model: { type: "string" },
        effort: { type: "string" },
        max_turns: { type: "number" },
        worktree: { type: "string" },
        worktree_ref: { type: "string" },
        sandbox: { type: "string" },
        agent: { type: "string" },
        resume: { type: "string" },
        rules: { type: "string" },
        json_schema: { type: "string" },
        permission_mode: { type: "string" },
        tools_allow: {},
        tools_deny: {},
        output_format: { type: "string" },
      },
      required: ["goal"],
    },
    handler(params) {
      const result = startJob(params);
      if (!result.ok) return jsonResult({ error: result.error }, true);
      return jsonResult({ job_id: result.job_id });
    },
  },
  {
    name: "status",
    description: "Job status plus a short log excerpt.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
    handler({ job_id }) {
      job_id = assertJobId(job_id);
      const meta = readMeta(job_id);
      if (!meta) return jsonResult({ error: `unknown job_id: ${job_id}`, status: "failed" }, true);
      if (meta.status === "running" && meta.pid) {
        try { process.kill(meta.pid, 0); }
        catch {
          finalizeJob(job_id, 1, meta.cwd || defaultWorkspaceRoot(), "");
          Object.assign(meta, readMeta(job_id) || {});
        }
      }
      return jsonResult({
        job_id,
        status: meta.status,
        excerpt: excerptLog(job_id, 20),
        started_at: meta.started_at,
        finished_at: meta.finished_at,
        exit_code: meta.exit_code ?? null,
        mode: meta.mode,
        argv: truncateArgv(meta.argv),
      });
    },
  },
  {
    name: "fetch_artifacts",
    description: "Bounded receipt: diffstat, log excerpt, artifact paths.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
    handler({ job_id }) {
      job_id = assertJobId(job_id);
      if (!readMeta(job_id)) return jsonResult({ error: `unknown job_id: ${job_id}` }, true);
      return jsonResult(boundedReceipt(job_id));
    },
  },
  {
    name: "cancel_job",
    description: "Cancel a running job. SIGTERM then SIGKILL.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
    async handler({ job_id }) {
      job_id = assertJobId(job_id);
      const result = await cancelJob(job_id);
      if (!result.ok) return jsonResult({ error: result.error }, true);
      return jsonResult({ job_id: result.job_id, status: result.status, note: result.note });
    },
  },
];

serveMcp({ name: "Grok build worker", version: "1.5.2", tools: TOOLS });
