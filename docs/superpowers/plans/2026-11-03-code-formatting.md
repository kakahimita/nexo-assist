# Code Formatting Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt one pinned Prettier configuration, reformat supported code once without changing behavior, and reject future formatting drift in `npm run check`.

**Architecture:** Prettier runs from the repository root across npm workspaces, with generated output, private/local artifacts, Markdown, and `package-lock.json` excluded. Configuration lands before one isolated formatting-only commit; a later commit records that formatting revision for Git blame and documents the workflow.

**Tech Stack:** npm workspaces, Prettier 3.6.2, TypeScript, JSON, CSS, Git

**Spec:** `docs/superpowers/specs/2026-11-03-code-formatting-design.md`

## Global Constraints

- Pin Prettier exactly at `3.6.2`; use `printWidth: 100`, `singleQuote: true`, and `endOfLine: "auto"`.
- Do not change logic, behavior, names, or structure while formatting.
- Do not format Markdown or `package-lock.json`; dependency metadata may update only to install Prettier.
- Preserve the owner's existing uncommitted `AGENTS.md` and `apps/web/next-env.d.ts` changes.
- Keep one formatting-only commit so `.git-blame-ignore-revs` can name it exactly.
- Run deterministic checks without a provider key; live model smoke tests remain separate.

## Review Focus

- A fresh Windows checkout with CRLF working files must pass `npm run format:check` because `endOfLine` is `auto`.
- Generated and local directories (`node_modules`, `.next`, `dist`, Prisma client, coverage, browser artifacts, references, outputs, and work) must not be scanned or rewritten.
- Markdown and `package-lock.json` must remain outside the bulk formatting commit.
- The bulk commit must contain only whitespace, wrapping, quote, semicolon, and trailing-comma changes that Prettier produced.
- `npm run check` must fail when a supported tracked source file is intentionally made unformatted and pass after it is restored.

---

### Task 1: Formatter configuration and automated gate

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.editorconfig`
- Modify: `package.json`
- Modify: `package-lock.json`
- Include: `docs/superpowers/specs/2026-11-03-code-formatting-design.md`
- Include: `docs/superpowers/plans/2026-11-03-code-formatting.md`

**Interfaces:**
- Consumes: root npm workspace scripts and the existing `npm run check` chain.
- Produces: `npm run format`, `npm run format:check`, and the repository-wide editor settings used by Task 2.

- [ ] **Step 1: Verify the missing gate fails**

  Run `npm run format:check` and confirm it exits nonzero because the script does not exist.

- [ ] **Step 2: Install and pin the formatter**

  Run `npm install --save-dev --save-exact prettier@3.6.2` and confirm both package manifests record exactly `3.6.2`.

- [ ] **Step 3: Add root configuration**

  Add `.prettierrc.json` with the three values fixed by the spec. Add `.prettierignore` for dependencies, build/generated/test/local artifacts, all Markdown, documentation data, and `package-lock.json`. Add `.editorconfig` with UTF-8, two spaces, final newlines, trailing-whitespace trimming, and no line-ending override.

- [ ] **Step 4: Add npm scripts and the check gate**

  Add `format: "prettier --write ."` and `format:check: "prettier --check ."`; insert `npm run format:check` after lint in `check`.

- [ ] **Step 5: Verify the new gate detects the existing style**

  Run `npm run format:check` and confirm it exits nonzero while naming unformatted supported files.

- [ ] **Step 6: Commit configuration and planning artifacts**

  Stage only the seven named files and commit `chore: configure Prettier`.

### Task 2: Repository-wide mechanical formatting

**Files:**
- Modify: tracked `*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.mjs`, `*.cjs`, `*.css`, and root/workspace `*.json` files selected by Prettier
- Preserve separately: `apps/web/next-env.d.ts` owner-owned pre-existing content change

**Interfaces:**
- Consumes: the formatter commands and ignores from Task 1.
- Produces: exactly one formatting-only revision for Task 3 to ignore in blame.

- [ ] **Step 1: Apply the formatter once**

  Run `npm run format`. Keep the owner's `apps/web/next-env.d.ts` path change out of the formatting commit by staging the formatted `HEAD` content for that file, then restore the owner's working-tree content after the commit.

- [ ] **Step 2: Verify formatting and review the diff mechanically**

  Run `npm run format:check`, `git diff --check`, and inspect `git diff --stat` plus representative source/configuration diffs. Confirm no Markdown, lockfile, Prisma schema/migration, reference, generated, database, or artifact file is included.

- [ ] **Step 3: Commit only formatter output**

  Stage only supported tracked source/configuration files and commit `style: format source files`.

- [ ] **Step 4: Prove the gate catches regression**

  Temporarily make one tracked TypeScript file unformatted, confirm `npm run format:check` fails for it, restore it with `npm run format`, and confirm the worktree returns to the committed formatter output.

### Task 3: Blame support, documentation, and unchanged behavior

**Files:**
- Create: `.git-blame-ignore-revs`
- Modify: `docs/development-workflow.md`

**Interfaces:**
- Consumes: the exact `style: format source files` commit hash from Task 2.
- Produces: documented local blame configuration and final verification evidence.

- [ ] **Step 1: Record the formatting revision**

  Put the full Task 2 commit hash in `.git-blame-ignore-revs` with a short comment.

- [ ] **Step 2: Document formatter scope and blame setup**

  Add a concise section to `docs/development-workflow.md` explaining `npm run format`, `npm run format:check`, that Markdown and `package-lock.json` are excluded from bulk formatting, and `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

- [ ] **Step 3: Verify blame behavior**

  Configure the local blame ignore file and compare `git blame` with and without ignored revisions on a reformatted line; confirm the ignored view points to the pre-format author/revision.

- [ ] **Step 4: Run the full deterministic gate**

  Run `npm run check` and record stage/test counts. The unit baseline before formatting is 22 files and 126 tests; all stages must exit 0 and test counts must remain unchanged from the synchronized `main` baseline.

- [ ] **Step 5: Inspect delivery scope and references**

  Run `git diff --check`, verify the private reference manifest hashes again, and inspect commits/diffs to confirm the only source-wide change is the Task 2 formatter output.

- [ ] **Step 6: Commit blame metadata and workflow documentation**

  Stage only `.git-blame-ignore-revs` and `docs/development-workflow.md`; commit `docs: document formatting workflow`.
