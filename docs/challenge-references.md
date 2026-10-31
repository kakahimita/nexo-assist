# Original challenge references

The original files and images are local sources of truth. They are intentionally
excluded from the public Git repository by `/references/` in `.gitignore`.
Their absence in a fresh clone is expected, not permission to reconstruct them
from memory or application output. No original files are uploaded by this setup.

## Discovery in new sessions

Root `AGENTS.md` requires reading the [context](challenge-context.md),
[acceptance matrix](challenge-acceptance.md), and this index before work.
Use the sources relevant to implementation, tests, and review. A path in a
document does not attach an image automatically: open it with an image tool.
See [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Resolve the bundle in this order:

1. Read `git config --get nexo.challengeReferences` (a local, shared repository
   configuration entry, not a global setting or committed personal path).
2. If unset, get `git rev-parse --path-format=absolute --git-common-dir` and use
   `references/challenge/` in its parent, the main checkout. Linked worktrees
   therefore use the same bundle rather than needing another copy.
3. Read `manifest.json`, check the pinned source hashes below and the tracked
   [asset hash manifest](challenge-reference-hashes.json), and verify each
   asset needed for the task before using it. Never silently replace changed
   sources or regenerate a baseline to agree with the app.

This persists files and instructions in the local repository; it does not
share chat histories or automatically transfer ignored files to another
machine, a new clone, or a cloud environment. Existing chats may need to reread
`AGENTS.md`; another branch needs these documentation changes integrated.

## Bundle contents

| Local path within the bundle | Purpose and authority |
| --- | --- |
| `originals/challenge-prd-v5.pdf` | Original five-page PRD. Mandatory behavior, rules, deliverables, and evaluation. |
| `originals/nexo.zip` | Original archive supplied by the owner. Contains only the design file. |
| `originals/nexo.pen` | Byte-identical extracted design. Source of visual structure, dimensions, tokens, and example screens. |
| `originals/challenge-invitation.png` | Original recruitment-form screenshot, preserved for context. |
| `originals/pencil-share-manifest.json` | Metadata captured from the prototype link in PDF Annex C; version 2. |
| `prd-pages/page-01.png` through `page-05.png` | Readable 2x renders of the preserved PDF, for visual inspection. |
| `prd-text.txt` | Derived searchable extraction; check the PDF when order or content is unclear. |
| `screens/prototype-overview.png` | Unmodified official preview, 1200 x 296 pixels, containing all six frames. |
| `screens/01-login.png` through `06-profile.png` | Native-resolution crops of that preview; exact names and crop boxes are in the manifest. They are low-resolution derivatives. |
| `manifest.json` | Local asset paths, hashes, dimensions, source relationships, and provenance, including capture limitations. The tracked hash manifest pins the captured asset bytes independently of this local file. |

The shared compressed `.pen` object's checksum matched the official manifest;
after decompression its bytes matched the owner's extracted `.pen` exactly.
The official preview belongs to that same shared version. This ties the
preserved images to the supplied design rather than a recreated interface.
The live share URL is kept only in the local provenance manifest.

## Pinned source hashes

SHA-256 identifies the captured bytes; it does not make illustrative content a
business rule. Check these against both the files and `manifest.json`.

| Asset | SHA-256 |
| --- | --- |
| `originals/challenge-prd-v5.pdf` | `2ed575f31a883df4ebc90932317927615bbe55b42e70317e60a7a72d3dfb0912` |
| `originals/nexo.zip` | `3789fbee9a56e41fb37efc0bacb26ae15bf4a629fc93599d2bb27a0b40d84c25` |
| `originals/nexo.pen` | `60affca8d1fae0fc0e8accd7c61f6a2d83b9448159992f9a5b58fea120763402` |
| `originals/challenge-invitation.png` | `84bebfe4f23c4fbd3d6b17a4f1bf6e2413084fcc03c2dd08952eddbb49579a12` |
| `screens/prototype-overview.png` | `1cbf3179d973ecb3ea3151c8ff8833d7b832970fbf135027ba978583c6fb582e` |

For example, verify every asset against the tracked hash manifest in PowerShell,
after resolving the bundle path as above. A missing file or mismatch must fail:

```powershell
$referenceRoot = git config --get nexo.challengeReferences
if (-not $referenceRoot) {
    $commonGitDir = git rev-parse --path-format=absolute --git-common-dir
    $referenceRoot = Join-Path (Split-Path $commonGitDir -Parent) 'references/challenge'
}
$repositoryRoot = git rev-parse --show-toplevel
$manifestPath = Join-Path $repositoryRoot 'docs/challenge-reference-hashes.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -ErrorAction Stop | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or -not $manifest.assets) { throw 'Invalid reference hash manifest' }
foreach ($asset in $manifest.assets) {
    $actualHash = (Get-FileHash -LiteralPath (Join-Path $referenceRoot $asset.path) -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    if ($actualHash -ne $asset.sha256) { throw "Reference mismatch: $($asset.path)" }
}
Write-Output "Verified $($manifest.assets.Count) reference assets"
```

This checks asset integrity, not application correctness. Use the
[test matrix](challenge-acceptance.md) for behavioral and visual validation.

## Restoration and updates

For a new local clone or a private test environment, restore a private copy of
the entire `references/challenge/` bundle, including the manifest. Set
`git config --local nexo.challengeReferences "<absolute path to the bundle>"`
if it is stored elsewhere. Verify the source hashes and every asset afterward.
Keep a private backup before deleting the main checkout; ignored files are
not a Git backup. Do not publish the bundle in a PR, issue, CI log, or artifact.

If no bundle backup exists, recover the PDF, ZIP, and invitation from the owner's
original files; check the pinned hashes, extract `nexo.pen`, and regenerate PDF
page renders. Recover the official preview from the original prototype link
in PDF Annex C and verify that its shared design still matches the pinned
`.pen`. A changed live share is not the captured baseline. Recover unavailable
originals from the owner; do not substitute a generated or app screenshot.

Individual full-resolution PNG exports are still pending. The current preview
supports coarse composition checks, and `.pen` preserves exact design values;
the thumbnails cannot prove pixel fidelity. To extend the bundle, export the
original frame IDs listed in the acceptance matrix at 1x/2x using Pencil,
record scale, engine version, and hashes, and retain the original preview.
See the [official export workflow](https://docs.pen.dev/core-concepts/import-and-export).
CLI exports require Pencil authentication; do not request secrets in chat.

When the owner supplies a revised challenge, preserve the old snapshot, record
the new source version/hashes, review differences, and update this index,
context, both manifests, and affected acceptance cases together. Current application
behavior must never be the reason to change a source baseline.
