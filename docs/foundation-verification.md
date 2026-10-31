# Foundation verification

Status: in progress. Evidence below was collected on Windows on 2026-10-31
at commit `9f927c9` with uncommitted Task 5 changes; it is not evidence for a
clean checkout or CI. Node and npm versions are pinned in the repository.

| Check | Observed result |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed locally |
| `npm test` | 55 tests passed |
| `npm run test:integration` | 9 tests passed after increasing integration timeout; prior runs exceeded 5 seconds |
| `npm run test:e2e` | 5 Chromium tests passed |
| `GOOGLE_API_KEY` blank, `npm run smoke:model` | Nonzero exit and missing-key message |
| Clean clone setup and checks | Passed on Windows at `d593004`: `npm ci`, `db:init`, and `npm run check` in a path containing spaces; used `.env.example` and no private references |
| GitHub Windows/Linux CI | Not run |
| Real model tool and streaming | Passed locally on Windows on 2026-10-31 at `d593004`: Google `gemini-3.5-flash-lite`, prompt `foundation-v1`, one observed tool execution, three text chunks, 2,277 ms, 524 input and 93 output tokens |
| Product visual acceptance | Not run; diagnostic page is not a product screen |

The deterministic sequence for a clean checkout is `npm ci`, `npm run
db:generate`, `npm run db:init`, `npm run typecheck`, `npm run lint`, `npm
test`, `npm run test:integration`, `npm run build`, Chromium installation, and
`npm run test:e2e`. Live inference is separate and cannot be inferred from
these checks. No private reference bundle is needed for deterministic checks.

`npm audit` on 2026-10-31 reported 18 advisories (16 moderate, 2 high);
the high findings involve `@nestjs/platform-express` and transitive `multer`.
The suggested direct fix changes the Nest major version and has not been applied
or assessed for compatibility. Review and remediation remain outstanding.
