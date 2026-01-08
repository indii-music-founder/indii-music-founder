## 2026-01-08 - [CRITICAL] Race Condition in SSRF Protection
**Vulnerability:** The `electron/handlers/network.ts` file contained a critical race condition where a `fetch(url)` call was executed *before* the `validateSafeUrl(url)` check. This rendered the SSRF protection mechanism useless, allowing potential access to internal network resources or local files if a malicious URL was passed. The file also contained syntax errors (variable redeclaration) indicating a bad merge.
**Learning:** Security controls must be placed *before* the sensitive operation they protect. Automated linting and syntax checking are crucial to catch bad merges that duplicate code blocks.
**Prevention:**
1.  Fixed the order of operations in `net:fetch-url` to ensure `validateSafeUrl` runs before `fetch`.
2.  Ensured `validateSender` (Anti-Hijack) is the very first check.
3.  Removed duplicate code and syntax errors.
