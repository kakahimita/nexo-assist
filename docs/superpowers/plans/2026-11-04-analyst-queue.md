# Analyst Queue Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Review manually as required by AGENTS.md. This is a planning artifact, not authorization to implement or merge.

**Goal:** Refine the analyst conversation queue with readable summaries, selected filters, and distinct loading, empty, error, and retry states.

**Architecture:** Keep the existing authenticated support endpoints and shared contracts. Separate queue presentation and queue loading state from the selected conversation and analyst actions. The backend remains responsible for filtering and authorization; the browser prevents stale responses from replacing a newer filter result.

**Tech Stack:** Next.js, React, strict TypeScript, existing Zod contracts, Playwright, npm workspaces.

**Spec:** Proposed bounded follow-up to issue #9 and `docs/human-support-verification.md`, using B11 and V04 from `docs/challenge-acceptance.md`. Visual authority: original `originals/nexo.pen`, analyst queue frame; secondary guide: `screens/04-analyst-queue.png`. This document specifies the proposed increment; it does not claim design approval or completed implementation.

## Global Constraints

- Create or reuse a real bounded GitHub issue before delivery edits; derive `feature/LAB-NNNN` from that issue, starting from current main in an isolated checkout. Do not invent issue numbers.
- Preserve local AGENTS.md changes and untracked plans. Include this plan in the delivery branch so documentation links resolve.
- Read required project context, development workflow, and applicable AGENTS.md files before execution. Read the installed Next.js guidance required by the web AGENTS.md before web changes.
- Engineering artifacts use English; visible copy uses Brazilian Portuguese.
- Preserve `all`, `waiting`, and `owned` filter meanings, server-side authorization, atomic claim, reply, return, close, and durable agent pause.
- No backend schema changes, dependencies, search endpoint, polling, unread counts, presence indicators, public ticket numbers, or new filter are part of this increment.
- Do not implement the V05 conversation redesign or claim full V04 fidelity. Prototype timers, example counts, and presence are illustrative.
- Verify the local reference manifest and tracked hashes before execution. Inspect the original PRD pages relevant to analyst behavior and original Pencil frame. The secondary image is not a native export.

## Approach and Scope

Recommended approach: improve the queue inside the existing support console using its current summary contract. A full console redesign would mix queue work with conversation and ticket-panel changes; adding only CSS would leave loading, retry, and request-order behavior unresolved.

Use a compact queue header, three wrapping filter buttons, and a list of selectable summary cards. Cards display decorative employee initials, the actual employee name, last-message preview, timestamp, conversation state, and handoff reason when present. Use available data only. Keep the existing detail panel beside the queue on desktop and after the queue in document order on narrow screens; do not redesign its contents.

## Review Focus

1. Rapid filter changes: an older slow response must never replace the current filter's results.
2. First load and failed refresh: neither should masquerade as an empty queue or show another filter's rows.
3. Queue retry must clear only queue errors and must not clear a reply/action error or the selected conversation draft.
4. Null handoff/last message and long employee names must remain readable without invented data or overflow.
5. Existing claim/reply/return/close flows and keyboard selection must continue working after markup and status regions change.

## File Map

- Modify `apps/web/src/features/support/support.tsx`: own filter and selected conversation; integrate queue state without changing analyst action semantics.
- Create `apps/web/src/features/support/use-support-queue.ts`: own loading, error, retry and stale-request protection for queue fetches.
- Create `apps/web/src/features/support/support-queue.tsx`: present filters, states and selectable summaries.
- Modify `apps/web/src/app/globals.css`: scope queue styles and responsive support layout.
- Create `apps/web/e2e/support-queue.spec.ts`: controlled network state, ordering, keyboard and responsive tests.
- Modify `apps/web/e2e/support.spec.ts`: scope existing status assertions to the detail/notice regions so added loading announcements do not make `.first()` ambiguous.
- Modify `docs/human-support-verification.md` and `docs/challenge-acceptance.md`: executed evidence and remaining visual limits.
- Consume, without changing, `packages/contracts/src/support.ts` and `packages/contracts/src/conversation.ts`.

### Task 1: Make queue loading explicit and race-safe

**Interfaces:** `useSupportQueue(filter: SupportConversationFilter, onLogout: () => void)` returns `{ items: SupportConversationSummary[]; status: 'loading' | 'ready' | 'error'; error: string; reload: () => Promise<void> }`. Queue validation continues to use `SupportConversationSummarySchema`. The hook cancels superseded requests and checks request identity before any state update, including error/finally handling. Handle 401 through `onLogout`; aborted requests do not produce errors.

- [ ] Add browser tests with controlled queue routes: hold the first response and assert `Carregando conversasÃ¢â‚¬Â¦` is announced without `Nenhuma conversa.`; fulfill with an empty array and assert `Nenhuma conversa neste filtro.`.
- [ ] Add a failure/retry case: HTTP 500 shows `NÃƒÂ£o foi possÃƒÂ­vel carregar as conversas.` and `Tentar novamente`; retry success removes that error and renders returned summaries.
- [ ] Add an ordering case: switch from waiting to owned while waiting is delayed; resolve owned first and waiting last; only owned results remain. Add the analogous stale-error case so an obsolete failure cannot replace a successful current response.
- [ ] Run `npm run test:e2e`; confirm the new state assertions fail before implementation, using the project's isolated browser-test database.
- [ ] Implement the hook and connect it to Support. Queue loading is independent of `busy` for analyst mutations. On filter change hide previous-filter rows until the new result arrives. On refresh failure hide stale rows and offer retry.
- [ ] Keep selected detail and unsent reply text unchanged when refreshing/filtering the queue. A selected conversation may remain open even if absent from the current filter. Existing claim/return/close refreshes call the hook's `reload`.
- [ ] Add a browser case where retry recovers the queue while a selected conversation and unsent reply remain intact; assert queue error handling does not clear unrelated action errors. Do not broaden this task into changing mutation behavior.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run test:e2e`; require passing results.
- [ ] Commit with `fix: make analyst queue loading race-safe`.

### Task 2: Present readable queue cards and accessible filters

**Interfaces:** `SupportQueue` accepts `{ items: SupportConversationSummary[]; filter: SupportConversationFilter; selectedId: string; status: 'loading' | 'ready' | 'error'; error: string; onFilterChange: (filter: SupportConversationFilter) => void; onSelect: (id: string) => void; onRetry: () => void }` and returns `React.JSX.Element`. Support owns the existing selection/action lifecycle.

- [ ] Inspect the original Pencil queue frame and secondary guide side by side. Record which source details can be implemented with the current summary contract and which remain excluded.
- [ ] Add browser assertions for filters `Todas`, `Para vocÃƒÂª`, and `Minhas`, with `aria-pressed` reflecting the current filter and each sending its existing backend filter value. Preserve the default `waiting` filter.
- [ ] Add fixtures for waiting/claimed/closed/agent states, all four handoff reasons, null handoff, and null last message. Assert readable state and reason text, a fallback `Sem mensagens.`, and no fabricated unread/presence indicators.
- [ ] For a real last-message timestamp render a semantic `<time dateTime>` formatted in `pt-BR`, `America/Sao_Paulo`, with both date and time to distinguish older conversations. Null last message has no invented timestamp.
- [ ] Run `npm run test:e2e` and confirm the new presentation assertions fail before changes.
- [ ] Implement the queue component. Use a labeled `Conversas` region and semantic list; each row retains a button with `data-conversation-id`. Keep the employee name in its accessible name, use `aria-current` for the selected row, and mark decorative initials `aria-hidden`.
- [ ] Use exact state labels: `Com o agente`, `Aguardando atendente`, `Em atendimento`, `Encerrada`. Keep reason labels `Transferida`, `Incidente crÃƒÂ­tico`, `Chamado vencido`, and `Sem seguranÃƒÂ§a`. Do not infer analyst ownership or presence from styling.
- [ ] Add scoped styles using existing colors and typography. Keep a visible keyboard focus indicator, truncation only for the message preview (retain full text in the DOM), wrapping names, and filters that wrap rather than overflow.
- [ ] Add keyboard coverage: Tab reaches filters and row buttons; Enter selects a conversation and loads its detail. At 1440Ãƒâ€”900 and 375Ãƒâ€”812, assert no document horizontal overflow with long names, messages and multiple filters.
- [ ] Scope existing workflow status assertions to the `Atendimento` region or the explicit completion notice. Preserve the real backend full workflow test rather than replacing it with mocks.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run test:e2e`; require passing results.
- [ ] Commit with `feat: refine analyst conversation queue`.

### Task 3: Verify, compare and record the bounded delivery

- [ ] Ensure Chromium is installed and run `npm run check`. Record actual results of typecheck, lint, formatting, unit/integration tests, build, and browser tests. Keep temporary test databases isolated from the owner's database.
- [ ] Capture the app under `outputs/` at 1440Ãƒâ€”900 and 375Ãƒâ€”812: populated, selected, loading, empty, and error queue states. Compare the populated desktop queue against the original frame and secondary guide; inspect mobile readability and focus manually. Do not commit captures or original references.
- [ ] Review the final diff manually: queue request ordering, error separation, absence of fabricated fields, unchanged server permissions/mutations, keyboard behavior and CSS scope.
- [ ] Update verification and acceptance documents with executed evidence, screenshot paths, provenance and remaining differences. Explicitly leave V05, search, unsupported prototype indicators, live-model reliability, and overall #9 completion outstanding.
- [ ] Record `npm run smoke:model` as not run unless separately executed with an available local provider key. Deterministic UI tests do not prove live inference.
- [ ] Commit evidence with `docs: record analyst queue verification`. Prepare a PR following the template, link the bounded delivery issue and use `Refs #9`; write `## Como testar` in Brazilian Portuguese. Do not merge without explicit owner instruction.

## Planning Evidence and Self-Review

- Inspected existing Support state, fetch/error handling, action refreshes, shared summary contract, and the real browser support workflow.
- Verified all assets against the tracked reference hashes and inspected the secondary V04 image. This planning session did not render/read the original PDF pages or extract the Pencil frame geometry; those checks remain explicit execution prerequisites before final visual decisions.
- Current data supports names, states, handoff reasons, last-message preview and timestamp; it does not justify presence, unread badges, ticket numbers or additional filter counts.
- Each review condition is assigned to a concrete browser case above. Existing backend workflow coverage remains required alongside mocked network cases.
- No implementation, application test execution, issue creation, branch creation, commit or merge was performed for this plan.




