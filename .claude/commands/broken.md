# /broken — Known Issues & Error Memory Audit

You are performing a comprehensive audit of known broken items and error patterns in the indiiOS codebase.

## Steps

1. **Read the BROKEN.md file** at the project root (`BROKEN.md`). This is the living document tracking all known broken items, incomplete implementations, and technical debt.

2. **Read the Error Ledger** at `.agent/skills/error_memory/ERROR_LEDGER.md` (if it exists). This tracks documented error patterns and their fixes to prevent repeating mistakes.

3. **Cross-reference** the two documents:
   - Are there items in BROKEN.md that have matching fixes in the Error Ledger?
   - Are there error patterns in the Ledger that aren't tracked in BROKEN.md?
   - Are there any items marked as "FIXED" that should be removed or archived?

4. **Check for new issues** by running `npm test -- --run --pool=forks --testTimeout=15000 2>&1 | tail -30` to see if there are any currently failing tests not yet documented.

5. **Report your findings**:
   - Summary of open issues (not yet fixed)
   - Any new issues found
   - Items that can be closed/archived
   - Recommended next actions, prioritized by impact

## Output Format

Present findings as a structured report with sections for:
- **Open Issues** (needs fixing)
- **Recently Fixed** (verify still working)
- **New Discoveries** (not yet documented — add to BROKEN.md)
- **Recommended Actions** (prioritized)

If you find new broken items, update BROKEN.md with them.
