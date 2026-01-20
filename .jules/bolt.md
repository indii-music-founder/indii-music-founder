## 2024-05-22 - Client-side Analytics Aggregation
**Learning:** `DashboardService` calculates analytics (word clouds, etc.) by iterating over the entire `generatedHistory` in memory on the client. Large intermediate string allocations (e.g., `history.map(...).join(' ')`) cause memory pressure proportional to total text size.
**Action:** Prefer iterative processing over bulk string operations (like `split` on massive strings) for large text datasets.
