# Session Checkpoint — 2026-07-09

## Work Completed This Session

**7 Issues Fixed:**
1. ✅ ISSUE-796: Web3 balance error state (no more fake 100 ETH)
2. ✅ ISSUE-797: Creative gallery feedback and video extension fix
3. ✅ ISSUE-798: Omni lineage cleared on upload/reset
4. ✅ ISSUE-799: Veo models migrated to GA IDs (veo-3.1-*-001)
5. ✅ ISSUE-801: Mechanical license gate now fail-closed (CRITICAL)
6. ✅ ISSUE-804: SFTP upload throws on bridge unavailable (HIGH)
7. ✅ ISSUE-802: Mechanical royalty rates updated to 2026 statutory (13.1¢/work)

All fixes are committed and tested. Typecheck passes. Pre-commit gates all green.

## Remaining High-Priority Issues (8 open)

- ISSUE-800: Merlin readiness needs rights evidence checklist (HIGH, requires schema changes)
- ISSUE-803: Submit modal UX shows "delivered" even on dry-run (HIGH, status rethink)
- ISSUE-805: ERN generation defaults to LiveMessage instead of test (HIGH)
- ISSUE-806: Storage mislabels file extensions/MIME types (HIGH)
- Plus 4 more in backlog (ISSUE-807..810)

## Branch Status

- Current branch: `main`
- Last commit: 3fecd946a (mechanical royalty rates fix)
- All staged changes committed
- Working tree clean

## Next Steps

1. Fix ISSUE-805 (ERN live/test default) — straightforward environment flag wiring
2. Fix ISSUE-803 (submit modal UX) — add distinct status states
3. Address ISSUE-800 (Merlin rights) — requires new rights document schema
4. Handle ISSUE-806 (storage MIME types) — preserve extensions in uploads

## Notes for Next Session

- User's explicit goal: "fix the issues you're familiar with"
- Focus on HIGH/CRITICAL severity issues first
- ISSUE-801 was critical (silent mechanical license bypass) — now fixed
- Mechanical rates now compliant with 2026 law (13.1¢/work, 2.52¢/min)
- Web3 no longer fabricates balances
- Creative gallery feedback now honest (no false "recorded" claims)
