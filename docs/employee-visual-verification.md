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
The employee navigation now follows V02/V03 with `Atendimento` and `Meu perfil`.
Ticket consultation, draft confirmation, and human transfer remain inside the
chat. The latest persisted conversation resumes automatically after reload;
there is no direct employee history list or standalone ticket-management view.
`Nova conversa` remains available as an application control for starting a
different session. The selected conversation and unsent message remain mounted
when switching between chat and profile. The V06 password card shows the reset
action as disabled and explains that the service is unavailable.

## Visual comparison

Local application captures: `outputs/consultation-desktop.png`,
`outputs/conversational-draft-desktop.png`, `outputs/ticket-card-1440x900.png`,
and `outputs/profile-v06-1440x900.png`. The V02/V03 conversation composition is
closer because the standalone ticket list no longer extends the chat screenshot.
V06 now contains a second card at the position of the prototype password area.
The later V03 navigation correction removes the compact history bar and the
extra `Meus chamados` navigation item visible in the earlier captures.

Differences remain: V02/V03 example text, public ticket numbers, ticket
descriptions, richer status vocabulary, illustrative presence/count indicators,
and optional handoff buttons depend on unavailable data or conflict with PRD
behavior. The native Pencil export is unavailable, so exact typography and
pixel fidelity are not claimed. The extra `Nova conversa` action, message
heading, and document-flow composer still differ from the Pencil frame.

## Verification

An earlier revision passed the full `npm run check` gate with isolated ports 3100/3101 and a
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
| V02/V03 | 232 px sidebar, 64 px top bar, 200 px chat side padding, 48 px composer; no employee history or ticket navigation | Direct history and ticket navigation have been removed. The extra new-conversation action and message heading consume vertical space; the composer still follows document flow rather than occupying the frame footer. |
| V04/V05 | 64 px rail, 380 px queue, 340 px ticket history, 64 px conversation header | Queue density, conversation header, handoff event presentation, and ticket-history grouping remain different. |
| V06 | Read-only profile with two cards | Password age and reset delivery are unavailable; the app shows an explicit disabled action. |

Extra application views and states should use the Pencil color, typography,
spacing, and control patterns without inventing service data. Full V01-V06
fidelity remains open under issue #9.

Before the V03 navigation correction, the direct-source CSS and queue-search
changes passed typecheck,
lint, 144 unit tests, 53 integration tests, and the targeted Chromium queue
search and queue-layout tests. At that revision, the complete build/e2e gate
had not yet been rerun while the owner viewed the live worktree on ports 3000/3001.

## V03 navigation correction

Direct inspection of Pencil frame `vbsNW` confirms Ana's sidebar contains only
Atendimento and Meu perfil. Ticket selection and the transfer offer are part of
the conversation; the frame has no employee history list. Conversation
persistence is a backend requirement and does not imply a separate history
screen. Atendimento now loads the newest persisted conversation. A loading
state prevents interaction with the previous conversation while a new one is
created, and stale initial responses cannot replace the new selection.

Standalone ticket-view browser tests were retired because that screen is no
longer part of the employee UI. Conversational draft confirmation and ticket
consultation remain covered in Chromium; authorization, duplicate handling,
reopening, and idempotent writes remain covered in API integration tests.
The fresh `npm run check` passed with isolated ports 3100/3101 and a temporary
database: 144 unit tests, 53 integration tests, and 62 Chromium browser tests.
This correction does not establish full V02/V03 pixel fidelity.

## V03 consultation follow-up in PR #47

The current follow-up removes the permanent `Nova conversa` and human-contact
buttons from the first chat view. A first conversation opens automatically; a
new session remains available at the 30-message limit and after closure. Ticket
choices are clickable rows with the existing open, resolved, and overdue states.
The selected row is highlighted, and choosing it sends one title to the agent.
After a completed single-ticket response, `Falar com um analista` appears in
the agent's bubble. Agent-provided quick replies remain in the same location;
human contact also remains available when a turn fails or the session is capped.
The backend still performs automatic overdue transfer under the PRD.

At 1440 x 900, the message area now scrolls independently and the 48 px
composer stays at the foot of the chat. The visible `Mensagens` heading is
removed. These changes follow Pencil frame `vbsNW`; the richer sample status
labels and public ticket numbers remain absent from the current contract.
The original frame and guide remain the visual comparison sources. Full V03
fidelity and native Pencil pixel equivalence are not claimed.

The fresh `npm run check` completed on isolated ports 3100/3101 with temporary
databases: typecheck, lint, format, 144 unit tests, integration tests, build,
and 64 Chromium tests passed. The 1440 x 900 overdue-transfer capture was
inspected alongside the verified V03 guide. The real fixture transfers an
overdue ticket automatically, so its waiting banner and response do not mirror
the prototype's optional transfer example. The guide also includes public
ticket numbers, descriptions, and three finer status labels absent from the
current ticket contract; they were not fabricated for the capture.
