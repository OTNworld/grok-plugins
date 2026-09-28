---
name: Grok build worker artifacts
description: >-
  Use after a grok-build-worker job settles: fetch_artifacts receipt,
  diffstat, log excerpt, and where files live.
---
# Grok build worker artifacts

## When
`status` is `done`, `failed`, or `cancelled`. Or you need the receipt mid-run.

## Call
`fetch_artifacts` with the UUID `job_id` from `submit_job`.

## Receipt
- `status`, `exit_code`, `mode`, `cwd`, `goal`
- `log_excerpt` (last lines of `log.txt`)
- `diffstat` (`(cwd is not a git repo)` if no git)
- `paths`: `meta.json`, `log.txt`, `diffstat.txt`, `exit_code.txt`, `changed_paths.txt` plus up to 40 changed files

Job files live under `<workspace>/jobs/<job_id>/` or `GROK_BUILD_JOBS_ROOT`.

## Rules
- Re-read the artefact. Do not invent a diff.
- `job_id` must be a UUID. Path fragments are rejected.
