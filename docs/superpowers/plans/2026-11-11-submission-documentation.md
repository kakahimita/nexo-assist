# Submission documentation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the README and submission documents accurately describe the delivered application and map every challenge requirement to its evidence.

**Architecture:** Documentation-only delivery on `feature/LAB-0010`. Correct merged-delivery statements first, add a standalone submission checklist with B/V evidence links, then rewrite the README around the delivered employee and analyst flows, and finish with a link/claim consistency pass.

**Tech Stack:** Markdown only; no application code or dependencies change.

**Spec:** `docs/superpowers/specs/2026-11-11-submission-documentation-design.md`

## Global Constraints

- Engineering documents in English; user-facing copy in Brazilian Portuguese.
- Evidence links are relative and stay inside the repository.
- Statuses come from `docs/challenge-acceptance.md` and the verification documents, never from current application output.
- Deterministic evidence is not live-model evidence; skipped visual checks are not marked passing.
- The private challenge reference bundle is unavailable in this checkout; visual rows stay partial.
- No application tests are required for this documentation-only delivery. Run the documentation checks listed in each task.
- Do not merge without explicit owner instruction.

## Review Focus

- A merged delivery must not be described as pending or in progress anywhere in the submission entry points.
- The README must not claim a feature that has no executed evidence, nor omit a delivered mandatory flow.
- Every checklist status must match its linked verification document, including partial and pending rows.
- Every relative link in README and the checklist must resolve in this checkout.
- B01–B18 and V01–V06 must each appear exactly once in the checklist.

---

### Task 0: Commit the approved design and plan

**Files:**
- Create: `docs/superpowers/specs/2026-11-11-submission-documentation-design.md`
- Create: `docs/superpowers/plans/2026-11-11-submission-documentation.md`

**Interfaces:**
- Consumes: owner approval of the design.
- Produces: the planning record on `feature/LAB-0010` for later tasks to cite.

- [ ] **Step 1: Commit the planning artifacts**

```bash
git add docs/superpowers/specs/2026-11-11-submission-documentation-design.md docs/superpowers/plans/2026-11-11-submission-documentation.md
git commit -m "docs: plan submission documentation alignment"
```

---

### Task 1: Correct merged-delivery statements

**Files:**
- Modify: `docs/challenge-context.md:158-160`
- Modify: `docs/chat-error-notifications-verification.md:3-5,53-61`
- Modify: `docs/roadmap.md:18`
- Modify: `docs/architecture.md:7`

**Interfaces:**
- Consumes: merge commit `1dfe64f`, PR #67, closed issues #65 and #68.
- Produces: truthful delivery-state sentences that later documentation can cite.

- [ ] **Step 1: Confirm the current stale sentences**

Run: `git log --oneline -1 main && rg -n "remains on branch|must disclose that mismatch|in-progress foundation|planned separately|not yet implemented" docs README.md`

Expected: `main` starts at `1dfe64f`; the listed phrases appear only where this task or Task 3 will correct them.

- [ ] **Step 2: Update `docs/challenge-context.md`**

Replace the #68 sentence

`It remains on branch \`feature/LAB-0065\` by owner request.`

with

`It was merged in [PR #67](https://github.com/kakahimita/nexo-assist/pull/67) on 2026-11-11, which closed [#65](https://github.com/kakahimita/nexo-assist/issues/65) and [#68](https://github.com/kakahimita/nexo-assist/issues/68).`

Also state the merge in the #65 paragraph at line 158, next to its existing behavior description.

- [ ] **Step 3: Update `docs/chat-error-notifications-verification.md`**

- Change the scope sentence to say the follow-up was kept on `feature/LAB-0065` and then merged in PR #67, instead of describing it as currently on that branch.
- Remove the Limits bullet beginning `The branch remains \`feature/LAB-0065\`` and replace it with a short merge record: `Merged in PR #67 at 1dfe64f on 2026-11-11; issues #65 and #68 were closed.`
- Keep the other limits unchanged.

- [ ] **Step 4: Update `docs/roadmap.md`**

After the #54/#49 tracking text in the introductory paragraph, add one sentence recording that #65 (thinking indicator) and #68 (chat error notifications) were merged in PR #67, with links to `thinking-indicator-verification.md` and `chat-error-notifications-verification.md`.

- [ ] **Step 5: Update `docs/architecture.md`**

Change `The in-progress foundation implements` to `The delivered foundation implements` only if the rest of that sentence describes the current application. If any part is still future work, leave the sentence and record why in the commit message.

- [ ] **Step 6: Verify no stale merge claims remain**

Run: `rg -n "remains on branch|must disclose that mismatch|in-progress foundation" docs`

Expected: no matches for the removed phrases.

- [ ] **Step 7: Commit**

```bash
git add docs/challenge-context.md docs/chat-error-notifications-verification.md docs/roadmap.md docs/architecture.md
git commit -m "docs: record merged chat delivery status"
```

---

### Task 2: Add the submission checklist

**Files:**
- Create: `docs/submission-checklist.md`

**Interfaces:**
- Consumes: `docs/challenge-acceptance.md`, all `docs/*-verification.md` files, and the status mapping below.
- Produces: the canonical requirement-to-evidence table linked from the README.

- [ ] **Step 1: Create the checklist header and status vocabulary**

The document opens with its scope, the date `2026-11-11`, a link to the acceptance matrix, and these definitions:

- **Demonstrated** — executed deterministic or browser evidence exists.
- **Partial** — some criteria or fidelity remain open.
- **Pending** — no executed evidence yet.
- **Not claimed** — outside the current delivery and explicitly disclosed.

Add a sentence that the checklist separates deterministic from live-provider evidence and does not mark skipped visual checks as passing.

- [ ] **Step 2: Add the behavioral acceptance table**

Use columns `ID | Requirement | Status | Evidence | Remaining gap` and these exact status decisions:

| ID | Status | Evidence document |
| --- | --- | --- |
| B01 | Demonstrated | `identity-history-verification.md` |
| B02 | Demonstrated deterministically | `agent-consultation-verification.md`, `natural-support-verification.md` |
| B03 | Demonstrated | `ticket-consultation-verification.md` |
| B04 | Partial | `conversational-drafts-verification.md` |
| B05 | Demonstrated | `ticket-verification.md` |
| B06 | Demonstrated | `ticket-verification.md` |
| B07 | Demonstrated deterministically | `ticket-verification.md`, `natural-support-verification.md` |
| B08 | Demonstrated | `ticket-verification.md` |
| B09 | Demonstrated | `human-handoff-verification.md` |
| B10 | Demonstrated | `human-handoff-verification.md`, `human-support-verification.md` |
| B11 | Demonstrated | `human-support-verification.md` |
| B12 | Demonstrated deterministically | `agent-consultation-verification.md`, `autonomous-resolution-verification.md` |
| B13 | Partial | `identity-history-verification.md`, `human-support-verification.md` |
| B14 | Demonstrated | `session-limit-verification.md`, `thinking-indicator-verification.md` |
| B15 | Demonstrated deterministically | `agent-consultation-verification.md`, `chat-error-notifications-verification.md` |
| B16 | Partial | `agent-consultation-verification.md`, `natural-support-verification.md` |
| B17 | Partial | `foundation-verification.md` |
| B18 | Pending | `challenge-acceptance.md` |

Remaining-gap text must state the actual open item, for example: B04 live draft reliability, B13 broader restart states, B16 live prompt-injection resistance, B17 clean-clone walkthrough, B18 interview walkthrough.

- [ ] **Step 3: Add the visual acceptance table**

Use columns `ID | Screen | Status | Evidence | Remaining gap` with all V01–V06 marked **Partial**. Cite `login-viewport-verification.md`, `employee-visual-verification.md`, `ticket-consultation-verification.md`, and `human-support-verification.md` where they apply. Each remaining-gap cell states that native Pencil exports and the private reference bundle are unavailable here and exact fidelity is not claimed.

- [ ] **Step 4: Add the submission gates table**

Use columns `Gate | Status | Evidence | Remaining`. Include:

| Gate | Status | Remaining |
| --- | --- | --- |
| Clean local setup with documented commands | Partial | Clean-clone walkthrough still pending |
| Deterministic checks without a model key | Demonstrated | CI run 43009162564 on `main` |
| Live evaluation record | Partial | #62 multi-turn gate pending; free-tier draft reliability limited |
| Mandatory flows, limitations, architecture, and trade-offs documented | Partial | README and architecture covered here; demo script remains |
| Demo script | Pending | Later #10 work |
| Interview walkthrough | Pending | Later #10 work |
| Deployment | Not claimed | Optional in the challenge and not delivered |

- [ ] **Step 5: Verify checklist completeness and links**

Run:

```bash
rg -o 'B[0-9]{2}' docs/submission-checklist.md | sort -u | wc -l
rg -o 'V0[1-6]' docs/submission-checklist.md | sort -u | wc -l
```

Expected: `18` and `6`.

Run:

```bash
python3 - <<'PY'
import pathlib, re, sys

missing = []
for name in ("README.md", "docs/submission-checklist.md"):
    source = pathlib.Path(name)
    for target in re.findall(r"\]\(([^)#]+\.md)(?:#[^)]*)?\)", source.read_text()):
        if target.startswith("http"):
            continue
        if not (source.parent / target).resolve().exists():
            missing.append(f"{source}: {target}")
print("\n".join(missing) if missing else "all links resolve")
sys.exit(1 if missing else 0)
PY
```

Expected: `all links resolve`.

- [ ] **Step 6: Commit**

```bash
git add docs/submission-checklist.md
git commit -m "docs: add submission requirements checklist"
```

---

### Task 3: Rewrite the README around delivered behavior

**Files:**
- Modify: `README.md:6-42` (status, stack, principles, documentation)
- Modify: `README.md:61-105` (setup and human-support statements)

**Interfaces:**
- Consumes: `docs/submission-checklist.md` from Task 2.
- Produces: an accurate submission entry point.

- [ ] **Step 1: Rewrite Current status**

Replace the paragraph at line 8 with a status that includes:

- demo login, isolated history, ticket consultation, confirmed drafts, and the session cap;
- message streaming and decision evidence;
- durable human handoff and the analyst console (queue, claim, reply, return, close);
- the employee conversations dashboard, measured login indicators, thinking state, and chat error notifications;
- the disclosed limits: live-model reliability under #10, partial visual fidelity under #9, and the absent private reference bundle.

Remove the sentence `Human support workflows and production authentication are not yet implemented.` Production authentication remains intentionally out of scope and is described under limits instead.

- [ ] **Step 2: Rename and update the stack section**

Rename `## Planned stack` to `## Stack` and keep only technologies that are implemented. Add one sentence that `packages/contracts` holds shared Zod schemas and wire types.

- [ ] **Step 3: Add Architecture and Trade-offs sections**

After `## Principles`, add:

- `## Architecture` — three short paragraphs or a compact list covering the Next.js web app, NestJS API, Mastra agent, the ticket-service interface, Prisma/SQLite, server-derived identity, and the backend ownership of authorization, confirmation, idempotency, and human ownership. Link `docs/architecture.md`.
- `## Trade-offs and limits` — one bullet each for demo authentication, SQLite, no paid fallback, deterministic fixture engine versus live evidence, partial visual fidelity, and the unavailable private reference bundle. Also state that deployment is optional and not delivered.

- [ ] **Step 4: Update setup and analyst instructions**

- Keep the three demo identities and explain that `analista@nexo.com.br` opens the analyst console.
- Replace `Analyst support workflows are planned separately.` with a short description of the queue, claim, reply, return, and close flow, and when a conversation appears there.
- Replace the paragraph saying a transfer request does not create a queue with the implemented behavior: handoff creates a waiting conversation, the analyst claims it, the agent stays paused, and explicit return resumes it.
- Replace `Human handoff and the analyst queue are not yet implemented.` with the current behavior and its limits.
- Keep the SLA, idempotency, duplicate-prevention, failure-retry, and model-key text unless a sentence is contradicted by delivered behavior.

- [ ] **Step 5: Add the checklist link and refresh documentation links**

Add `## Requirements checklist` with one sentence linking `docs/submission-checklist.md`.

Update `## Documentation` to include the acceptance matrix, architecture, roadmap, and the verification documents for identity/history, tickets, consultation, drafts, autonomous resolution, handoff, human support, session limit, login viewport, service metrics, employee visuals, thinking indicator, and chat errors. Keep the existing links that are still current.

- [ ] **Step 6: Verify README claims and structure**

Run: `rg -n "not yet implemented|planned separately|does not create an analyst queue|Remains|remains on branch" README.md`

Expected: no false current-state claims. The only remaining `not yet implemented` text may describe a genuinely future item, and it must name that item.

Run: `rg -n '^## ' README.md`

Expected: includes `Current status`, `Stack`, `Principles`, `Architecture`, `Trade-offs and limits`, `Documentation`, `Setup and model access`, and `Requirements checklist`.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: align README with delivered behavior"
```

---

### Task 4: Whole-delivery consistency pass

**Files:**
- Modify: `README.md` and `docs/*.md` only if the checks find a contradiction.
- Test: no application test file changes.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a branch that is ready for review.

- [ ] **Step 1: Check whitespace and conflict markers**

Run: `git diff --check main...HEAD`

Expected: no output.

- [ ] **Step 2: Verify all relative Markdown links**

Run:

```bash
python3 - <<'PY'
import pathlib, re, sys

missing = []
for name in ("README.md", "docs/submission-checklist.md"):
    source = pathlib.Path(name)
    for target in re.findall(r"\]\(([^)#]+\.md)(?:#[^)]*)?\)", source.read_text()):
        if target.startswith("http"):
            continue
        if not (source.parent / target).resolve().exists():
            missing.append(f"{source}: {target}")
print("\n".join(missing) if missing else "all links resolve")
sys.exit(1 if missing else 0)
PY
```

Expected: `all links resolve`. Report any external URL that could not be checked.

- [ ] **Step 3: Verify the stale-claim audit**

Run: `rg -n "remains on branch|must disclose that mismatch|planned separately|does not create an analyst queue" README.md docs`

Expected: no matches.

- [ ] **Step 4: Re-check the checklist against the acceptance matrix**

For every B01–B18 and V01–V06 row, confirm the status and gap match the linked verification document. Fix only contradictions; do not upgrade a status without new evidence.

- [ ] **Step 5: Review the complete diff**

Run: `git diff --stat main...HEAD && git diff main...HEAD`

Expected: only Markdown changes, no secrets, databases, generated output, or original challenge assets.

- [ ] **Step 6: Commit any fixes**

If the checks changed files:

```bash
git add README.md docs
git commit -m "docs: fix submission documentation consistency"
```

If no files changed, skip this commit.

- [ ] **Step 7: Push the branch and open the PR**

```bash
git push -u origin feature/LAB-0010
gh pr create --base main --head feature/LAB-0010 \
  --title "feature/LAB-0010: Align submission documentation with delivered behavior" \
  --body-file /tmp/opencode/lab-0010-pr.md
```

The PR body uses the repository template, `Refs #10` (not `Closes`, because the submission package remains incomplete), and a Brazilian Portuguese `## Como testar` section listing the documentation checks. Do not merge without owner instruction.
