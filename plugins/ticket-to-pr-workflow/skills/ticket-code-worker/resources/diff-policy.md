# Diff Policy

After implementation, collect:

- `git diff --stat`
- `git diff --name-only`
- `git diff`
- Untracked files reported by `git status`

Exclude `.agent-runs/` artifacts from product-code diff analysis. Do not paste a
long full diff into reports.

Write:

- `diff-summary.md` with branch, totals, file status, and concise reasons
- `changed-files.json` with ticket key, path, change type, and reason

Treat added and deleted line totals as the diff line count used by risk
detection. Binary files must be identified without attempting text analysis.
