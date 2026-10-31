# Identity and history verification

Issue #4 is in progress. Evidence below applies to application revision
`e01bbb8`; documentation-only changes do not add test evidence.

- `npm run check` on Windows: typecheck, lint, build, 67 unit tests, 12 integration
  tests and 12 browser tests passed. The Next.js lint plugin emitted a pages-directory
  warning despite the App Router; the command exited successfully.
- B01: tests cover fixture login, unknown identity, server sessions, malformed,
  expired and revoked cookies, employee isolation and forged input. Analyst login
  works; analyst support workflows remain future work.
- B13: integration recreates the Nest application with the same isolated database
  and restores a session and message. Browser coverage checks reload, isolation,
  and recovery after restarting a separate API process with an isolated database.
- V01: a Chromium screenshot at 1440 × 900 was compared with the verified
  owner-supplied 3x image and `bi8Au` geometry. The two-column composition is
  present; typography, spacing, illustration and other visual details differ.
  Narrow viewport overflow was checked. Native Pencil export comparison remains
  unavailable; this is not a claim of full visual acceptance.
- A subsequent login refinement was compared in Chromium at 1440 × 900
  and 390 × 844, using the verified `.pen` frame and owner-supplied rendering.
  The layout now uses the design's font families and colors; its illustrative
  content and sample metrics are visibly marked as illustrative, distinct from
  working services. The mobile form, keyboard error feedback, and password-visibility
  control were checked locally with Chromium; the latter has a keyboard test.
  Screenshots are kept under `outputs/`, separate from reference assets. This
  comparison does not establish native-editor pixel fidelity.
- The live model smoke was not rerun for this delivery. No model inference or
  agent responses are implemented by this issue.
