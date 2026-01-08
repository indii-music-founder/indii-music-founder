# Access Journal

## 2025-01-07 - Axe Preload Timeout in JSdom
**Learning:** `axe-core` attempts to preload assets (like CSS/images) even in a JSdom environment where network requests might fail or time out, causing `Couldn't load preload assets` errors in the test console, although the test might still pass.
**Action:** Configure `axe` with `{ preload: false }` or explicit rules when running in simulated environments to speed up tests and avoid console noise. For now, simply increasing timeout works but isn't efficient.

## 2025-01-07 - Missing Aria-Pressed on Selection
**Learning:** The `DailyItem` component relies on visual class switching (`border-yellow-500`) to indicate selection but lacks `aria-pressed` or `aria-selected`. This makes the state invisible to screen readers.
**Action:** Update components that function as toggles or selectable items to use `aria-pressed={isSelected}` or `aria-selected={isSelected}`.
