---
name: Grok build CLI capabilities
description: >-
  Use when composing a grok-build-worker submit_job: profiles, flags, and
  the job envelope.
---
# Grok build CLI capabilities

## Profiles

| id | Meaning | CLI |
|----|---------|-----|
| `review_readonly` | Review / explain, no writes | read tools only (default) |
| `plan_only` | Plan then stop | `--permission-mode plan` |
| `build` | Implement / fix | host Grok permissions |
| `worktree` | Isolated git worktree | `--worktree` (combines with a profile) |

`bypassPermissions` and `--always-approve` are not offered.

## Flags

`no_web` `no_subagents` `no_plan` `structured` `custom_model` `custom_effort` `max_turns` `sandbox` `custom_agent` `resume` `rules_extra`

## Envelope (optional prefix on `goal`)

```
[GROK_BUILD_ENVELOPE]
profile: review_readonly
flags: no_web
[/GROK_BUILD_ENVELOPE]

<objective>
```

Structured `submit_job` fields win over the envelope when both are set.
