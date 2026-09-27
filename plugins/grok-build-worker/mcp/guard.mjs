/**
 * Path / id guards for Grok build worker MCP.
 * Isolated so smoke tests can import without starting the server.
 */
import fs from "node:fs";
import path from "node:path";

export const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function defaultWorkspaceRoot() {
  if (fs.existsSync("/workspace")) {
    try {
      if (fs.statSync("/workspace").isDirectory()) return "/workspace";
    } catch {
      /* fall through */
    }
  }
  return process.cwd();
}

export function resolveJobsRoot(env = process.env) {
  const raw = env.GROK_BUILD_JOBS_ROOT;
  if (raw && String(raw).trim()) return path.resolve(String(raw).trim());
  return path.join(defaultWorkspaceRoot(), "jobs");
}

export function assertJobId(jobId) {
  if (typeof jobId !== "string" || !JOB_ID_RE.test(jobId)) {
    throw new Error("invalid job_id: expected a UUID");
  }
  return jobId.toLowerCase();
}

function uniqueRoots(roots) {
  const out = [];
  const seen = new Set();
  for (const root of roots) {
    const r = path.resolve(root);
    if (seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out;
}

export function allowedCwdRoots(env = process.env) {
  const roots = [defaultWorkspaceRoot()];
  const extra = env.GROK_BUILD_CWD_ROOT;
  if (extra && String(extra).trim()) roots.push(String(extra).trim());
  return uniqueRoots(roots);
}

export function isUnderRoot(resolved, root) {
  return resolved === root || resolved.startsWith(root + path.sep);
}

/**
 * Resolve submit_job cwd. Relative paths are resolved against the workspace root.
 * Absolute paths must stay under an allowed root (workspace, plus GROK_BUILD_CWD_ROOT).
 */
export function resolveWorkCwd(raw, env = process.env) {
  const base = defaultWorkspaceRoot();
  const candidate =
    raw == null || raw === ""
      ? base
      : path.isAbsolute(raw)
        ? raw
        : path.resolve(base, raw);
  const resolved = path.resolve(candidate);
  const roots = allowedCwdRoots(env);
  if (!roots.some((root) => isUnderRoot(resolved, root))) {
    throw new Error(`cwd not allowed: ${resolved}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`cwd not found: ${resolved}`);
  }
  return resolved;
}
