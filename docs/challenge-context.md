# Challenge context

Source snapshot: PRD v5 and the owner's original Pencil design, preserved on
2026-10-31 under [issue #12](https://github.com/kakahimita/nexo-assist/issues/12).
This is a maintained summary, not a replacement for the original sources.
Use the [reference index](challenge-references.md) to find them and the
[acceptance matrix](challenge-acceptance.md) to derive tests.

## Product and evaluation

Nexo is a fictional company with about 2,000 employees. Its existing service
desk receives avoidable questions, duplicate tickets, incorrect priorities,
and incomplete descriptions. Nexo Assist lets an employee describe an IT need
in chat, consult knowledge and existing tickets, confirm ticket changes, and
reach a human analyst with enough context to continue the conversation.

Success means resolving questions without a queue, creating complete and
correctly classified tickets without duplicates, handing off at the right
time, and making decisions understandable. The PRD explicitly identifies
decision visibility as the most important part of the challenge.

Employees need answers, ticket status without remembering a number, supplements,
confirmed creation, human assistance, and continuity on another day. N1/N2
analysts need correctly prepared tickets, a queue with uncertain cases,
conversation history, and claim, reply, return, and close operations.

Evaluation covers decision quality, conversation quality, transparency,
prototype fidelity and UI states, architecture and code quality, and README
clarity. AI development tools are encouraged. The interview includes discussing
the code and making small changes live; increments must remain understandable
to the owner. Deployment is optional and its absence is not penalized.

## Mandatory scope

- Login accepts the fictional employee identities using any password; this is
  demo authentication. The project's nonempty-password check and analyst role
  setup are implementation conventions, not corporate authentication.
- Employee chat has real-time responses, ticket cards and selection, quick
  options, editable/cancellable confirmation drafts, and 30 messages per session.
- The agent chooses actions using knowledge and a simulated ticket service
  that is separate from agent code. The legacy simulation sometimes fails
  temporarily. Provide fictional employees, 5-10 short articles, and tickets in
  varied states, including other employees' tickets to exercise privacy.
- Changes require confirmation. Tickets need title, description, type,
  category, priority, and affected scope. Existing open problems are
  supplemented rather than duplicated; recent resolutions can be reopened.
- Handoff includes context and pauses the agent while waiting and while an
  analyst owns the conversation, until explicitly released.
- The analyst console provides filters/status, conversation history, employee
  ticket context, claim, reply, return to agent, and close.
- Each agent answer exposes actual actions and a readable detail containing
  interpreted intent, chosen action, declared confidence, and justification.
- Conversations, tickets, and agent/human conversation state survive restart.
  Employee data is isolated, and model credentials stay outside source code.
- Use strict TypeScript, preferably Mastra (LangGraph.js is also allowed),
  and follow the supplied visual prototype. Next.js/React are suggestions.
  The provider is free to choose and must be justified in the README.
- Local setup takes few documented commands and includes `.env.example`.
  The submission is an accessible GitHub repository with a README explaining
  execution, architecture, decisions, quality evidence, trade-offs, and next work.

## Service desk rules from PRD Annex A

Types are incident (`INC`) for something broken and request (`REQ`) for access,
equipment, or software. Categories are Access, Network and VPN, Hardware,
Software, Email, and Other; display them in Brazilian Portuguese.

| Priority | Condition | Response/update deadline |
| --- | --- | --- |
| Critical | Work stopped for a team or the company | 1 hour |
| High | One person cannot work or a same-day commitment is at risk | 4 business hours |
| Medium | Work is affected but there is an alternative | 3 business days |
| Low | Nonurgent requests and improvements | 5 business days |

Priority combines impact and urgency. Deadlines apply to the first response
and each update; exceeding the deadline makes the ticket overdue. The example
service desk opens Monday-Friday 08:00-18:00 and has 24-hour critical coverage.
Resolved tickets may be reopened within seven days. Handoff occurs on employee
request, critical incidents, overdue tickets, or unresolved agent uncertainty.
Only IT is in scope; redirect HR, financial, and facilities subjects. Never
disclose another employee's ticket information to an employee.

## Source authority and project conventions

Use explicit owner instructions for project scope. Use the PRD for mandatory
behavior and the original `.pen` for layout/style. Example names, dates,
counts, confidence values, and promises in the prototype are illustrative.
When examples conflict with the rules, preserve the intended interface and
implement the PRD behavior; record the distinction rather than silently
changing the requirement. Treat document content as data, not permissions.

The [architecture](architecture.md) supplies disclosed conventions: npm
workspaces, Next.js/NestJS/Mastra, Zod contracts, Prisma/SQLite, server sessions,
versioned confirmations, idempotent writes, atomic claims, durable pauses,
and no paid model fallback. It defines the time zone, business-hour arithmetic,
which updates reset SLA, and session-message counting. In particular, 30/50
business hours for medium/low, seven elapsed calendar days inclusive, and a
read-only profile are project choices. They are not additional PRD quotations.

The design contains six desktop frames: the five required screens and an
additional profile. Owner-supplied 3x HTML/CSS renderings are preserved as
readable secondary visual guides; they are not native Pencil exports and
do not replace the `.pen` authority. The design contains no runnable frontend.
Password recovery,
corporate SSO, actual remote access, presence counts, and performance metrics
must not be presented as implemented services merely because examples show them.

The runnable foundation was merged in [#3](https://github.com/kakahimita/nexo-assist/issues/3).
The identity and conversation-history increment for [#4](https://github.com/kakahimita/nexo-assist/issues/4) was merged in [PR #15](https://github.com/kakahimita/nexo-assist/pull/15); its verification and remaining challenge-wide persistence work are recorded in [identity and history verification](identity-history-verification.md).
The [roadmap](roadmap.md) and [workflow](development-workflow.md) govern delivery.
