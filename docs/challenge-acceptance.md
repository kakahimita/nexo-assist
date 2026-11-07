# Challenge acceptance and test matrix

The [#62 natural support interpretation](natural-support-verification.md) tracks
semantic proposal provenance and the separate real-model conversational gate for
B02/B04/B07/B09–B16. Deterministic success is not live conversational acceptance.

The [#60 login viewport refinement](login-viewport-verification.md) records bounded
desktop no-scroll checks and continued narrow-screen access for V01.

The owner's [#58 functional metrics extension](service-metrics-verification.md)
adds measured V01 login indicators, explicit employee resolution confirmation and
expiring analyst presence. These supersede the design's sample numbers without
changing the original reference assets.

The [#52 autonomous-resolution correction](autonomous-resolution-verification.md) records bounded B02/B04/B07/B09–B13/B15–B16 regression coverage and sampled real-model browser evidence. It does not replace the original sources or establish exhaustive live reliability or visual acceptance.

Status: requirements; foundation B17 evidence is recorded in [foundation verification](foundation-verification.md). Identity and conversation-history evidence for #4, including its limits, is recorded in [identity and history verification](identity-history-verification.md). Full B13, B16 and visual acceptance remain broader than this increment. Other rows remain planned unless independently demonstrated.
Partial ticket-service evidence for #5 is recorded in [ticket verification](ticket-verification.md): B03 only for authorized list/detail, B04-B08 and B15 partially or fully as described there, and the ticket portions of B13/B16. Deterministic consultation and decision-evidence checks merged in PR #20 are recorded in [agent consultation verification](agent-consultation-verification.md); the first live model evaluation failed two ticket-selection scenarios and the six-case rerun passed after correction; broader live reliability and prompt-injection resistance (#10), human handoff (#8), human support at the session limit (#8) and full visual acceptance (#9) remain outstanding.
The #23 session-limit increment and its partial B14 evidence are documented in [session limit verification](session-limit-verification.md); human support at the cap remains #8.
The #24 conversational ticket-draft increment is recorded in [conversational drafts verification](conversational-drafts-verification.md): confirmed create/supplement/reopen, edit/cancel, duplicate candidates and draft-reference persistence are demonstrated deterministically (B04, B05, B07, B12, B13, partial B14, partial B16); the live model draft flow fails three of four scenarios, so issue #24 stays open and broader live reliability remains #10.
The employee-side handoff core for #8 is recorded in [human handoff verification](human-handoff-verification.md): deterministic B09 triggers, waiting-state persistence and stale-output rejection are covered.
The analyst console for #8 is recorded in [human support verification](human-support-verification.md): B11 (queue, atomic claim, reply, return, close) and the analyst portions of B10/B13/B15 are demonstrated deterministically; V04/V05 visual fidelity remains #9.
The bounded [#40](https://github.com/kakahimita/nexo-assist/issues/40) queue refinement is recorded in the same verification: explicit loading, empty, error and retry states; filter request ordering; semantic summary cards; keyboard selection; and 1440 x 900 / 375 x 812 overflow checks passed deterministically. Captures were compared against V04's Pencil frame `x2HBOE` and the verified secondary guide. Search, counts, unread/presence indicators, ticket references, V05 and full visual fidelity remain outside this increment.
The [#42](https://github.com/kakahimita/nexo-assist/issues/42) owned-conversation refinement is recorded in the same verification: ownership-aware controls, race-safe selection, per-conversation drafts, honest failed/partial writes, role-distinct messages, authorized ticket context, and 1567 x 900 / 1440 x 900 / 375 x 812 layout checks passed deterministically against isolated databases. The `npm run check` run covered 64 Chromium tests. Captures were compared with V05's Pencil frame `CAqx8` and the verified secondary guide; the disclosed shell, composer, ticket-panel and typography differences remain, and exact V05 fidelity is not claimed. Live-model checks were not run.
The [#46](https://github.com/kakahimita/nexo-assist/issues/46) console layout follow-up replaces the oversized analyst page header with a compact rail and places the queue, conversation, and authorized ticket context in distinct desktop regions. A V05 capture at 1567 x 900 was compared with the verified secondary guide; the 375 x 812 stacking check exposed and then verified a ticket-panel ordering correction. Full visual acceptance remains outstanding.
The analyst-console visual pass (part of [#9](https://github.com/kakahimita/nexo-assist/issues/9)) aligns V04/V05 with Pencil frames `x2HBOE` and `CAqx8`: a 64 px icon rail with a real queue badge, 380 px queue cards with pastel avatars, a 40 px conversation header, day dividers, white/blue/green bubbles with role badges, a takeover bar, a circular send action and a 340 px ticket panel with computed open/closed counts. Executed evidence: `npm run typecheck`, `npm run lint`, `npm test` (173), `npm run build` and `npm run test:e2e` (74) passed. Captures at 1440 x 900 and 1567 x 900 were inspected against the secondary V04/V05 guides, and the 375 x 812 overflow checks passed. Disclosed differences: the illustrative presence chip, unread badges, the `Com o agent` filter, the ticket-panel close/CTA and employee department are not implemented because the product has no data for them; the handoff summary card remains because the PRD requires the summary. Exact native-export pixel fidelity is not claimed.
The [#48](https://github.com/kakahimita/nexo-assist/issues/48) employee shell follow-up removes the employee's direct conversation-history and ticket-management navigation, resumes the latest persisted conversation inside Atendimento, and adds an honest read-only V06 password area. Browser checks cover keyboard navigation between chat and profile, automatic conversation restoration, conversational ticket drafts and consultation, and mobile overflow. The retired standalone ticket-view browser tests are superseded by conversation-flow browser tests and backend ticket integration tests. V02/V03/V06 layout comparison remains partial; prototype-only data and exact native-export pixel fidelity are not claimed.
The V03 continuation removes permanent new-conversation and analyst controls from the initial chat, makes ticket rows one-click selections with server-owned status colors, shows human contact contextually after a completed single-ticket response, and places the composer in the 1440 x 900 chat footer. The isolated `npm run check` passed, including 64 Chromium tests; the capture comparison and remaining differences are recorded in [employee visual verification](employee-visual-verification.md). Full V03 fidelity remains open under #9.
The owner-approved [#64](https://github.com/kakahimita/nexo-assist/issues/64) follow-up supersedes only that earlier permanent-action premise: Atendimento now has `Minhas conversas` and `Nova conversa`, while `Falar com o Nexo Assist` remains absent. Browser coverage verifies that the dashboard lists server-authorized employee tickets and conversation summaries, restores a selected chat, blocks new creation during human ownership, and has no horizontal overflow at 375 px. It does not establish original-frame fidelity because the private reference bundle is unavailable in this checkout.
The in-progress #9 employee layout uses the original Pencil frames' 232 px desktop sidebar and a responsive stacked navigation. Chromium covers keyboard navigation, preservation of unsent text and narrow-screen overflow. Desktop (1440×900) profile and narrow-screen (375×812) support screenshots were inspected against the owner-supplied secondary V02/V06 guides. The shared layout is closer, but chat content, ticket controls, profile details and other screens still differ; full visual and accessibility acceptance remain outstanding. Native Pencil exports are unavailable for exact pixel comparison.

Issue #50 adds a decorative initials avatar derived from the server-provided signed-in employee name and a top-bar availability label. The sidebar account block now follows the Pencil `i4fCbC` frame: a 34 px initials avatar, the employee name and e-mail in a 52 px row, and a full-width `Sair` action with the lucide `log-out` icon below. “Assistente online” is a defined API-readiness result: it appears only after `/api/ready` validates the initialized API/database; loading and unavailable results remain textual, and unavailable provides retry. It does not represent model-provider availability or human presence. After syncing `origin/main` (LAB-0046) and restoring the worktree dependencies, the relative `/api` proxy base was connected to readiness (proxy allowlist and client URL validation) and the availability locators were corrected. Executed evidence: `npm run typecheck`, `npm run lint`, `npm test` (173), `npm run test:integration` (62), `npm run build`, and `npm run test:e2e` (74) passed. Desktop 1440×900 and 375×812 captures were inspected against the verified V03/V06 secondary guides; the account block matches the `.pen` geometry within 1 px and no horizontal overflow occurs. Exact native-export comparison is still not claimed.
The in-progress V02/V03 conversation increment presents employee and agent messages distinctly and places the composer beside its send button. Chromium checks keyboard submission, the message counter and desktop/mobile overflow; desktop (1440×900) and mobile (390×844) screenshots were inspected against the owner-supplied secondary guides. Conversation history controls, ticket/draft cards, exact composition and other screen states still differ from the original, so visual acceptance remains partial.
The conversational V02 draft card now distinguishes a pending confirmation, groups the server-provided details and separates its actions. Chromium checks the pending state, affected scope, narrow-screen overflow and actual confirmation; desktop (1440×900) and mobile (375×812) screenshots were inspected against the secondary V02 guide. The standalone ticket panel, consultation cards, exact screen composition and other visual states remain outstanding.
The chat ticket-consultation card and automatic overdue transfer for [#36](https://github.com/kakahimita/nexo-assist/issues/36) (part of #9) are recorded in [ticket consultation verification](ticket-consultation-verification.md): B03 and B09 are demonstrated by deterministic and browser tests. The follow-up [#38](https://github.com/kakahimita/nexo-assist/issues/38) adds server-owned category/creation metadata, the status badge, the amber last update, and a responsive legacy fallback; B03, B13, B16 and partial V03 evidence is recorded in the same document. Live-model reliability (#10) and the remaining differences from Screen 3 listed there stay outstanding.
The [#49](https://github.com/kakahimita/nexo-assist/issues/49) ticket number and status follow-up adds a server-generated number per type (`INC-…`/`REQ-…`), five persisted statuses, and the V03 card with number, description and deadline. Evidence is recorded in [ticket consultation verification](ticket-consultation-verification.md) and [human support verification](human-support-verification.md): B03, B09, B11 and B13 are demonstrated deterministically, while the broader visual acceptance under #9 and live-model reliability under #10 remain open.
The [#54](https://github.com/kakahimita/nexo-assist/issues/54) analyst follow-up gives the V05 handoff summary card a 100 px collapsed area with `Ver mais`/`Ver menos`, keyboard support and `aria-expanded`; expansion keeps the card in its grid row without overlapping messages. [Human support verification](human-support-verification.md) records a green `npm run check` (181 unit, 63 integration, 76 Chromium) and the before/collapsed/expanded captures. Full V05 visual fidelity remains under #9.
Read the [context](challenge-context.md), original sources through the
[reference index](challenge-references.md), and [architecture](architecture.md)
before implementing a row. Page numbers below refer to the original PRD v5.
Rows apply to all relevant roadmap deliveries, not only final submission.

## Behavioral acceptance

| ID | Source | Observable result to verify | Planned verification |
| --- | --- | --- | --- |
| B01 | p2, Login; p4, Privacy | A fixture employee can log in; unknown identities cannot impersonate fixtures or read another employee's data. | Server-session and cross-employee API/tool integration tests; browser login. Nonempty passwords are a project convention. |
| B02 | p1, Employee story 1; p4, Annex B | An applicable article answers a question without creating a ticket. VPN error 809 guidance for Windows 10 is not applied to Windows 11. | Controlled retrieval/tool tests with both OS versions and absent OS information. |
| B03 | p1, Employee story 2; p5, Screen 3 | An employee without a ticket number gets an authorized selection or clarification, then accurate status and deadline. No guessed ticket or other employee data. | Zero, one, multiple, ambiguous, nonexistent, and unauthorized ticket cases. |
| B04 | p4, Opening; p5, Screen 2 | Missing title, description, type, category, priority, or affected scope is collected; the displayed draft is confirmed before a write. | Domain/API and browser tests for missing facts, confirm, edit, cancel, and a stale approval. Version enforcement is a project safeguard. |
| B05 | p1, Story 3; p4, No duplicates | The same open problem receives a confirmed supplement; no duplicate is created. Retried writes and double confirmation commit once. | Database integration tests, including lost response after commit. Operation IDs are a project safeguard. |
| B06 | p4, No duplicates | A resolved ticket can reopen within seven days; outside that window it cannot use the reopening operation. | Fixed-clock boundary tests. Exactly seven elapsed calendar days inclusive follows the documented convention. |
| B07 | p4, Types, Categories, Priority | Incidents and requests use the correct type/category; impact and urgency determine priority; missing facts cause clarification. | Table-driven rule cases for all four priorities and incomplete/contradictory information. |
| B08 | p4, Priority and deadlines; Annex B | First-response and update deadlines are correct; overdue status uses elapsed/business time as appropriate. | Clock-controlled unit tests at business opening/closing, weekends, exact deadline, and overdue boundary. Use architecture conventions explicitly. |
| B09 | p4, Transfer; p2, item 5 | Employee request, critical incident, overdue ticket, or unresolved uncertainty leads to a durable handoff with summary and reason. | Each trigger independently; absent facts first cause safe clarification where appropriate. Prototype offers do not override Annex A. |
| B10 | p2, items 5-6; p1, Analyst story 3 | The agent is silent while waiting or assigned; only explicit return resumes it. Ownership survives restart and stale in-flight output is discarded. | Handoff during generation, restart, reconnect, elapsed waiting time, and new-session cases. State/version checks are project safeguards. |
| B11 | p2, Console; p5, Screens 4-5 | Analysts can filter/select a conversation, read context, claim, reply, return, and close. An unassigned analyst cannot reply as the owner. | Browser employee/analyst flow plus concurrent claims and role/ownership integration tests. Atomicity is a project safeguard. |
| B12 | p2, Visibility of decisions | Each answer exposes interpreted intent, actual actions/results, declared confidence, evidence, and a readable explanation. No success badge appears for a failed operation. | Controlled successful/failed tool outcomes and browser expansion of details; live model evaluations separately. |
| B13 | p2, Persistence; p1, Story 6 | Conversation, messages, tickets, and human/agent state are restored after restart. | Integration/browser restart tests with agent, waiting, and assigned states, without replaying writes. |
| B14 | p2, Employee chat | Responses arrive in real time and the 30-message session cap is enforced. | Streaming/browser tests and backend limit tests. Use the architecture's accepted-employee-message counting; controls do not count. |
| B15 | p1, Legacy service; p2, Good practices | Temporary ticket failures produce bounded recovery or an honest error without fabricated success or duplicate writes. | Controlled transient failures, exhaustion, and successful commit followed by transport failure. Human care remains usable during model quota exhaustion. |
| B16 | p4, Privacy and Scope; p2, Security | Non-IT subjects are redirected, other employee data stays inaccessible, and untrusted input/articles cannot override permissions. | Domain/API/tool tests, including forged identity arguments and instructions embedded in retrieved content. |
| B17 | p2, Technical requirements; p3, Delivery | Strict types, separated services, few setup commands, `.env.example`, and an accurate README make a clean local run reproducible. | Foundation typecheck/lint/test/build and clean-setup checks, with no real model key required in CI; independent live smoke evidence. |
| B18 | p3, Evaluation and AI usage | The owner can explain the decisions, quality evidence, trade-offs, and a small live code change. | Submission walkthrough and demonstrable behavior; optional deployment is recorded separately. |

## Visual acceptance

Frame IDs refer to `originals/nexo.pen` in the local bundle. `screens/` paths
are relative to that bundle. The owner supplied replacement images rendered
at 3x from `.pen` data through HTML/CSS. Five PNGs are 4320 x 2700; V05 is
4701 x 2700. They are readable secondary guides, not native Pencil exports.

| ID | PRD / frame | Reference image | Verify in the application |
| --- | --- | --- | --- |
| V01 | p5, Screen 1 / `bi8Au` | `screens/01-login.png` | Split introduction/login layout, identity fields, primary action, feedback and keyboard access. |
| V02 | p5, Screen 2 / `IcuoM` | `screens/02-ticket-draft.png` | Employee navigation, conversation, action evidence, quick options, draft, confirm/edit/cancel, composer and counter. |
| V03 | p5, Screen 3 / `vbsNW` | `screens/03-ticket-consultation.png` | Authorized ticket selection, detail card, overdue indicator, supplement and human-support actions. |
| V04 | p5, Screen 4 / `x2HBOE` | `screens/04-analyst-queue.png` | Navigation rail, filtered conversation list, waiting history, claim action, disabled composer and ticket context. |
| V05 | p5, Screen 5 / `CAqx8` | `screens/05-analyst-owned.png` | Assigned analyst state, enabled reply, return/close controls, ownership event and ticket panel. |
| V06 | Additional frame / `i4fCbC` | `screens/06-profile.png` | Basic read-only profile under the agreed architecture. Password-reset delivery is outside the current scope. |

Use `.pen` geometry, fonts, tokens, and layout properties for exact design
values. Five frames are 1440 x 900; V05 is 1567 x 900. Compare layout at the
matching viewport, then verify keyboard behavior and narrow-screen adaptation.
Check loading, empty, error, quota, waiting, closed, and reconnect states as
project acceptance, even where the static prototype does not show them.

The supplied provenance README discloses possible typography and spacing
differences and no comparison against the native editor. Use the 3x images
for readable content and composition checks; use `.pen` as the visual authority.
Exact pixel-level assertions still require native Pencil exports or comparison
against the editor. Preserve the source images without resizing, and record
renderer, scale, and hashes. The previous low-resolution snapshot is archived
outside the active bundle; do not use its thumbnails for detailed UI checks.

## Evidence rules

- Give each relevant test or evaluation its B/V IDs and PRD page/frame source.
  Expected outcomes come from the requirement and disclosed conventions, not
  from whatever the application currently returns.
- Assert actual tool results and persisted state. Agent text and confidence
  alone do not demonstrate that an action happened or was correct.
- Keep original sources immutable. Put app screenshots and test output under
  `outputs/` locally or the future test runner's artifact directory, separately
  from the reference bundle. Do not fix failures by replacing source images.
- Use fictional fixtures, isolated databases, controlled clocks, and deterministic
  model/tool responses in CI. Record real provider/model, prompt version,
  outcome, latency, and available usage for separate live evaluations.
- A fresh clone/CI does not contain the private originals. Behavioral tests must
  use the tracked matrix and fictional fixtures; any check requiring originals
  must explicitly require their private restoration and report missing assets.
  Do not silently mark skipped visual checks as passing.
- Until application code exists, verify source integrity, documentation links,
  issue references, ignore rules, and `git diff --check`. These checks do not
  prove any B/V application behavior is implemented.
