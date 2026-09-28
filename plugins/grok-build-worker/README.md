# Grok build worker

Local stdio MCP plugin that runs one-shot Grok Build jobs on the host.

**Tools:** `submit_job`, `status`, `fetch_artifacts`, `cancel_job`

**Version:** 1.5.2

## Install

```bash
grok plugin marketplace add OTNworld/grok-plugins
grok plugin install grok-build-worker --trust
```

`--trust` starts a local MCP. Default job mode is `review_readonly`. `build` uses host Grok permissions. `bypassPermissions` is rejected. See [SECURITY.md](../../SECURITY.md).

## Example

```json
{
  "name": "submit_job",
  "arguments": {
    "goal": "Review README.md for broken install commands. Do not write files.",
    "cwd": "/workspace",
    "mode": "review_readonly"
  }
}
```

Then `status` with the returned `job_id` until `done` / `failed` / `cancelled`. Then `fetch_artifacts`.

`cwd` must resolve under the workspace root (`/workspace` when that directory exists). `/tmp` is rejected unless `GROK_BUILD_CWD_ROOT` allows it.

## MCP start

`.mcp.json` runs `node ${GROK_PLUGIN_ROOT}/mcp/server.js`. Node 18+ only. No npm, no bundle.

Network at runtime: none. No plugin credentials.

## Skills

| Skill | Role |
|-------|------|
| `Grok build worker` | When/how to use the MCP rail |
| `Grok build CLI capabilities` | Profiles, flags, envelope |
| `Grok build worker artifacts` | `fetch_artifacts` receipt |
| `Grok build worker cancel` | Stop a running job |
| `Grok build worker cwd` | Workspace / UUID guards |
| `Grok build worker failed job` | failed / timeout / busy |

## Notes

- Jobs write artifacts under `<workspace>/jobs/<job_id>/` (`GROK_BUILD_JOBS_ROOT` overrides).
- `cwd` must stay under the workspace root (or `GROK_BUILD_CWD_ROOT`).
- One job at a time. A second `submit_job` returns `busy`.
- Do **not** commit `node_modules` or secrets.
