# Submission requirements checklist

Scope: issue #10, prepared on 2026-11-11. This checklist maps the challenge
requirements in [the acceptance matrix](challenge-acceptance.md) to the evidence
recorded in this repository. Expected results come from the requirement sources,
not from current application output.

Status vocabulary:

- **Demonstrated** — executed deterministic or browser evidence exists.
- **Demonstrated deterministically** — executed deterministic evidence exists;
  live-provider evidence is separate and may remain pending.
- **Partial** — some acceptance criteria or fidelity remain open.
- **Pending** — no executed evidence yet.
- **Not claimed** — outside the current delivery and explicitly disclosed.

Deterministic, browser, and live-provider evidence are separate. A deterministic
pass does not establish live conversational quality, and skipped visual checks
are never marked as passing. The private challenge reference bundle is
unavailable in this checkout, so visual rows remain partial and exact native
Pencil fidelity is not claimed.

## Behavioral acceptance

| ID | Requirement | Status | Evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| B01 | Demo login, employee isolation, and analyst authorization | Demonstrated | [Identity and history verification](identity-history-verification.md) | Production authentication is intentionally out of scope. |
| B02 | Applicable knowledge answers without a ticket and respects platform applicability | Demonstrated deterministically | [Agent consultation verification](agent-consultation-verification.md), [natural support verification](natural-support-verification.md) | Live multi-turn acceptance remains under #62; sampled runs are not broad reliability evidence. |
| B03 | Authorized ticket selection, status, and deadline without leaking other employees' data | Demonstrated | [Ticket consultation verification](ticket-consultation-verification.md) | None for the deterministic and browser scope. |
| B04 | Collect required draft fields and require confirmation of the current draft | Partial | [Conversational drafts verification](conversational-drafts-verification.md) | Deterministic create/edit/cancel/confirm pass; live free-tier draft creation and duplicate detection do not all pass. |
| B05 | Supplement an existing open problem without duplicating it, including retried writes | Demonstrated | [Ticket verification](ticket-verification.md) | Semantic duplicate recall for very different paraphrases is not guaranteed. |
| B06 | Reopen a recent resolution inside the seven-day window and reject older ones | Demonstrated | [Ticket verification](ticket-verification.md) | The seven-day boundary follows a documented project convention. |
| B07 | Correct type, category, and impact/urgency priority; clarify missing facts | Demonstrated deterministically | [Ticket verification](ticket-verification.md), [natural support verification](natural-support-verification.md) | Live semantic interpretation remains under #62. |
| B08 | Correct first-response and update deadlines, weekends, and overdue boundaries | Demonstrated | [Ticket verification](ticket-verification.md) | Business-hour arithmetic follows the architecture conventions. |
| B09 | Durable handoff for employee request, critical incident, overdue ticket, or unresolved uncertainty | Demonstrated | [Human handoff verification](human-handoff-verification.md) | Live model handoff reliability remains part of #10. |
| B10 | Agent silent while waiting or assigned; explicit return resumes it; stale output discarded | Demonstrated | [Human handoff verification](human-handoff-verification.md), [human support verification](human-support-verification.md) | Ownership and pause are covered deterministically; live-model behavior remains #10. |
| B11 | Analyst queue, claim, reply, return, and close with ownership enforcement | Demonstrated | [Human support verification](human-support-verification.md) | V04/V05 visual fidelity remains #9. |
| B12 | Every answer exposes actual actions, confidence, evidence, and readable explanation | Demonstrated deterministically | [Agent consultation verification](agent-consultation-verification.md), [autonomous resolution verification](autonomous-resolution-verification.md) | Live model evaluations remain separate under #10. |
| B13 | Conversations, tickets, drafts, and human state survive restart | Partial | [Identity and history verification](identity-history-verification.md), [human support verification](human-support-verification.md) | Broader restart coverage for waiting and assigned states remains in #10. |
| B14 | Real-time responses and the thirty-message session cap | Demonstrated | [Session limit verification](session-limit-verification.md), [thinking indicator verification](thinking-indicator-verification.md) | The waiting state is covered; live provider latency is not a guarantee. |
| B15 | Temporary failures produce bounded recovery or an honest error without fabricated success | Demonstrated deterministically | [Agent consultation verification](agent-consultation-verification.md), [chat error notifications verification](chat-error-notifications-verification.md) | Live provider failure behavior remains part of #10. |
| B16 | Non-IT redirection, employee privacy, and resistance to injected instructions | Partial | [Agent consultation verification](agent-consultation-verification.md), [natural support verification](natural-support-verification.md) | Live prompt-injection resistance is not yet demonstrated. |
| B17 | Strict types, separated services, documented setup, and reproducible local run | Partial | [Foundation verification](foundation-verification.md) | A clean-clone walkthrough with the final README remains pending. |
| B18 | The owner can explain decisions, evidence, trade-offs, and a small live change | Pending | [Acceptance matrix](challenge-acceptance.md) | Interview walkthrough remains later #10 work. |

## Visual acceptance

| ID | Screen | Status | Evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| V01 | Login | Partial | [Login viewport verification](login-viewport-verification.md), [service metrics verification](service-metrics-verification.md) | Desktop fit and measured indicators are covered; exact native Pencil fidelity is not claimed. |
| V02 | Employee ticket draft | Partial | [Employee visual verification](employee-visual-verification.md), [conversational drafts verification](conversational-drafts-verification.md) | Composition and states are close but not pixel-faithful; the reference bundle is unavailable here. |
| V03 | Ticket consultation | Partial | [Employee visual verification](employee-visual-verification.md), [ticket consultation verification](ticket-consultation-verification.md) | Ticket cards and consultation exist; prototype-only data and exact layout remain different. |
| V04 | Analyst queue | Partial | [Human support verification](human-support-verification.md) | Queue states work; presence, unread badges, and exact spacing remain unimplemented or unfaithful. |
| V05 | Analyst owned conversation | Partial | [Human support verification](human-support-verification.md) | Ownership controls and summary exist; typography and panel composition are not pixel-faithful. |
| V06 | Read-only profile | Partial | [Employee visual verification](employee-visual-verification.md) | Profile is read-only; password recovery is explicitly unavailable and exact fidelity is not claimed. |

## Submission gates

| Gate | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Clean local setup with documented commands | Partial | [README](../README.md), [foundation verification](foundation-verification.md) | A clean-clone walkthrough with the final README remains pending. |
| Deterministic checks without a model key | Demonstrated | `npm run check` and CI run [43009162564](https://github.com/kakahimita/nexo-assist/actions/runs/43009162564) on `main` | Re-run at submission time; no model key is required. |
| Live evaluation record | Partial | [Agent consultation verification](agent-consultation-verification.md), [conversational drafts verification](conversational-drafts-verification.md), [natural support verification](natural-support-verification.md) | #62 multi-turn acceptance is pending; free-tier draft tool-calling remains unreliable. |
| Mandatory flows, limitations, architecture, and trade-offs documented | Partial | [README](../README.md), [architecture](architecture.md), this checklist | Demo script and final interview material remain later #10 work. |
| Demo script | Pending | None | Later #10 work. |
| Interview walkthrough | Pending | None | Later #10 work. |
| Deployment | Not claimed | None | Optional in the challenge and not delivered. |

## Evidence rules

- Use fictional fixtures and isolated databases for deterministic checks.
- Record live provider, model, prompt version, outcome, latency, and available
  usage separately; simulated output does not satisfy the live gate.
- Keep application screenshots and test output outside the private reference
  bundle, under `outputs/` locally.
- A missing or changed reference asset is a limitation to disclose, not a reason
  to invent a baseline.
