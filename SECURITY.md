# Security

`grok-build-worker` is a local stdio MCP. `grok plugin install … --trust` lets the CLI start that server on **your** machine.

## What the plugin can do

Default `mode` (1.1.2+) is `review_readonly`: read tools only, no `--permission-mode bypassPermissions`, no `--always-approve`.

`plan_only` is plan-scoped. `build` is the write job: it still runs `grok -p` with `--permission-mode bypassPermissions` and `--always-approve`. Pass `mode: "build"` only when you want that.

On first MCP start (1.1.6+), `mcp/run.mjs` runs `npm ci --omit=dev` in `mcp/` if `node_modules` is missing. That uses only the shipped `package-lock.json`. It does not download extra scripts.

## Network

- First start only: `npm ci` talks to the npm registry for the two lockfile packages (`@modelcontextprotocol/sdk`, `zod`).
- After that: local `node` + local `grok`. No telemetry endpoint.

## Credentials

None. The plugin does not read `~/.ssh`, `.env`, or tokens to send them anywhere. `--trust` only attaches the local MCP.

## Boundaries (1.1.1+)

- `job_id` must be a UUID. Path fragments are rejected.
- `cwd` must resolve under the workspace root (`/workspace` when that directory exists, otherwise `process.cwd()`), or under `GROK_BUILD_CWD_ROOT` if you set it.
- Job files go under `GROK_BUILD_JOBS_ROOT` when set, otherwise `<workspace>/jobs`.

## What we will not do

- No secrets, PATs, or host inventories in this repository.
- Do not open a PR that weakens the UUID / cwd guards without a matching SECURITY.md change.
- Do not restore bypass as the implicit default.
- Do not add a postinstall that fetches and executes remote code.
- No hooks.json (no session shell hooks).

Report issues on https://github.com/OTNworld/grok-plugins. Do not attach credentials.
