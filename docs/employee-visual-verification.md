# Employee visual follow-up (#48)

## Source and scope

The hash-verified original Pencil frames `IcuoM` (V02), `vbsNW` (V03), and
`i4fCbC` (V06) are the visual authority. The owner-supplied 3x screen PNGs are
readable HTML/CSS renderings, not native editor exports. PRD Annex C requires
the chat, ticket consultation, analyst console, and login states; the profile
is the agreed additional read-only frame.

Direct inspection of `originals/nexo.pen` confirms the V02/V03 sidebar is
232 px, the top bar is 64 px, and the chat content uses 200 px side padding
within the 1208 px main area at 1440 px. That yields an 808 px conversation
column. The desktop employee content CSS now follows those measurements.

V01 login was also compared with `screens/01-login.png`: its split layout,
form hierarchy, and illustration already follow the source closely enough for
this pass. Its illustrative copy and disabled recovery/persistent-login controls
remain intentionally different because those services are unavailable.

This change keeps the backend ticket service and consultation contracts intact.
The standalone ticket-management view is available through `Meus chamados` in
employee navigation. The default chat view shows conversation history, messages,
decision evidence, cards, and composer without appending that management view.
The selected conversation and unsent message remain mounted when switching
between chat, ticket management, and profile. The V06 password card shows the
reset action as disabled and explains that the service is unavailable.

## Visual comparison

Local application captures: `outputs/consultation-desktop.png`,
`outputs/conversational-draft-desktop.png`, `outputs/ticket-card-1440x900.png`,
and `outputs/profile-v06-1440x900.png`. The V02/V03 conversation composition is
closer because the standalone ticket list no longer extends the chat screenshot.
V06 now contains a second card at the position of the prototype password area.
The compact history bar can scroll when many conversations exist.

Differences remain: V02/V03 example text, public ticket numbers, ticket
descriptions, richer status vocabulary, illustrative presence/count indicators,
and optional handoff buttons depend on unavailable data or conflict with PRD
behavior. The native Pencil export is unavailable, so exact typography and
pixel fidelity are not claimed. The separate `Meus chamados` view is an
implementation choice to retain standalone ticket operations without placing
them beneath the conversation; it is not an original prototype frame.

## Verification

The full `npm run check` gate passed with isolated ports 3100/3101 and a
temporary database, including typecheck, lint, formatting, unit and integration
tests, build, and 65 Chromium browser tests. The browser tests cover navigation,
ticket actions, draft confirmation, long-content overflow, and the read-only
profile control. The first browser run found a test that needed to reselect
`Meus chamados` after reload; that test was corrected and the fresh isolated
run passed. Live-model smoke testing was not run because this delivery does not
change model integration. CI status is tracked by the draft PR.

## Direct Pencil gap audit

The source `.pen` was inspected directly after the initial guide-based review.
This exposed layout details that the earlier PR review had missed:

| Frame | Direct source detail | Remaining application difference |
| --- | --- | --- |
| V01 | 800 px showcase and 380 px sign-in form | Split and form width are present; illustrative copy differs intentionally. |
| V02/V03 | 232 px sidebar, 64 px top bar, 200 px chat side padding, 48 px composer | The extra history toolbar and message heading consume vertical space; the composer still follows document flow rather than occupying the frame footer. |
| V04/V05 | 64 px rail, 380 px queue, 340 px ticket history, 64 px conversation header | Queue density, conversation header, handoff event presentation, and ticket-history grouping remain different. |
| V06 | Read-only profile with two cards | Password age and reset delivery are unavailable; the app shows an explicit disabled action. |

Extra application views and states should use the Pencil color, typography,
spacing, and control patterns without inventing service data. Full V01-V06
fidelity remains open under issue #9.

For the subsequent direct-source CSS and queue-search changes, typecheck,
lint, 144 unit tests, 53 integration tests, and the targeted Chromium queue
search and queue-layout tests passed. The complete build/e2e gate has not yet
been rerun while the owner is viewing the live worktree on ports 3000/3001.
