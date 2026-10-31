# Identity and history verification

PR [#15](https://github.com/kakahimita/nexo-assist/pull/15) merged the identity
and history increment into `main`. The original evidence below applies to
application revision `e01bbb8`; documentation-only changes do not add test
evidence.

## Verification of the merged increment

On 2026-10-31, revision `82402ed` was checked on Windows in a separate
worktree with Node 22.23.2 and npm 10.9.8:

- `npm ci` completed; its audit reported 18 vulnerabilities (16 moderate,
  2 high). Dependency remediation was not part of this verification.
- `npm run check` passed typecheck, lint, 67 unit tests, 12 integration tests,
  and build, then exited nonzero because API port 3001 was already in use.
  The existing development process was left running. Lint emitted the existing
  non-failing Next.js pages-directory warning.
- To complete the browser checks, the test harness and browser test URLs were
  temporarily changed in the isolated worktree to web port 4310 and API port
  4311; the web build used `NEXT_PUBLIC_API_BASE_URL` for the alternate API and
  the proxy used `API_BASE_URL`. `npm run test:e2e` then passed all 14 Chromium
  tests, including a separate API-process restart with a temporary database.
  The port-only test changes were reverted afterward. This is not a passing
  unmodified `npm run check` invocation.
- B01 and the conversation/message portion of B13 are covered by fixture login,
  session expiration and revocation, cross-employee denial, browser flows and
  restart tests. The acceptance criteria stated in issue #4 were demonstrated.
  Ticket persistence and waiting/assigned human ownership are not implemented
  by #4 and remain acceptance work for later deliveries.
- V01: Chromium screenshots of the running development checkout (same
  application tree as the merged revision) were inspected at 1440 × 900 and
  390 × 844 against the hash-verified `bi8Au` frame and owner-supplied 3x
  rendering. The split layout and mobile adaptation were present; a keyboard
  submission showed the expected error, and the mobile page had no horizontal
  overflow. The visual check used intercepted session responses and screenshots
  under a local worktree `outputs/` directory. It does not establish pixel
  fidelity against a native Pencil export.
- The live model smoke was not rerun; this increment does not implement model
  inference or agent answers.

## Original verification

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
