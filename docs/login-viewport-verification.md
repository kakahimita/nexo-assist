# Desktop login viewport — issue #60

The owner requests all initial-page information without scrolling. Preserve the
original V01 two-column composition, existing copy, Free Tier warning and three
metric labels. Only whitespace and heading sizes adapt to short desktop heights;
inputs retain their existing 45 px height. No fixed-height container, overflow
clipping, hidden desktop content or CSS zoom is introduced.

At widths above 900 px and heights up to 1100 px, compact vertical spacing;
heights up to 760 px use a second compact spacing tier. Narrow layouts and browser
zoom retain document scrolling rather than clipping information. Fitting every
possible screen size without scrolling is not a supported or accessible guarantee.

Reference hashes were verified against the tracked manifest. This is an explicit
owner refinement of V01 spacing, not a change to the original assets or a claim
of native-design pixel fidelity. It builds on the pending #58 metrics increment.

## Evidence

The new 1366×768 geometry check failed before the change. An initial compact
layout still measured 749 px at 1280×720 with key feedback; measured block heights
identified the right-hand form stack as the cause. A second spacing tier fixed
that case without reducing input height or removing content.

Eleven isolated Chromium checks passed after correction: all four viewport
sizes (1440×900, 1366×768, 1280×720, 1024×768) have exact viewport-sized document
dimensions with both key-success and login-error feedback visible. Explicit
bounding checks cover the key input, login action, Free Tier warning, key-help
link, footer and metrics. Existing mobile overflow, password keyboard access,
model-key configuration and functional metric checks passed. The 1280×720 capture
was visually inspected.

Manual localhost:3100 verification at 1280×720 measured both viewport and document
as exactly 1280×720. A viewport-only screenshot (not a full-page composite) showed
the complete login, key warning/card, live indicators and footer. Capture:
`outputs/login-fit-localhost.png` (local, excluded from Git). The temporary browser
viewport override was reset afterward. Only the web process was restarted;
the API, database and memory-only model-key store were preserved.

Manual review covered breakpoint precedence, retained content/control sizes,
keyboard access, geometry assertions and safe narrow-screen flow. No outstanding
correctness findings were identified. No backend/model behavior changed; a live
provider check is not applicable to this CSS increment.

`npm run check` passed in the final tree: typecheck, ESLint, Prettier, 181 unit
tests, 64 integration tests, production build and 83 Chromium tests on isolated
databases/ports 3200 and 3201. No skipped or failed checks in that run.
