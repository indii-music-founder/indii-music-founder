# Full Sidebar Menu Gauntlet Execution Report

- **Date:** 2026-06-05 08:54:13
- **Total Duration:** 0.81 minutes
- **Summary:** 24 / 26 passed (92.3%)

## Status Grid

| # | Category | Target Name | Key | Status | Duration |
|---|----------|-------------|-----|--------|----------|
| 1 | MANAGER | Brand Manager | `brand` | ✅ PASS | 1.8s |
| 2 | MANAGER | Road Manager | `road` | ✅ PASS | 2.1s |
| 3 | MANAGER | Campaign Manager | `campaign` | ✅ PASS | 1.1s |
| 4 | MANAGER | Booking Agent | `agent` | ✅ PASS | 2.3s |
| 5 | MANAGER | Publicist | `publicist` | ✅ PASS | 1.3s |
| 6 | MANAGER | Creative Director | `creative` | ✅ PASS | 11.8s |
| 7 | DEPARTMENT | Marketing & PR | `marketing` | ✅ PASS | 3.0s |
| 8 | DEPARTMENT | Social Media Department | `social` | ✅ PASS | 1.9s |
| 9 | DEPARTMENT | Legal Department | `legal` | ✅ PASS | 1.0s |
| 10 | DEPARTMENT | Publishing Department | `publishing` | ✅ PASS | 1.9s |
| 11 | DEPARTMENT | Finance Department | `finance` | ✅ PASS | 2.1s |
| 12 | DEPARTMENT | Distribution Department | `distribution` | ✅ PASS | 1.4s |
| 13 | DEPARTMENT | Licensing Department | `licensing` | ✅ PASS | 1.1s |
| 14 | DEPARTMENT | Art & Merch Dept | `merch` | ✅ PASS | 2.4s |
| 15 | DEPARTMENT | Registration Center | `registration` | ❌ FAIL | 0.4s |
| 16 | DEPARTMENT | Security Agent | `security` | ✅ PASS | 1.4s |
| 17 | TOOL | Workflow Builder | `workflow` | ✅ PASS | 1.4s |
| 18 | TOOL | Audio Analyzer | `audio-analyzer` | ✅ PASS | 1.0s |
| 19 | TOOL | Knowledge Base | `knowledge` | ✅ PASS | 0.9s |
| 20 | TOOL | Memory Agent | `memory` | ✅ PASS | 0.9s |
| 21 | TOOL | Command Center | `observability` | ❌ FAIL | 0.4s |
| 22 | TOOL | Settings | `settings` | ✅ PASS | 1.0s |
| 23 | PROJECT | HQ Dashboard | `dashboard` | ✅ PASS | 2.0s |
| 24 | PROJECT | Boardroom HQ | `boardroom` | ✅ PASS | 1.6s |
| 25 | PROJECT | Founders Checkout | `founders` | ✅ PASS | 1.0s |
| 26 | PROJECT | Onboarding | `onboarding` | ✅ PASS | 1.2s |

## Detail Failures

### ❌ DEPARTMENT: Registration Center (`registration`)

**Duration:** 0.37s

**Execution Output:**
```text

> indii.music@1.64.1 test
> vitest --run packages/renderer/src/modules/registration


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.8 [39m[90m/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder[39m

[31mNo test files found, exiting with code 1
[39m
[2mfilter: [22m[33mpackages/renderer/src/modules/registration[39m
[2minclude: [22m[33m**/*.{test,spec}.?(c|m)[jt]s?(x)[39m
[2mexclude:  [22m[33mdist/**[2m, [22me2e/**[2m, [22mnode_modules/**[2m, [22m**/node_modules/**[2m, [22m.claude/**[2m, [22m.agent/**[2m, [22mlanding-page/**[2m, [22m_archive_legacy/**[2m, [22mtests/**[2m, [22mscripts/**[2m, [22mpackages/firebase/src/test/security/**[2m, [22me2e_interop.test.ts[39m


[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: REGISTRATION CENTER[0m
[34m[1m============================================================[0m

[36m[1m--- Running Unit & Integration Tests ---[0m

[36m[1mExecuting command:[0m npm run test -- --run packages/renderer/src/modules/registration

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: REGISTRATION CENTER[0m
[34m[1m============================================================[0m
Unit Tests: [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ TOOL: Command Center (`observability`)

**Duration:** 0.36s

**Execution Output:**
```text

> indii.music@1.64.1 test
> vitest --run packages/renderer/src/modules/observability


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.8 [39m[90m/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder[39m

[31mNo test files found, exiting with code 1
[39m
[2mfilter: [22m[33mpackages/renderer/src/modules/observability[39m
[2minclude: [22m[33m**/*.{test,spec}.?(c|m)[jt]s?(x)[39m
[2mexclude:  [22m[33mdist/**[2m, [22me2e/**[2m, [22mnode_modules/**[2m, [22m**/node_modules/**[2m, [22m.claude/**[2m, [22m.agent/**[2m, [22mlanding-page/**[2m, [22m_archive_legacy/**[2m, [22mtests/**[2m, [22mscripts/**[2m, [22mpackages/firebase/src/test/security/**[2m, [22me2e_interop.test.ts[39m


[34m[1m============================================================[0m
[34m[1m TESTING TOOL: COMMAND CENTER[0m
[34m[1m============================================================[0m

[36m[1m--- Running Unit & Integration Tests ---[0m

[36m[1mExecuting command:[0m npm run test -- --run packages/renderer/src/modules/observability

[34m[1m============================================================[0m
[34m[1m TOOL TEST RESULTS SUMMARY: COMMAND CENTER[0m
[34m[1m============================================================[0m
Unit Tests: [31mFAIL[0m

[31m[1m❌ Scoped Tool Testing Failed![0m

```

