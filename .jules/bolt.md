## 2025-02-19 - Stable Arrays for Memoized Children
**Learning:** `React.memo` on a child component is ineffective if the parent passes a derived array (e.g., `.filter()`) directly in the render, as this creates a new reference every time.
**Action:** Always wrap derived data passed to memoized children in `useMemo` in the parent component, especially when the parent has high-frequency state updates (like video progress).
