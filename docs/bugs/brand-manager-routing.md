# BUG: Brand Manager Routes to Wrong Page

**Date:** 2026-03-04  
**Severity:** MEDIUM  
**Status:** CONFIRMED

## Summary
Brand Manager sidebar item routes to Campaign Dashboard instead of the Brand Manager page.

## Details
- **Sidebar Item:** Brand Manager
- **Expected Route:** `/brand` (or similar brand management page)
- **Actual Route:** `/campaign`
- **Result:** Shows Campaign Dashboard with Campaign Manager agent

## Impact
- Users cannot access brand management features
- Brand assets, guidelines, identity tools inaccessible
- Campaign dashboard shown instead of expected brand tools

## Related
- Campaign Dashboard works correctly (shown at wrong time)
- Sidebar navigation routing table likely has incorrect mapping

## Fix
Update sidebar navigation config to route Brand Manager to correct page.
