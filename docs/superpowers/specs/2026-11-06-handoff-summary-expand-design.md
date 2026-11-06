# Handoff summary expand and collapse (#54)

## Intent

The analyst sees the handoff summary before the conversation. Generated summaries
can be long, so the card pushes the thread down and, in the V05 frame, is clipped
without a way to read the rest. The card keeps one collapsed size and lets the
analyst reveal or hide the rest of the summary.

## Goals

- One collapsed maximum height for the summary text, independent of its length.
- `Ver mais` at the end of the card expands it to the full summary; `Ver menos`
  restores the collapsed height.
- The control is a real button, keyboard operable, with `aria-expanded` and
  `aria-controls`.
- The control appears only when the summary actually overflows.
- Typography, colors, spacing and border stay as today.

## Non-goals

- Restyling the card or the analyst console.
- Persisting the expanded state or changing any server contract.
- Turning the card into a modal dialog or a new route.

## Constraints

- The card is rendered by the client component
  `apps/web/src/features/support/support-detail.tsx` inside a CSS grid whose
  second row is `auto`; expansion must grow that row, not overlap messages.
- The summary comes from `HandoffView.summary` and is plain text.
- Existing browser tests mock the detail response, so no backend change is needed.

## Approaches

1. **Measured clamp (chosen).** Cap the summary text with `max-height` and
   `overflow: hidden`, measure `scrollHeight` against `clientHeight`, and reveal
   the toggle only while hidden content exists. Expansion removes the cap.
   Trade-off: needs one layout measurement after hydration.
2. **Always-visible toggle.** No measurement, simpler code, but shows
   `Ver mais` on short summaries with nothing to reveal, which misleads.
3. **Dialog overlay.** Larger visual change than requested and separates the
   summary from the conversation context; rejected.

## Decisions made with the owner

- The collapsed height is about ten lines (`200px` at the current 13.5 px/20 px
  type) and is one CSS value, easy to tune during review.
- The label is `Ver mais` / `Ver menos`, matching the frame.
- The toggle sits in the bottom row next to `Solicitada em`, so heading, reason
  and time never disappear.
- Summaries shorter than the cap keep their natural height instead of showing
  empty space; the cap is a maximum, not a forced height.

## Left to the builder

- Exact markup and CSS class names, resize re-measurement, reset when the
  selected conversation changes, and the Playwright assertions.
- The expanded area keeps a `min(60vh, 480px)` safety cap with its own scroll for
  pathological summaries; a 2000-character summary (the contract maximum) fits
  the desktop card without internal scrolling.
