---
name: Grok build worker failed job
description: >-
  Use when a grok-build-worker job is failed, cancelled, busy, missing grok,
  or status stays running too long.
---
# Grok build worker failed job

## Read first
`status` then `fetch_artifacts`. Use `exit_code`, `log_excerpt`, `error`.

## Common errors
| Signal | Meaning |
|---|---|
| `busy: job … still running` | One job at a time. `status` / `cancel_job` that id |
| `invalid job_id: expected a UUID` | Not a UUID |
| `cwd` / not under workspace | See cwd skill |
| `not offered` on permission_mode | `bypassPermissions` / `bypass` / `dontAsk` rejected |
| `grok binary missing` | Host has no `grok` at `GROK_BIN` or `~/.grok/bin/grok` |
| `goal is required` | Empty goal after envelope strip |
| `status=failed` + exit_code | Grok process exited non-zero |
| `status=running` long time | Still working, or dead pid (status heals to failed) |

## Rules
- Do not submit a second job while busy.
- Do not switch to `build` + nuclear mode to «unstick» a failure.
- Quote the receipt. Do not invent the cause.
