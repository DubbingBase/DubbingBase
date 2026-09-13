---
name: codesight-ci-owned
description: Keep generated Codesight context owned by the self-updating GitHub Action; use when working with Codesight, .codesight files, or commits and pull requests that may contain them.
---

# Codesight CI ownership

The `.codesight/` tree is generated context. The self-updating GitHub Action is the only authorized writer of generated Codesight output.

For human-authored work:

- Never run `codesight --wiki` locally.
- Never edit, format, rename, delete, regenerate, stage, commit, cherry-pick, or merge generated `.codesight/**` files.
- Never create or push a human-authored branch or pull request containing `.codesight/**` changes. Generated changes made by the GitHub Actions bot are the sole exception.
- A deliberate change to `.github/workflows/codesight.yml` is allowed when changing the automation; do not include generated output with that change.
- Stage explicit paths instead of using broad commands such as `git add .` or `git add -A` when generated files may be present.

Before committing or opening a pull request, verify that the human-authored diff contains no generated Codesight paths:

```bash
git diff --cached --name-only | grep -E '^\.codesight/'
git diff origin/main...HEAD --name-only | grep -E '^\.codesight/'
```

Both checks must produce no output. If generated files are modified or staged locally, leave their contents unchanged, unstage them with `git restore --staged -- .codesight` when needed, and report the state rather than committing them. If refreshed context is required, change the source or workflow and let the GitHub Action generate and commit it.
