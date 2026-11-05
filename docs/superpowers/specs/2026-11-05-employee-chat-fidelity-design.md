# Employee Chat Fidelity Design

**Issue:** #44, part of #9.

Improve V02/V03 employee-chat presentation without changing server-side consultation, privacy, confirmation, handoff, or session rules. Messages remain chronological and role-distinct. An agent message groups its actual action chips, decision detail, one-ticket card, quick replies, ticket selection, or draft card.

When a decision has several tickets, render a labelled radio group with authorized title, Portuguese status and overdue text. `Ver detalhes` stays disabled until a valid option is selected and submits only the selected ticket title through the existing send path. Handoff messages expose neither selection nor quick replies. No public ticket numbers, descriptions, new routes, contracts, backend behavior or model changes are part of this work.

Use Pencil V02 `IcuoM` and V03 `vbsNW` as visual authority. At 1440×900 and 375×812, empty, streaming, error, quota, pending draft, waiting, analyst, closed and long-text states must remain readable and keyboard-accessible, without horizontal overflow. Owner-supplied images are secondary guides and exact pixel fidelity is not claimed.
