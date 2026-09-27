# Grok build worker

Local stdio MCP plugin that runs one-shot Grok Build jobs on the host.

**Tools:** `submit_job`, `status`, `fetch_artifacts`, `cancel_job`

**Version:** 1.1.5

## Install (public marketplace)

```bash
grok plugin marketplace add OTNworld/grok-plugins
grok plugin install grok-build-worker --trust
```

`--trust` starts a local MCP. Default job mode is `review_readonly` (no write). Pass `mode: "build"` for implement-and-write. See the repo [SECURITY.md](../../SECURITY.md).

Then enable the plugin if your config keeps plugins off by default (`[plugins].enabled` or the Plugins UI).

## MCP deps

The first start runs `npm ci --omit=dev` from `mcp/package-lock.json` via `mcp/run.sh`. Node.js 18+ and `npm` must be on PATH. Re-run happens only if `mcp/node_modules` is missing.

The `.mcp.json` runs:

```text
sh ${GROK_PLUGIN_ROOT}/mcp/run.sh
```

(`GROK_PLUGIN_ROOT` is the Grok loader path. `CLAUDE_PLUGIN_ROOT` remains the compatibility alias.)

## Skills

| Skill | Role |
|-------|------|
| `Grok build worker` | When/how to use the MCP rail |
| `Grok build CLI capabilities` | Profiles, flags, envelope; `tool_admin_cli` default **off** |

## Notes

- Jobs write artifacts under `<workspace>/jobs/<job_id>/` by default (`GROK_BUILD_JOBS_ROOT` overrides). Workspace is `/workspace` when that directory exists, otherwise the process cwd.
- `cwd` must stay under the workspace root (or `GROK_BUILD_CWD_ROOT`).
- Do **not** commit `node_modules`, secrets, or a fleet file with host IPs into this plugin.
- Cursor marketplace packaging is a separate, later path — this repo is for the **Grok CLI** marketplace.
