---
name: Grok build CLI capabilities
description: >-
  Use when a dispatcher composes a Grok build worker job: which grok CLI
  surfaces are allowed, how to map them to submit_job, and how to read
  enable/disable toggles from fleet/rails config. Defaults: job surface on;
  tool_admin_cli off.
---
# Grok build CLI capabilities

## When
You are about to call **Grok build worker** (`submit_job` / `status` / `fetch_artifacts`), or you are designing / updating that plugin. Read this before composing the job. Source of truth for on/off: fleet/rails config → `rails.build_worker.capabilities` (fall back to the defaults below if the key is missing).

## Mental model
The plugin is a **thin async wrapper** around `grok` headless (`grok -p` / `grok agent`) plus optional surfaces when enabled. Prefer covering the job/CLI flags the dispatcher needs; use fleet toggles when an **owner** wants to lock something down.

**`tool_admin_cli` defaults to off** (plugin/marketplace/mcp/login/doctor/update wrappers). Flip it on in fleet only when the owner wants remote ops on that VM.

Today the live MCP only accepts `goal`, `cwd`, `mode` (plus optional structured fields when the server supports them). Until the plugin accepts structured flags everywhere, encode constraints in the **job envelope** (prepended to `goal`) and set `mode` to the profile id.

## Capability table

Each key is a toggle in fleet/rails config. `true` = dispatcher may use it; `false` = never offer, never pass.

### Job profiles (pick one per `submit_job`)

| id | What it means | grok CLI shape (target) |
|----|----------------|-------------------------|
| `build` | Implement / fix / refactor one-shot | `-p`; host permission defaults |
| `review_readonly` | Explain / review / find bugs, no writes | read/search tools only |
| `plan_only` | Plan then stop | `--permission-mode plan` |
| `worktree` | Isolated git worktree | `--worktree` [name]; optional `--worktree-ref` |

Default profile is `review_readonly`. `worktree` combines with another profile.

### Session / output flags (orthogonal) — default on

| id | Effect |
|----|--------|
| `no_web` | `--disable-web-search` |
| `no_subagents` | `--no-subagents` / deny `Agent` |
| `no_plan` | `--no-plan` |
| `structured` | `--output-format json` / `--json-schema` |
| `custom_model` | `-m` / `--model` |
| `custom_effort` | `--reasoning-effort` |
| `max_turns` | `--max-turns N` |
| `sandbox` | `--sandbox <profile>` |
| `custom_agent` | `--agent <name|path>` |
| `resume` | `-c` / `-r` |
| `rules_extra` | `--rules` |

### MCP tools

| id | Tool | Default |
|----|------|---------|
| `tool_submit_job` | `submit_job` | on |
| `tool_status` | `status` | on |
| `tool_fetch_artifacts` | `fetch_artifacts` | on |
| `tool_cancel` | `cancel_job` | on |
| `tool_admin_cli` | admin wrappers (`plugin`, `mcp`, `doctor`, …) | **off** |

If `tool_submit_job` is false, this rail is dead: tell the owner, do not invent a substitute.

### Defaults (when fleet omits the block)

```yaml
capabilities:
  profiles:
    build: true
    review_readonly: true
    plan_only: true
    worktree: true
  flags:
    no_web: true
    no_subagents: true
    no_plan: true
    structured: true
    custom_model: true
    custom_effort: true
    max_turns: true
    sandbox: true
    custom_agent: true
    resume: true
    rules_extra: true
  tools:
    tool_submit_job: true
    tool_status: true
    tool_fetch_artifacts: true
    tool_cancel: true
    tool_admin_cli: false
```

## Job envelope (until plugin accepts structured args)

1. Choose one enabled profile → `mode` = that id.
2. Collect flags the task needs (skip only if fleet sets that flag to false).
3. Prepend:

```
[GROK_BUILD_ENVELOPE]
profile: <id>
flags: <comma-separated flags used, or none>
model: <id or default>
effort: <level or default>
max_turns: <n or default>
worktree: <name|omit>
worktree_ref: <ref|omit>
sandbox: <profile|omit>
agent: <name|omit>
resume: <session id|continue|omit>
rules: |
  <extra rules if any>
success_criteria: |
  <bullet list the dispatcher will re-check after fetch_artifacts>
[/GROK_BUILD_ENVELOPE]

<user-facing objective in plain language>
```

4. `cwd` = repo path. 5. `status` → `fetch_artifacts` → prove. Done = job succeeded and you re-read the artefact.

## Hard rules for the dispatcher
- Prefer the full **job** surface; refuse only when fleet sets a key to `false`.
- Never call admin_cli tools unless `tool_admin_cli: true` in fleet.
- Never flip capabilities by rewriting this skill; edit fleet/rails config.
- Never clone the repo on the bot box as a substitute for this rail.

## Plugin evolution (for the packager)
Target `submit_job` fields (additive): `goal`, `cwd`, `mode`, `flags[]`, `model`, `effort`, `max_turns`, `worktree`, `worktree_ref`, `sandbox`, `agent`, `resume`, `rules`, `json_schema`, `permission_mode`, `tools_allow`, `tools_deny`.
Expose `cancel_job`. Expose admin thin tools **only** when capability / fleet allows (default off).
Capability off → hard error. Envelope = fallback for older servers.
