# ISSUE-1514 dependency audit — 2026-10-25

## Scope and method

Audit the lockfile with `npm audit --omit=dev --json`, then inspect `npm ls --all --omit=dev` for dependency paths. This is a package-graph assessment, not proof that any advisory's vulnerable call path is reachable. The registry's live advisory set may change between runs. Keep the CI audit step advisory until the residual packages have compatibility and runtime reachability evidence; a green workflow must not be described as a clean security audit.

| Production graph audit | Low | Moderate | High | Critical |
| --- | ---: | ---: | ---: | ---: |
| `origin/main` baseline `79df4f503` | 1 | 10 | 32 | 2 |
| This branch's lockfile | 0 | 7 | 18 | 0 |

Compatible updates in this branch include DOMPurify 3.4.17, proxy-addr 2.0.8, Express 4.22.3, body-parser 1.20.9/2.4.0, MCP SDK 1.32.2, electron-updater 6.8.11, sharp 0.35.5, axios 1.20.0, @fastify/busboy 3.2.4, @xmldom/xmldom 0.8.15, adm-zip 0.6.1, follow-redirects 1.16.1, source-map-js 1.2.2, Hono 4.13.14, @hono/node-server 2.1.5, fast-uri 3.1.9 and js-yaml 4.3.2. Some packages still appear in the audit through separate older nested copies or another affected dependency.

`npm audit fix --dry-run` was rejected by the existing `react-call@2.0.1` peer requirement of Vite >=8 while the project uses Vite 6. A direct Vite 6.4.5 update also failed dependency resolution. No force install or peer bypass was used; that attempted manifest edit was reverted.

## Residual high-severity triage

The following owners are module ownership lanes for follow-up, not named human assignments. Each row requires a separate compatibility check and an actual vulnerable-call-path review before its risk can be closed.

| Packages reported by audit | Owner | Current evidence and follow-up |
| --- | --- | --- |
| `firebase`, `@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js` | Firebase platform | Landing and renderer use Firebase 12; Firestore brings nested gRPC 1.9.16 while a patched root gRPC 1.14.6 also exists. Audit suggests a major Firebase downgrade, which is not a safe automatic fix. Test a supported upstream Firebase/Firestore release or bounded override and inspect actual Firestore transport use. |
| `@modelcontextprotocol/sdk`, `zod`, `zod-to-json-schema` | Agent and shared contracts | MCP SDK was upgraded to 1.32.2; its residual high severity now flows through pinned Zod 3.25.76. Zod 4 requires a cross-workspace schema/API migration. Inventory untrusted collection validation paths and test a coordinated migration. |
| `inngest` | Firebase jobs | Residual high severity flows through pinned Zod 3.25.76. Audit proposes an incompatible Inngest downgrade. Review Inngest input schemas and migrate Zod with the contract owners. |
| `hyperframes`, `@puppeteer/browsers`, `puppeteer-core`, `chromium-bidi` | Video runtime | HyperFrames 0.8.10 brings browser/download tooling with remaining advisories. Check whether each tool is invoked in deployed workers, then test an upstream compatible HyperFrames release with render fixtures before changing it. |
| `basic-ftp`, `get-uri`, `pac-proxy-agent`, `proxy-agent` | Video runtime/network | These sit under Puppeteer browser download/proxy tooling. The installed proxy-agent 6.5.0 is below a nested >=8.0.1 requirement; basic-ftp 5.3.1 needs a major move. Resolve the upstream tree and verify proxy/download behavior rather than forcing individual leaves. |
| `brace-expansion` | Renderer/upscaler | `wireit` expects brace-expansion 5, but one nested copy remains 2.1.4; `npm ls` reports that copy invalid. Repair this upstream resolution in the upscaler chain and run its build/tests. |
| `vite` | Web build | Vite 6.4.3 remains affected. Vite 6.4.5 could not resolve alongside the current react-call >=8 peer requirement. Fix that peer/toolchain combination, then upgrade and test dev-server access controls. |

The remaining moderate advisories are tracked by the same issue. A clean `npm ci --ignore-scripts --no-audit` installed 2,904 packages on the local Node 25 host, and focused tests passed. Supported Node 24 clean-install evidence and exact-SHA CI are still required; local tests cannot establish production reachability or release acceptance.

## 2026-10-28 brace-expansion / Wireit follow-up

Baseline `7a15de59f` retains a vulnerable `wireit/node_modules/brace-expansion` 2.1.4 despite Wireit 0.14.13 declaring `^5.0.6`; `npm ls` reports that copy invalid. Root brace-expansion 5.0.9 was also below the fix thresholds in the current primary advisories, even though the registry audit only attributed its reported finding to the nested 2.x copy.

The repair pins Wireit and minimatch 10.2.5 to brace-expansion **5.0.12**, preserving the existing patched **2.1.7** override for 2.x callers. It removes Wireit's stale nested 2.1.4 and now-unused balanced-match 1.0.2. Root brace-expansion and balanced-match become runtime dependencies because Wireit now resolves that root chain. No other package versions, Firebase resolutions, peer checks, or running-checkout node_modules are changed by this branch.

| Primary source inspected October 28 | Relevant patched lines |
| --- | --- |
| [GHSA-6j4f-fj2g-mc7p: comma-part recursion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | 5.0.10 and 2.1.5 |
| [GHSA-qhr7-859c-m2p7: nested-brace recursion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | 5.0.11 and 2.1.6 |
| [GHSA-q2hr-2g5m-vwhr: quadratic rewrite](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | 5.0.12 and 2.1.7 |

Evidence:

- Isolated manifest/lock re-resolution and `npm ci --ignore-scripts --no-audit` with Node 24.22.1/npm 11.20.0 succeeded; 2,901 packages installed. Native/lifecycle installation scripts were deliberately skipped; Functions' separate Node 22 engine warning remains.
- The installed Wireit executable ran a local file-copy task whose input glob uses brace alternatives, rebuilt after an input change, and skipped the third unchanged run. Output bytes were checked after each run. These are actual local build-tool operations, not substituted external service responses or a customer journey.
- The fresh production graph audit reports **0 critical / 17 high / 7 moderate**, compared with 0/18/7 on this branch's starting lock. No brace-expansion entry remains. These figures exclude the separately published gRPC branch; do not combine reductions before auditing an integrated graph.
- `scripts/check-brace-resolution.mjs` rejects the original lock (affected 5.0.9 and 2.1.4 plus wrong Wireit major) and accepts the repaired graph's 23 copies. It runs in lint and checks Wireit's actual lock resolution as well as every locked copy's reviewed version. Generated capability catalogs include the new script without granting agent certification.
- Full repository typecheck passed against the clean patched Node 24 graph; full lint passed with zero errors and 235 existing warnings. Ledger integrity, capability-catalog, guard syntax and diff checks passed.
- Jev 1.14 judged major-version integrity 0.91 and advisory alignment 0.83, and selected dependency-repair-only scope; its judgment remains advisory.

This repairs the dependency/API-resolution gap, not all of ISSUE-1514. Deployed image upscaling, packaged native/runtime behavior, customer acceptance and reachability of remaining advisories are unverified. CI monitoring remains with the owner's existing systems.
