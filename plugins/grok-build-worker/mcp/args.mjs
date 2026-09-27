/**
 * Pure argv builder + envelope parser for Grok build worker MCP.
 * Kept separate so smoke tests can import without starting the MCP server.
 */

export const REVIEW_READONLY_TOOLS =
  "read_file,grep,list_dir";

/** Best-effort write/shell tools to block when review_readonly defaults apply. */
export const REVIEW_READONLY_DISALLOWED =
  "search_replace,run_terminal_cmd,run_terminal_command";

const ENVELOPE_RE =
  /\[GROK_BUILD_ENVELOPE\]([\s\S]*?)\[\/GROK_BUILD_ENVELOPE\]/;

/**
 * Parse [GROK_BUILD_ENVELOPE]...[/GROK_BUILD_ENVELOPE] key: value lines.
 * Returns stripped goal (envelope removed) and a flat envelope object.
 */
export function parseEnvelope(goal) {
  if (typeof goal !== "string" || !goal.includes("[GROK_BUILD_ENVELOPE]")) {
    return { goal: goal ?? "", envelope: {} };
  }
  const m = goal.match(ENVELOPE_RE);
  if (!m) {
    return { goal, envelope: {} };
  }
  const envelope = {};
  for (const line of m[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key) envelope[key] = value;
  }
  const stripped = (
    goal.slice(0, m.index) + goal.slice(m.index + m[0].length)
  )
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
  return { goal: stripped, envelope };
}

function toCsv(v) {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) {
    const parts = v.map((x) => String(x).trim()).filter(Boolean);
    return parts.length ? parts.join(",") : null;
  }
  const s = String(v).trim();
  return s || null;
}

function hasFlag(flags, id) {
  return Array.isArray(flags) && flags.includes(id);
}

function parseFlagsValue(raw) {
  if (raw == null || raw === "") return undefined;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMaybeNumber(raw) {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Merge structured submit_job fields with envelope fallbacks.
 * Structured values win when present (non-null / non-undefined).
 */
export function resolveJobOptions(input) {
  const { goal: strippedGoal, envelope } = parseEnvelope(input.goal ?? "");
  const env = envelope;

  const pick = (structured, ...envKeys) => {
    if (structured !== undefined && structured !== null && structured !== "") {
      return structured;
    }
    for (const k of envKeys) {
      if (env[k] !== undefined && env[k] !== null && env[k] !== "") {
        return env[k];
      }
    }
    return undefined;
  };

  let mode = input.mode;
  if (mode === undefined || mode === null || mode === "") {
    mode = env.profile || env.mode || "review_readonly";
  }

  let flags = input.flags;
  if (flags === undefined || flags === null) {
    flags = parseFlagsValue(env.flags) || [];
  } else {
    flags = parseFlagsValue(flags) || [];
  }
  const model = pick(input.model, "model");
  const effort = pick(input.effort, "effort", "reasoning_effort");
  const max_turns =
    input.max_turns !== undefined && input.max_turns !== null
      ? parseMaybeNumber(input.max_turns)
      : parseMaybeNumber(env.max_turns);

  let worktree;
  if (input.worktree !== undefined && input.worktree !== null) {
    worktree = String(input.worktree);
  } else if (env.worktree !== undefined) {
    worktree = String(env.worktree);
  }

  const worktree_ref = pick(input.worktree_ref, "worktree_ref", "ref");
  const sandbox = pick(input.sandbox, "sandbox");
  const agent = pick(input.agent, "agent");
  const resume = pick(input.resume, "resume");
  const rules = pick(input.rules, "rules");
  const json_schema = pick(input.json_schema, "json_schema");
  const permission_mode = pick(input.permission_mode, "permission_mode");
  const tools_allow =
    input.tools_allow !== undefined && input.tools_allow !== null
      ? input.tools_allow
      : env.tools_allow;
  const tools_deny =
    input.tools_deny !== undefined && input.tools_deny !== null
      ? input.tools_deny
      : env.tools_deny;
  const output_format = pick(input.output_format, "output_format");

  return {
    goal: strippedGoal,
    cwd: input.cwd,
    mode,
    flags,
    model,
    effort,
    max_turns,
    worktree,
    worktree_ref,
    sandbox,
    agent,
    resume,
    rules,
    json_schema,
    permission_mode,
    tools_allow,
    tools_deny,
    output_format,
  };
}

/**
 * Build argv for `grok` (without the binary path).
 * Always includes `-p <goal>` and `--cwd <cwd>`.
 *
 * @param {object} opts resolved options (see resolveJobOptions)
 * @returns {string[]}
 */
export function buildGrokArgs(opts) {
  const mode = opts.mode || "review_readonly";
  const flags = Array.isArray(opts.flags) ? opts.flags : [];
  const args = [];

  if (opts.goal == null || opts.goal === "") {
    throw new Error("buildGrokArgs: goal is required");
  }
  if (!opts.cwd) {
    throw new Error("buildGrokArgs: cwd is required");
  }

  args.push("-p", opts.goal);
  args.push("--cwd", opts.cwd);

  const wantStructured =
    hasFlag(flags, "structured") ||
    (opts.json_schema != null && opts.json_schema !== "");
  let outputFormat = opts.output_format;
  if (outputFormat == null || outputFormat === "") {
    outputFormat = wantStructured ? "json" : "plain";
  }
  args.push("--output-format", outputFormat);

  const NUCLEAR_PERM = new Set(["bypassPermissions", "bypass", "dontAsk"]);
  const permOverride =
    opts.permission_mode != null && opts.permission_mode !== ""
      ? String(opts.permission_mode)
      : null;
  if (permOverride && NUCLEAR_PERM.has(permOverride)) {
    throw new Error(
      "permission_mode " + permOverride + " is not offered by this plugin"
    );
  }

  if (mode === "plan_only") {
    args.push("--permission-mode", permOverride || "plan");
  } else if (mode === "review_readonly") {
    if (permOverride) {
      args.push("--permission-mode", permOverride);
    }
  } else if (permOverride) {
    args.push("--permission-mode", permOverride);
  }

  if (hasFlag(flags, "no_web")) args.push("--disable-web-search");
  if (hasFlag(flags, "no_subagents")) args.push("--no-subagents");
  if (hasFlag(flags, "no_plan")) args.push("--no-plan");

  const worktreeFieldSet =
    opts.worktree !== undefined && opts.worktree !== null;
  if (hasFlag(flags, "worktree") || worktreeFieldSet) {
    if (worktreeFieldSet && String(opts.worktree).length > 0) {
      args.push("--worktree", String(opts.worktree));
    } else {
      args.push("--worktree");
    }
    if (opts.worktree_ref) {
      args.push("--worktree-ref", String(opts.worktree_ref));
    }
  }

  if (opts.sandbox) {
    args.push("--sandbox", String(opts.sandbox));
  }

  if (opts.model) args.push("-m", String(opts.model));
  if (opts.effort) args.push("--reasoning-effort", String(opts.effort));
  if (opts.max_turns != null && opts.max_turns !== "") {
    args.push("--max-turns", String(opts.max_turns));
  }
  if (opts.agent) args.push("--agent", String(opts.agent));

  if (opts.resume === "continue") {
    args.push("-c");
  } else if (opts.resume) {
    args.push("-r", String(opts.resume));
  }

  if (opts.rules) args.push("--rules", String(opts.rules));

  if (opts.json_schema) {
    args.push("--json-schema", String(opts.json_schema));
  }

  let toolsAllow = toCsv(opts.tools_allow);
  let toolsDeny = toCsv(opts.tools_deny);

  if (mode === "review_readonly") {
    if (!toolsAllow) toolsAllow = REVIEW_READONLY_TOOLS;
    if (
      (opts.tools_deny === undefined || opts.tools_deny === null) &&
      !toolsDeny
    ) {
      toolsDeny = REVIEW_READONLY_DISALLOWED;
    }
  }

  if (toolsAllow) args.push("--tools", toolsAllow);
  if (toolsDeny) args.push("--disallowed-tools", toolsDeny);

  return args;
}
