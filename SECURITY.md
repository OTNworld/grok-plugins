# Security

`grok-build-worker` is a local stdio MCP. `grok plugin install … --trust` lets the CLI start that server on **your** machine.

## What the plugin can do

Default `mode` is `review_readonly`: read tools only.

`plan_only` is plan-scoped (`--permission-mode plan`). `build` uses the host Grok permission defaults. The plugin never emits `--always-approve`. `permission_mode` values `bypassPermissions`, `bypass`, and `dontAsk` are rejected.

Runtime is `node mcp/server.js`. No npm, no third-party MCP SDK. Stdio is MCP NDJSON (legacy Content-Length still accepted).

## Network

- Runtime: local `node` + local `grok`. No telemetry endpoint. No npm registry.

## Credentials

None. The plugin does not read `~/.ssh`, `.env`, or tokens to send them anywhere. `--trust` only attaches the local MCP.

## Boundaries

- `job_id` must be a UUID. Path fragments are rejected.
- `cwd` must resolve under the workspace root (`/workspace` when that directory exists, otherwise `process.cwd()`), or under `GROK_BUILD_CWD_ROOT` if you set it.
- Job files go under `GROK_BUILD_JOBS_ROOT` when set, otherwise `<workspace>/jobs`.

## What we will not do

- No secrets, PATs, or host inventories in this repository.
- Do not open a PR that weakens the UUID / cwd guards without a matching SECURITY.md change.
- Do not restore bypass / `--always-approve` on any profile.
- Do not add a postinstall that fetches and executes remote code.
- No hooks.json.

Report issues on https://github.com/OTNworld/grok-plugins. Do not attach credentials.
