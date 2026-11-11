# Dependency audit remediation

## Findings and changes

The initial npm lock reported ten affected dependency nodes: four high, four
moderate and two low. Some nodes inherited findings from their dependencies;
this was not a count of ten independent advisories. All paths were development
dependencies, including tooling that runs during production builds.

| Initial affected node | Remediation |
| --- | --- |
| `vite` | Update 8.0.16 to 8.3.7, outside the reported affected 8.x range. |
| `@vite-pwa/assets-generator` | Update 1.0.2 to 1.0.4, which allows patched sharp 0.35.5. |
| `sharp` | Resolve the generator and sharp-ico paths to 0.35.5. |
| `defu` | Override to patched 6.1.7. |
| `glob` | Override to patched 14.0.3; verify Workbox generation with its newer API. |
| `minimatch` | Resolve glob's dependency to the patched 11.x line. |
| `deepmerge` | Replace with the API-compatible `@shivammathur/deepmerge` 4.3.2 fork. |
| `@rollup/plugin-node-resolve` | Inherited deepmerge finding is removed by the fork. |
| `workbox-build` | Inherited glob and resolver findings are removed by those updates. |
| `vite-plugin-pwa` | Inherited Workbox findings are removed without downgrading the plugin. |

The deepmerge upstream advisory has no published patched release. The selected
fork rejects `__proto__` in both source and target key traversal, while retaining
the upstream merge API. Tests resolve the package through the actual Rollup
consumer and cover malicious targets, null-prototype targets, nested sources,
arrays, cloning, symbols, `merge.all`, and custom array merging.

The older pnpm lock also retained vulnerable versions of `brace-expansion`,
`browserslist`, `baseline-browser-mapping`, and `fast-uri`. Matching overrides
set patched versions in both package managers. The brace-expansion override is
limited to its existing 2.x consumers; newer consumers retain their major version.
Both lockfiles are checked in. The npm manifest and pnpm workspace carry the
same overrides because each package manager reads a different configuration.

No audit exclusions, severity filters, registry changes, or release-age exceptions
are used. PWA, offline precaching, asset generation and the existing plugin are
retained. Node.js 24 remains the documented and deployed runtime.

## Verification

All security inputs and invoice fixtures are synthetic. No customer files or
historical attachments are used.

- `npm audit --json`: zero findings.
- `pnpm audit --json`: zero findings.
- Security tests: three passed through each installed dependency tree.
- Chromium regression tests: sixteen passed, including actual XML/PDF upload,
  downloaded XML parsing, and copied viewer XML.
- `npm run build` and `pnpm run build`: passed, including service-worker generation
  and precaching of the PDF worker.
- Locked installs checked with `npm ci` and `pnpm install --frozen-lockfile`.
- The updated asset generator produced PNG and ICO outputs from a synthetic SVG
  in a temporary directory, without rewriting the project's public assets.
- `git diff --check`: passed before submission.

Audit results reflect the registry advisories available during the review; they
are not a guarantee against future findings. The deepmerge fork and major glob
override must be reviewed when upstream dependencies release compatible fixes.
No deployment is implied by these local checks.

## Hosting and workflow compatibility

The existing GitHub changes to lazy PDF attachment loading and the pnpm-based
deployment were retained when reconciling the repository histories. The current
manifest retains the PDF.js 6.4 minimum and the deployment's declared pnpm version.
The repaired npm lock is retained for reproducible npm audit and test runs.

GitHub Pages build/deploy jobs explicitly require `github.server_url` to equal
`https://github.com`. Other Actions-compatible hosts must not enqueue this
GitHub-specific deployment on an unavailable hosted runner. This guard does not
create or claim a separate CI runner on another host. Commit signing and branch
protections are operational settings; the audit changes do not disable them.

## Sources

- [deepmerge advisory, no upstream patched version](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
- [Patched deepmerge fork](https://www.npmjs.com/package/@shivammathur/deepmerge)
- [glob advisory and patched versions](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
- [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)
- [defu advisory](https://github.com/advisories/GHSA-737v-mqg7-c878)
