---
name: Grok build worker cwd
description: >-
  Use when submit_job cwd is rejected, or when choosing a workspace path
  for grok-build-worker (UUID and cwd guards).
---
# Grok build worker cwd

## cwd
Must resolve under the workspace root: `/workspace` if that directory exists,
otherwise `process.cwd()`. Override extra roots with `GROK_BUILD_CWD_ROOT`.

`/tmp` is rejected on a box that uses `/workspace` unless that env is set.

## job_id
UUID only. `../etc/passwd` and other path fragments → `invalid job_id: expected a UUID`.

## Jobs root
`<workspace>/jobs/<job_id>/`. Override with `GROK_BUILD_JOBS_ROOT`.

## Rules
- Never pass a cwd outside the workspace to «bypass» the guard.
- If cwd is rejected, pick a path under the workspace and retry. Do not disable the guard.
