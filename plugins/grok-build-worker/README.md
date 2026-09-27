# Grok build worker

Local stdio MCP plugin that runs one-shot Grok Build jobs on the host.

**Tools:** `submit_job`, `status`, `fetch_artifacts`, `cancel_job`

**Version:** 1.4.0

## Install

```bash
grok plugin marketplace add OTNworld/grok-plugins
grok plugin install grok-build-worker --trust
```

`--trust` starts a local MCP. Default job mode is `review_readonly`. `build` uses host Grok permissions. `bypassPermissions` is rejected. See [SECURITY.md](../../SECURITY.md).

## MCP start

`.mcp.json` runs `node ${GROK_PLUGIN_ROOT}/mcp/dist/server.mjs`. Runtime needs Node 18+ only. Sources stay in `mcp/*.js`; `dist/server.mjs` is the committed bundle (`npm run build`).

Network at runtime: none. Dev/CI may use npm to rebuild the bundle. No plugin credentials.

## Skills

| Skill | Role |
|-------|------|
| `Grok build worker` | When/how to use the MCP rail |
| `Grok build CLI capabilities` | Profiles, flags, envelope |

## Notes

- Jobs write artifacts under `<workspace>/jobs/<job_id>/` (`GROK_BUILD_JOBS_ROOT` overrides).
- `cwd` must stay under the workspace root (or `GROK_BUILD_CWD_ROOT`).
- Do **not** commit `node_modules` or secrets.
