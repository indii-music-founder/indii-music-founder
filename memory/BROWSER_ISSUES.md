# Browser Interaction Log - Copyright Office Portal

**Target:** <https://publicrecords.copyright.gov/>
**Last Attempt:** 2026-02-03 11:15 AM EST

## Issues Encountered

- **CDP Bridge Instability:** Repeated "tab not found" errors even when the tab is visible in the `tabs` list.
- **Service Timeouts:** The `browser.act` tool timed out (20s) when trying to `fill` or `type` into the search box [ref=e43].
- **Anti-Bot/Complex UI:** The site uses multiple nested iframes (demdex.net) and heavy JavaScript, which appears to be interfering with the CDP execution thread.

## Insights

- Standard CDP `fill` actions are failing; the site might be intercepting high-level events.
- Window management on this portal is non-standard (opens secondary windows for results), which likely breaks the session attachment for the browser tool.
- **Bypass Strategy:** Offload browser execution to external automation (Antigravity ID) via markdown file handoff.

## Conclusion

Paused browser-based attempts for this portal. Moving to code-side logic and documentation prep.
