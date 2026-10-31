# Delivery roadmap

Parent: [#1](https://github.com/kakahimita/nexo-assist/issues/1).
Repository documentation: [#2](https://github.com/kakahimita/nexo-assist/issues/2).
Every delivery below is planned, not completed. Split into smaller linked issues
when an independently verifiable increment warrants it.

Challenge context and original local references are tracked separately in
[#12](https://github.com/kakahimita/nexo-assist/issues/12). Every implementation
delivery must use the [acceptance matrix](challenge-acceptance.md) and
[source reference policy](challenge-references.md) for its tests and review.

| Issue | Delivery | Observable acceptance |
| --- | --- | --- |
| [#3](https://github.com/kakahimita/nexo-assist/issues/3) | Runnable foundation | Clean install, web/API health check, database migration, strict contracts, CI, separate live Mastra smoke check |
| [#4](https://github.com/kakahimita/nexo-assist/issues/4) | Identity and history | Fixture login, isolated employee data, analyst permissions, server sessions, history restored after restart |
| [#5](https://github.com/kakahimita/nexo-assist/issues/5) | Tickets and rules | SLA, confirmed versioned drafts, idempotent writes, recent reopening, history, simulated transient failures |
| [#6](https://github.com/kakahimita/nexo-assist/issues/6) | Agent consultation | Streaming, ticket selection, applicable articles, clarification, real decision evidence |
| [#7](https://github.com/kakahimita/nexo-assist/issues/7) | Conversational changes | Confirmed create/update/reopen, edit/cancel, duplicate prevention, session cap |
| [#8](https://github.com/kakahimita/nexo-assist/issues/8) | Human support | Queue, atomic claims, replies, return, close, durable agent pause, stale-output rejection |
| [#9](https://github.com/kakahimita/nexo-assist/issues/9) | UI completion | Five screens, basic profile, accessible responsive controls, loading/error/reconnect states |
| [#10](https://github.com/kakahimita/nexo-assist/issues/10) | Submission | Clean setup, requirements checklist, model evaluation evidence, demo, architecture/trade-offs, interview walkthrough |

Follow this order initially. Feature deliveries include the minimum usable UI
and relevant tests; UI completion is polish, not the first working interface.
Keep the parent open until all mandatory requirements are demonstrated.
Optional deployment does not block mandatory completion.

## Verification

- Unit-test SLA, business-hour boundaries, priorities, reopening, and drafts.
- Use isolated integration databases for privacy, idempotency, claims, and persistence.
- Add browser tests for usable employee and analyst workflows.
- Use controlled model/tool responses for repeatable CI without API credentials.
- Run real-model evaluations separately, recording model, prompt version, result,
  latency, and token usage when available.
- Cover Windows 10/11 applicability, ambiguous selection, duplicates, off-topic
  input, uncertainty, transient failures, and handoff during generation.
- Verify clean installation and restart during human ownership before submission.

## Foundation completion gate

Foundation implementation and its live-provider and CI checks are recorded in
[foundation verification](foundation-verification.md). Review of dependency
advisories and the owner walkthrough remain part of the delivery handoff.

Issue #3 needs a runnable stack and passing automated checks. Its live model
verification also needs the owner's free-provider account/key configured locally.
A missing key remains an outstanding criterion; simulated output does not prove
live integration. Never ask the owner to paste secrets into chat.
