# Security

`grok-build-worker` is a local stdio MCP. `grok plugin install … --trust` lets the CLI start that server on **your** machine.

## What the plugin can do

In default `build` mode the server runs `grok -p` with `--permission-mode bypassPermissions` and `--always-approve`. That is a full implement-and-write job on the resolved working directory.

`review_readonly` and `plan_only` are narrower. Pass `mode` explicitly when you do not want a write job.

## Boundaries (1.1.1+)

- `job_id` must be a UUID. Path fragments are rejected.
- `cwd` must resolve under the workspace root (`/workspace` when that directory exists, otherwise `process.cwd()`), or under `GROK_BUILD_CWD_ROOT` if you set it.
- Job files go under `GROK_BUILD_JOBS_ROOT` when set, otherwise `<workspace>/jobs`.

## What we will not do

- No secrets, PATs, or host inventories in this repository.
- Do not open a PR that weakens the UUID / cwd guards without a matching SECURITY.md change.

Report issues on the public repo. Do not attach credentials.
