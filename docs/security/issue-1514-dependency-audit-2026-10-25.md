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

## 2026-10-28 gRPC resolution follow-up

Baseline `a7449d6b3` still audits at 0 critical / 18 high / 7 moderate. Although root overrides already named `@grpc/grpc-js` 1.14.6, the lock retained 1.9.16 under both root `@firebase/firestore` and landing. A normal lock-only update of gRPC and then its Firestore parent left those entries unchanged. Merely inspecting the manifest therefore did not prove remediation.

The repair explicitly scopes the same 1.14.6 override to Firestore and re-resolves those two stale lock entries in an isolated manifest workspace using Node 24.22.1/npm 11.20.0. The resulting graph deduplicates both to the existing patched root package. No Firebase downgrade, forced install, peer-check bypass, unrelated version upgrade, or change to the running checkout's shared node_modules was used. The only accompanying lock classification change marks landing's no-longer-runtime Node type dependencies as development dependencies. Unrelated package-manager cleanup was excluded.

| Evidence | Observed result | Limit |
| --- | --- | --- |
| `npm audit --omit=dev --json` before/after | High 18 → 14; critical remains 0; moderate remains 7; gRPC and its Firestore/Firebase meta-advisories disappear | Registry results are dated observations, not a clean security or exploitability verdict |
| Isolated `npm ci --ignore-scripts --no-audit`, Node 24.22.1/npm 11.20.0 | Exit 0; 2,903 packages installed | Lifecycle/native postinstall scripts deliberately not executed; Functions still declares Node 22 and its engine warning is retained |
| Actual installed package resolution from both Firestore package locations | Both load gRPC 1.14.6; Metadata construction/set/get succeeds | Package resolution/API check only; no authenticated Firestore transport, server or customer path tested |
| `scripts/check-grpc-resolution.mjs` against original and repaired locks | Original exits 1 identifying both 1.9.16 entries; repaired exits 0 | Guard validates the resolved lock graph, not an already-installed or deployed tree |

The new lock guard runs before the existing lint checks, requiring every resolved gRPC copy to equal the exact reviewed patched override. Generated capability catalogs were refreshed to record that npm script without granting agent certification.

The [upstream certificate-authentication advisory GHSA-m9gg-hp2v-232j](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) concerns server `getAuthContext` use with optional client certificates; its fixed lines include 1.13.6 and 1.14.5. The [1.14.6 release](https://github.com/grpc/grpc-node/releases/tag/%40grpc%2Fgrpc-js%401.14.6) also addresses remaining error-disclosure cases from GHSA-f596-whhp-79r4. No application call to `getAuthContext`, `ServerCredentials.createSsl`, or gRPC xDS was found in package source. That source search does not prove transitive/runtime non-reachability; removal of the affected versions is the remediation evidence.

Full repository typecheck passed both in the original checkout and against the freshly installed patched graph under Node 24; full lint passed with zero errors and 235 existing warnings. Ledger integrity, capability-catalog validation, guard syntax and diff checks passed.

Remaining 14 high and seven moderate findings still require their own compatible fixes/reachability reviews. This follow-up does not close ISSUE-1514, prove installed desktop/native packaging, or establish deployed Firebase acceptance. Jev's focused review of the install/audit/guard evidence is advisory only. Remote CI monitoring remains with the owner's existing systems.
