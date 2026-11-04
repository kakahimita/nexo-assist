# Employee Conversation Layout Implementation Plan

**Goal:** Improve the employee chat and composer for V02/V03 while preserving streaming, decision evidence, handoff, drafts and session limits.

**References:** Verified PRD v5 p. 2 and Pencil frames `IcuoM` and `vbsNW`; owner-provided 3x screen renders are secondary visual guides. Prototype example promises are not business rules.

**Scope:** Style message bubbles, action evidence and the composer; retain existing accessible labels, controls and their behaviors. The ticket and draft cards remain separate follow-up work. Do not claim the agent is online without real availability evidence.

1. Add a browser test for an accessible composer with input and send action side by side at desktop and narrow widths; observe the old layout fail.
2. Update the chat component and styles, preserving existing status, counters, decisions and interaction logic.
3. Run `npm run check`, inspect screenshots against references, and record partial visual evidence and limitations.
