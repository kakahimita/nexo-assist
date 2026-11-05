# Employee visual follow-up (#48)

## Source and scope

The hash-verified original Pencil frames `IcuoM` (V02), `vbsNW` (V03), and
`i4fCbC` (V06) are the visual authority. The owner-supplied 3x screen PNGs are
readable HTML/CSS renderings, not native editor exports. PRD Annex C requires
the chat, ticket consultation, analyst console, and login states; the profile
is the agreed additional read-only frame.

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
