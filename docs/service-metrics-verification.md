# Historical service metrics — issue #58

## Source and definitions

The owner requested functional login indicators and chose **all history** on
2026-11-06. The original V01 design defines the three-column layout; its fixed
8 s / 72% / 6 values are examples, superseded by this explicit product request.
Reference bundle hashes were verified before implementation. No reference asset
was modified. [Implementation plan](superpowers/plans/2026-11-06-service-metrics.md).

- First response: arithmetic mean of elapsed seconds from the first employee
  message to the first completed live-model agent reply, one sample per
  conversation. Failed replies and deterministic model substitutes are excluded.
  This measures completed-response latency, not first-token latency.
- Resolved without queue: explicitly employee-confirmed self-service closures
  divided by those closures plus conversations ever sent to human support.
  Each conversation contributes once. Active/abandoned conversations are excluded.
  Historical handoffs are included; historical unrecorded resolutions cannot be
  reconstructed and are not inferred from text, silence, or model claims.
- Online: distinct analysts with a valid session and heartbeat less than 60
  seconds old. The visible authenticated page sends every 20 seconds. Multiple
  sessions count once; logout revokes that session; closed/hidden pages expire.
  Presence is not a promise of immediate availability. Login polls every 15 seconds.

## Boundaries

Only aggregates are public. Server-owned sessions provide analyst identity;
employee role and ownership guard resolution. Confirmation references the latest
completed reply, rejects pending drafts and previously escalated conversations,
and atomically closes/increments conversation state version. Repetition is
idempotent. Ticket state is independent. Existing databases receive additive,
nullable columns without backfilled results. Empty samples render a dash, not
a fabricated zero; failures clear stale values and expose retry.

The single-instance SQLite prototype computes aggregate snapshots from persisted
timestamps and metadata in one read transaction. For substantially larger datasets,
replace this with indexed aggregates/materialized measurements before increasing
traffic; no production load-testing claim is made.

## Executed evidence

The targeted integration test first failed with 404, then passed after
implementation: exact 4-second average, 50% resolution, no-data samples,
failed/simulated reply exclusion, authorization, stale confirmation, idempotency,
heartbeat deduplication/expiry, revoked and expired sessions. Its final expanded
version also passed separately.

`npm run check` passed: typecheck, ESLint, formatting, 181 unit tests, 64 integration
tests, production build and 79 Chromium tests. Browser tests use isolated SQLite
databases and ports 3200/3201. Three new browser scenarios cover persisted
resolution through reload, login aggregates, analyst presence/logout, unavailable
metrics, retry, periodic refresh and narrow-screen overflow. No live provider
checks were executed: these tests do not evaluate model answer quality.

Manual browser verification on localhost:3100 observed historical metrics from
the preserved local database, public login presence changing 0 → 1 after Rafael's
analyst login, and 1 → 0 after logout. The calculation disclosure expanded
correctly during initial verification, then was removed at the owner's request
to retain only the three original indicator labels and their measured values.
Calculation definitions remain in this document. The actual sample was 336.4 seconds across seven live-response
conversations and zero confirmations across four handoffs; it was not replaced
with prototype values. The long historical response time can include failed
attempts and time until a later successful retry.

The additive migration was applied locally after a SQLite backup. Counts before
and after were unchanged: 48 conversations, 118 messages, five tickets. Both
services were restarted from this checkout on ports 3100/3101. The memory-only
demo model key is cleared by API restart, as disclosed to the owner.

Manual review against PR #57's head covered aggregate-only exposure, same-origin
proxy checks, session identity, stale confirmation/version invalidation, preserved
human ownership, sample definitions and no fabricated historical feedback.
No outstanding correctness findings were identified. Full native-design pixel
fidelity and production load capacity are not claimed.

After the owner's copy refinement, the web production build and seven targeted
Chromium tests (login visual/accessibility and service metrics) passed again.
Manual localhost verification confirmed exactly the three original labels,
with calculated values and no explanatory/sample text. Screenshot:
`outputs/service-metrics-final.png` (local, excluded from Git).
