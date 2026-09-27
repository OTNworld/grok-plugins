# Security

`grok-build-worker` is a local stdio MCP. `grok plugin install … --trust` lets the CLI start that server on **your** machine.

## What the plugin can do

Default `mode` (1.1.2+) is `review_readonly`: read tools only, no `--permission-mode bypassPermissions`, no `--always-approve`.

`plan_only` is plan-scoped. `build` is the write job: it still runs `grok -p` with `--permission-mode bypassPermissions` and `--always-approve`. Pass `mode: "build"` only when you want that.

## Boundaries (1.1.1+)

- `job_id` must be a UUID. Path fragments are rejected.
- `cwd` must resolve under the workspace root (`/workspace` when that directory exists, otherwise `process.cwd()`), or under `GROK_BUILD_CWD_ROOT` if you set it.
- Job files go under `GROK_BUILD_JOBS_ROOT` when set, otherwise `<workspace>/jobs`.

## What we will not do

- No secrets, PATs, or host inventories in this repository.
- Do not open a PR that weakens the UUID / cwd guards without a matching SECURITY.md change.
- Do not restore bypass as the implicit default.

Report issues on the public repo. Do not attach credentials.
