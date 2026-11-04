# Read-only profile implementation plan

**Goal:** Give signed-in employees a read-only profile using their authenticated session data (V06, issue #9).

**Architecture:** Add a profile view to the existing client-side history screen. Keep the conversation mounted while the profile is open so unsent text and ongoing work are preserved. Display the existing session name and email; do not imply password recovery exists.

**Tech stack:** Next.js, React, TypeScript, Playwright.

**Reference:** Original Pencil frame `i4fCbC` and the owner-provided `06-profile.png` secondary rendering. The architecture calls for a read-only profile; the illustrated password reset is outside scope.

1. Add a browser test for signed-in identity, absence of a reset action, and preservation of an unsent message when returning to the conversation. Verify it fails before implementation.
2. Add accessible navigation and a read-only identity card. Match the profile's spacing and visual tokens where possible without redesigning the other screens.
3. Run the browser test and the required project checks; inspect the UI against the reference at desktop and narrow sizes. Record limitations and review the diff.
