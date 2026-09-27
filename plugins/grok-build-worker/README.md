# Grok build worker

Local stdio MCP plugin that runs one-shot Grok Build jobs on the host.

**Tools:** `submit_job`, `status`, `fetch_artifacts`, `cancel_job`

**Version:** 1.3.0

## Install

```bash
grok plugin marketplace add OTNworld/grok-plugins
grok plugin install grok-build-worker --trust
```

`--trust` starts a local MCP. Default job mode is `review_readonly`. `build` uses host Grok permissions. `bypassPermissions` is rejected. See [SECURITY.md](../../SECURITY.md).

## MCP start

`.mcp.json` runs `node ${GROK_PLUGIN_ROOT}/mcp/run.mjs`. First start runs `npm ci --omit=dev` from the shipped lockfile if `node_modules` is missing.

Network: npm registry on that first start only (`@modelcontextprotocol/sdk`, `zod`). No other endpoints. No plugin credentials.

## Skills

| Skill | Role |
|-------|------|
| `Grok build worker` | When/how to use the MCP rail |
| `Grok build CLI capabilities` | Profiles, flags, envelope |

## Notes

- Jobs write artifacts under `<workspace>/jobs/<job_id>/` (`GROK_BUILD_JOBS_ROOT` overrides).
- `cwd` must stay under the workspace root (or `GROK_BUILD_CWD_ROOT`).
- Do **not** commit `node_modules` or secrets.
