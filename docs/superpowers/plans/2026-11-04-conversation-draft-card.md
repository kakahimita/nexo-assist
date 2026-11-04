# Conversation Draft Card Implementation Plan

**Goal:** Improve the pending conversational draft card for V02 while preserving confirmation, editing, cancellation, duplicate checks and session-limit behavior.

**References:** Verified PRD v5 p. 4, original Pencil frame `IcuoM` and the owner-provided 3x screen rendering; acceptance B04, B05, B07, B12, B14 and V02. Prototype deadlines and status examples are illustrative, not ticket rules.

1. Extend the existing browser scenario to check the pending status, required information and responsive layout before confirmation; verify it fails on the old card.
2. Organize the conversational draft card into status, details and actions, preserving all server-provided fields and existing behavior. Do not invent an SLA or ticket identifier.
3. Run `npm run check`, inspect desktop and mobile screenshots, review the changes and document remaining visual gaps.
