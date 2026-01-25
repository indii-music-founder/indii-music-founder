## 2024-05-22 - Client-side Analytics Aggregation
**Learning:** `DashboardService` calculates analytics (word clouds, etc.) by iterating over the entire `generatedHistory` in memory on the client. Large intermediate string allocations (e.g., `history.map(...).join(' ')`) cause memory pressure proportional to total text size.
**Action:** Prefer iterative processing over bulk string operations (like `split` on massive strings) for large text datasets.

## 2024-05-23 - State Merging Complexity
**Learning:** Initializing large lists by merging local and remote state using `findIndex` inside `forEach` creates O(N*M) complexity, which becomes noticeable with large history.
**Action:** Use `Map` for O(1) lookups during merge operations to achieve O(N+M) complexity.

## 2026-01-25 - Regex-based Length Filtering
**Learning:** JS-level length checks inside string processing loops (e.g., `word.length > 3`) still incur allocation costs for the short strings.
**Action:** Move length filtering to the Regex engine (e.g., `/\S{4,}/g`) to prevent allocation of filtered-out strings entirely.
