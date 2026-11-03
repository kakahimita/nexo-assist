# Code formatting standardization

Issue: [#27](https://github.com/kakahimita/nexo-assist/issues/27). Status: awaiting
owner approval before implementation.

## Intent

The repository has no formatter and no formatting rule. Code is written in a
compact style: multi-property object literals and imports on one line, one-line
constructors and functions. 496 source lines exceed 120 characters, 123 exceed
200, and the longest is 1075. ESLint only enforces `no-explicit-any`, so each
file has drifted its own way.

The owner identified the compact style itself, not line endings or markdown
wrapping, as the problem. The fix is mechanical: one formatter, applied once
across the codebase, then enforced so the style cannot return.

## Goals

- One committed formatter configuration; no per-file style debates.
- Remove the compact style repo-wide in a formatting-only change.
- Block future drift through an automated check in `npm run check`.
- Keep `git blame` useful after the bulk reformat.

## Non-goals

- No logic, behavior, naming, or structure changes.
- No Markdown or `package-lock.json` reformatting in this increment.
- No line-ending normalization: the Windows working tree is CRLF and stays
  CRLF; the committed blobs are already LF.
- No pre-commit hook or CI workflow change beyond the existing `npm run check`.

## Anti-goals

- A partial reformat: applying the formatter only to new files would leave two
  styles side by side, which is half of the current complaint.
- A hand-written style guide without a tool: it would drift again.

## Approaches considered

| Approach | Trade-off | Decision |
| --- | --- | --- |
| Prettier, `printWidth: 100` | Standard, editor-agnostic, predictable; +73% lines (5.202 → 8.997), 88 files changed | **Chosen** |
| Prettier, `printWidth: 80` | Maximum readability, but +99% lines and nearly every function signature explodes to four lines | Rejected by owner |
| ESLint stylistic rules | Finer control, no new formatter dependency; but formatting-in-linter is deprecated, slower, and weaker editor integration | Rejected |
| Format only new or touched files | Small diff; leaves the existing compact code untouched | Rejected |

The owner compared real diffs generated from HEAD in temporary copies and chose
`printWidth: 100`.

## Decisions already made

- **Prettier 3.6.2, pinned exactly**, matching the project's exact-version policy.
- **`printWidth: 100`, `singleQuote: true`** to preserve the existing quote
  style. Without `singleQuote`, every string would flip to double quotes and
  inflate the diff.
- **`endOfLine: "auto"`.** Prettier's default `lf` would make
  `format:check` fail on a fresh Windows checkout, where `core.autocrlf=true`
  writes CRLF while the index stores LF.
- **`.prettierignore`** covers `node_modules`, build output, generated Prisma
  client, coverage, Playwright artifacts, local references/output/work, and
  `package-lock.json`.
- **`.editorconfig`** records indent size 2, UTF-8, final newline, and trailing
  whitespace trimming so other editors agree with Prettier.
- **Scripts:** `format` (`prettier --write .`) and `format:check`
  (`prettier --check .`); `format:check` is added to `npm run check` after lint.
- **`.git-blame-ignore-revs`** lists the formatting commit hash. The hash can
  only be added after that commit exists, in a follow-up commit on the same
  branch.
- **Scope:** `*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.mjs`, `*.cjs`, `*.css`,
  and root/workspace JSON configuration. Markdown is excluded for now.

## Rollout constraint

PR #26 (LAB-0024) is open and touches 53 files. This change must merge **after**
#26: reformatting first would turn its rebase into a conflict across nearly
every modified file. The branch can be prepared now and held.

## Verification

- `npm run format:check` exits 0 after the formatting commit.
- Typecheck, lint, unit, integration, build and browser stages pass with the
  same test counts as before the reformat.
- `git show --stat` on the formatting commit lists only source/configuration
  files, with no test or documentation content changes.
- `git config blame.ignoreRevsFile .git-blame-ignore-revs` followed by
  `git blame` on a reformatted line points at the original author and commit.

## Left to the implementer

- Exact `.prettierignore` glob list and `.editorconfig` section layout.
- Where the `format:check` step sits in `npm run check`.
- Whether the README or `docs/development-workflow.md` documents the
  `blame.ignoreRevsFile` command (one short paragraph, owner-facing).
