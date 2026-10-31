# Development workflow

Use **issue → branch → implementation → pull request → review → merge**.

## Entry and branches

Reuse or create a bounded issue with problem, outcome, acceptance criteria,
and dependencies. Broad work has a parent and smaller delivery issues.
Planning is #2; application implementation starts in #3.

GitHub's generated README established the initial base branch. This one-time
bootstrap contains no application code. All subsequent changes use delivery PRs.

Start from current `main`, preserving local changes. Issue #12 uses
`feature/LAB-0012`: pad to at least four digits, without truncating larger numbers.
All change types use `feature/`; labels describe the change type.
Use small imperative English commits. Each increment leaves existing behavior working.

## Pull requests

Use `.github/pull_request_template.md` and the title
`feature/LAB-0012: <English summary>`. Target `main`, assign the responsible
developer, and choose a label matching the change type.
Use `Closes #12` only when all acceptance criteria are complete, and `Refs #1`
for the unfinished parent. Record incomplete criteria explicitly.
Write `## Como testar` in Brazilian Portuguese and other sections in English.

Run relevant checks and inspect the final diff. Documentation does not require
application tests when no application exists. The foundation establishes
reproducible automated checks before feature work.

## Review and merge

Review correctness, scope, privacy, architecture, and relevant tests. Record
the reviewed revision and findings. Fix on the same branch and rerun affected
checks. A draft PR is reviewable work, not a completed delivery.
Opening a PR does not authorize merge; merge only on explicit owner instruction.
Require PRs and successful CI through branch protection when the account supports
it; written guidance alone does not enforce these requirements.

## Learning

Explain each increment and its trade-offs. Support a small practical change or
walkthrough at the owner's pace. Do not replace collaborative work with a large
unexplained implementation.
