## 2026-01-18 - Silent Failures in Data Fetching
**Learning:** `useMerchandise` returned an error object that was completely ignored by the UI, leading to a confusing "Empty State" when the API actually failed.
**Action:** Always destructure `error` alongside `data` and `loading`. If `error` exists, preempt the "Empty" state with an explicit error view to prevent user gaslighting.
