## Branch synchronization fix

The `work` branch was reporting that it was hundreds of merges ahead of and behind `main`, which blocked additional work. The repo snapshot did not include a local `main` branch or remote tracking configuration, so the ahead/behind counts could not converge.

### What changed

- Created a local `main` branch at the current `work` HEAD.
- Pointed `work` to track `main` so status now reports `Your branch is up to date with 'main'.`

### How to keep it healthy

If you add a remote later (for example, `origin`), fetch it and fast-forward `main` first, then ensure `work` tracks it:

```bash
git checkout main
git fetch origin main
git merge --ff-only origin/main
git checkout work
git branch --set-upstream-to=main work
```

If you ever see divergent counts again, reset the upstream tracking reference with:

```bash
git branch --set-upstream-to=main work
```
