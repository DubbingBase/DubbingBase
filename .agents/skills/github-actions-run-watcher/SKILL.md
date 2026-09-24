---
name: github-actions-run-watcher
description: Wait efficiently for a GitHub Actions workflow run to finish before continuing. Use when you have a GitHub Actions run ID and need to wait for CI.
---

# GitHub Actions Run Watcher

Use this skill when you need to wait for a GitHub Actions workflow run to finish before continuing.

## Goal

Wait efficiently for a GitHub Actions run without repeatedly polling from the agent loop.

## Usage

Given a GitHub Actions run ID:

```bash
gh run watch "$RUN_ID" --exit-status --compact
```

## Behavior

- Prefer `gh run watch` over repeatedly calling `gh run view`.
- Always use `--exit-status` so the command exits non-zero when CI fails.
- Prefer `--compact` to reduce agent context and output noise.
- Do not manually poll unless the task specifically requires intermediate CI state.

If the run succeeds, continue with the next task.

If the run fails, retrieve only the failed logs:

```bash
gh run view "$RUN_ID" --log-failed
```

Then inspect the failure, fix the issue, and rerun the relevant workflow or checks.

## When to poll manually

Use:

```bash
gh run view "$RUN_ID" \
  --json status,conclusion \
  --jq '{status, conclusion}'
```

only when the agent needs to:

- react to intermediate states;
- manage multiple runs concurrently;
- implement custom timeout or backoff logic;
- integrate CI state into a larger event loop.

## Rule of thumb

- `wait for CI → continue` = `gh run watch`
- `reason about CI state while running` = `gh run view --json`
