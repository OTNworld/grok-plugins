# Security

`grok-build-worker` is a local stdio MCP. `grok plugin install … --trust` lets the CLI start that server on **your** machine.

## What the plugin can do

Default `mode` (1.1.2+) is `review_readonly`: read tools only, no `--permission-mode bypassPermissions`, no `--always-approve`.

`plan_only` is plan-scoped. `build` is the write job: it still runs `grok -p` with `--permission-mode bypassPermissions` and `--always-approve`. Pass `mode: "build"` only when you want that.

On first MCP start (1.1.3+), `mcp/run.sh` runs `npm ci --omit=dev` in `mcp/` if `node_modules` is missing. That uses only the shipped `package-lock.json`. It does not download extra scripts.

## Boundaries (1.1.1+)

- `job_id` must be a UUID. Path fragments are rejected.
- `cwd` must resolve under the workspace root (`/workspace` when that directory exists, otherwise `process.cwd()`), or under `GROK_BUILD_CWD_ROOT` if you set it.
- Job files go under `GROK_BUILD_JOBS_ROOT` when set, otherwise `<workspace>/jobs`.

## What we will not do

- No secrets, PATs, or host inventories in this repository.
- Do not open a PR that weakens the UUID / cwd guards without a matching SECURITY.md change.
- Do not restore bypass as the implicit default.
- Do not add a postinstall that fetches and executes remote code.

Report issues on the public repo. Do not attach credentials.
