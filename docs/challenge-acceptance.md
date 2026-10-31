# Challenge acceptance and test matrix

Status: requirements; foundation B17 evidence is recorded in [foundation verification](foundation-verification.md). Partial B01 and B13 evidence for #4 is recorded in [identity and history verification](identity-history-verification.md). Other rows remain planned unless independently demonstrated.
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
