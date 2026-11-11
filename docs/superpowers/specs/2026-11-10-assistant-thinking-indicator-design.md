# Assistant thinking indicator design

**Issue:** #65

## Intent

Employees should see that the assistant is working after they send a message,
before any response text arrives. Today the chat already renders a provisional
agent bubble with the text `Preparando resposta...` whenever the component is
active, including during resolution confirmation, which is not a submitted
message. The indicator must be a compact, accessible spinner tied to a message
turn only.

## Goals

- Show a compact spinner after `send()` starts and before the first streamed
  text fragment.
- Announce the waiting state accessibly without duplicating the assistant's
  eventual answer.
- Remove the indicator when text, `done`, `handoff-waiting`, `error`, or the
  request's `finally` block is reached.
- Keep messages, the human-handoff banner, and failure messages visible while
  the indicator is present.
- Cover appearance and cleanup in a Chromium test.

## Non-goals

- Do not change streaming, orchestration, session-limit, handoff, draft, or
  resolution behavior.
- Do not show the indicator during resolution confirmation, which has no
  streamed answer.
- Do not add a model-provider health signal or claim live-provider status.
- Do not require the private challenge reference bundle; the original design
  does not define this transient state.

## Approach

Track an `awaitingReply` boolean in `Consultation`, set by `send()` and cleared
on the first `text-delta`, `done`, `handoff-waiting`, `error`, and in `finally`.
Render the agent placeholder bubble only while `awaitingReply` is true or a
partial answer exists. When awaiting, render a decorative spinner plus a
visually hidden `Preparando resposta` label inside the existing polite live
region; the visible assistant text appears when the first fragment arrives.

Alternatives considered:

- Reusing `active && !partial` without a new state. Rejected because `active`
  also covers resolution confirmation, which would display a false thinking
  state.
- Spinner plus visible `Preparando resposta...` text. Rejected for this compact
  state; the spinner and live announcement carry the meaning.

## Interface behavior

- The spinner is small and sits in the agent bubble with the `Nexo Assist`
  speaker label.
- The spinner is `aria-hidden`; the waiting text remains available to
  assistive technology.
- Under `prefers-reduced-motion: reduce`, the spinner keeps a static visual
  instead of rotating.
- No layout shift after cleanup: the placeholder bubble is replaced by the
  streamed answer bubble.

## Testing

- Browser: gate the stream response, assert the waiting indicator is visible
  while no fragment exists, release a text delta and completion, then assert
  the indicator is gone and the answer is visible.
- Browser: assert the indicator is also absent on handoff and on a failed
  stream, without hiding their existing messages.
- Keep the existing unit, integration, build, and Chromium baseline green.

## Constraints

- Issue #65 branch: `feature/LAB-0065`; no merge without owner instruction.
- Strict TypeScript, Brazilian Portuguese user-facing copy, English artifacts.
- Touches only the employee consultation component, its styles, and browser
  coverage.
