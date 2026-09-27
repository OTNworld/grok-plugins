# Security

`grok-build-worker` is a local stdio MCP. `grok plugin install … --trust` lets the CLI start that server on **your** machine.

## What the plugin can do

Default `mode` is `review_readonly`: read tools only.

`plan_only` is plan-scoped (`--permission-mode plan`). `build` uses the host Grok permission defaults. The plugin never adds `--permission-mode bypassPermissions` or `--always-approve` by itself. Pass `permission_mode` only if you want an explicit override.

On first MCP start, `mcp/run.mjs` runs `npm ci --omit=dev` in `mcp/` if `node_modules` is missing. That uses only the shipped `package-lock.json`.

## Network

- First start only: `npm ci` talks to the npm registry for the two lockfile packages (`@modelcontextprotocol/sdk`, `zod`).
- After that: local `node` + local `grok`. No telemetry endpoint.

## Credentials

None. The plugin does not read `~/.ssh`, `.env`, or tokens to send them anywhere. `--trust` only attaches the local MCP.

## Boundaries

- `job_id` must be a UUID. Path fragments are rejected.
- `cwd` must resolve under the workspace root (`/workspace` when that directory exists, otherwise `process.cwd()`), or under `GROK_BUILD_CWD_ROOT` if you set it.
- Job files go under `GROK_BUILD_JOBS_ROOT` when set, otherwise `<workspace>/jobs`.

## What we will not do

- No secrets, PATs, or host inventories in this repository.
- Do not open a PR that weakens the UUID / cwd guards without a matching SECURITY.md change.
- Do not restore implicit bypass / `--always-approve` on any profile.
- Do not add a postinstall that fetches and executes remote code.
- No hooks.json.

Report issues on https://github.com/OTNworld/grok-plugins. Do not attach credentials.
