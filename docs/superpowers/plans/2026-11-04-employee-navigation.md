# Employee Navigation Implementation Plan

**Goal:** Bring the employee navigation and shared layout closer to Pencil frames `IcuoM` and `i4fCbC` (issue #9), while preserving conversation and profile behavior.

**Architecture:** Keep the existing history state and mounted conversation; render employee navigation in a shared sidebar and content in a main region. The analyst view remains unchanged. Stack the navigation above the content on narrow screens.

**References:** PRD v5 p. 5; verified `originals/nexo.pen` frames `IcuoM` and `i4fCbC`; secondary images `02-ticket-draft.png` and `06-profile.png`; acceptance V02, V03 and V06. The desktop frames specify a 232 px sidebar. Illustrative online status and password recovery are not implemented.

1. Add a Chromium test for sidebar placement, keyboard navigation, unsent conversation preservation and narrow-screen overflow; observe failure before implementation.
2. Update `history.tsx` and `globals.css` to provide the shared employee layout and responsive navigation without changing backend rules or analyst behavior.
3. Run `npm run check`, inspect screenshots at 1440×900 and 375×812 against the references, review the diff and document remaining visual limitations.
