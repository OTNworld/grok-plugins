---
name: Grok build worker cancel
description: >-
  Use to stop a running grok-build-worker job (cancel_job: SIGTERM then SIGKILL).
---
# Grok build worker cancel

## When
The job is `running` and the goal is wrong, stuck, or the user asked to stop.

## Call
`cancel_job` with the UUID `job_id`.

## Result
- `running` → SIGTERM, 2s grace, then SIGKILL → `cancelled`
- already settled → `{ status, note: "already done" }`
- unknown id → error

One job at a time. After cancel, a new `submit_job` is allowed.

## Rules
- Do not kill host processes yourself. Use `cancel_job`.
- Then `fetch_artifacts` if you need the partial receipt.
