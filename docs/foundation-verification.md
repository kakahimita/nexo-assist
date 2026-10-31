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
| Clean clone setup and checks | Not run |
| GitHub Windows/Linux CI | Not run |
| Real model tool and streaming | Not run; requires configured provider access |
| Product visual acceptance | Not run; diagnostic page is not a product screen |

The deterministic sequence for a clean checkout is `npm ci`, `npm run
db:generate`, `npm run db:init`, `npm run typecheck`, `npm run lint`, `npm
test`, `npm run test:integration`, `npm run build`, Chromium installation, and
`npm run test:e2e`. Live inference is separate and cannot be inferred from
these checks. No private reference bundle is needed for deterministic checks.
