# Functional service metrics

Issue: #58. Owner requests all historical data. This increment builds on the pending Free Tier notice (PR #57), preserving it locally.

## Definitions and scope

- First response: elapsed time between first employee message and first completed live agent message, one sample per conversation. Failed and deterministic replies are excluded; no inferred first-token timing.
- Resolution rate: employee-confirmed closures that never entered the human queue / (those closures + conversations ever handed off). Active and abandoned conversations are excluded. Historical confirmations cannot be reconstructed. An explicit confirmation closes the conversation, increments its version and stops stale generation; tickets remain independent.
- Online analysts: distinct analysts with unexpired sessions and a heartbeat less than 60 seconds old. Visible authenticated pages send heartbeats every 20 seconds; logout deletes the session. Login aggregates refresh every 15 seconds without caching. Heartbeats do not imply availability to accept work.
- Public endpoint returns aggregates only. Resolution accepts the latest agent message ID, validates employee ownership, completion and current agent state atomically, and is idempotent for the same confirmation. No model-selected identity or resolution.

## Implementation and verification

Ruling: the owner requested removal of added captions, sample counts and
definitions from the screen. Keep the three original labels with measured values;
calculation definitions stay in repository documentation.

- [x] Write integration tests for exact averages, empty samples, explicit confirmation, cross-owner and role failures, stale confirmation, repeat requests and presence expiry/deduplication/logout; observe failure.
- [x] Add nullable session heartbeat and conversation resolution-message fields with additive SQLite migration. Add contracts and backend metrics endpoints, guarded feedback and heartbeat.
- [x] Replace login constants with fetched aggregates and honest loading/no-data/error states; add accessible definitions and visible analyst heartbeat. Offer explicit latest-response resolution control.
- [x] Add browser coverage for resolution persistence, aggregate display, analyst presence and transport failures; run isolated tests.
- [x] Run full check, manually review privacy/races/calculations, update architecture/context and evidence; deploy locally preserving data, verify browser rendering. No live-model calls required for arithmetic or presence; do not claim model quality evidence.
