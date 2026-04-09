## 2024-05-22 - Client-side Analytics Aggregation
**Learning:** `DashboardService` calculates analytics (word clouds, etc.) by iterating over the entire `generatedHistory` in memory on the client. Large intermediate string allocations (e.g., `history.map(...).join(' ')`) cause memory pressure proportional to total text size.
**Action:** Prefer iterative processing over bulk string operations (like `split` on massive strings) for large text datasets.

## 2024-05-23 - State Merging Complexity
**Learning:** Initializing large lists by merging local and remote state using `findIndex` inside `forEach` creates O(N*M) complexity, which becomes noticeable with large history.
**Action:** Use `Map` for O(1) lookups during merge operations to achieve O(N+M) complexity.

## 2026-01-25 - Regex-based Length Filtering
**Learning:** JS-level length checks inside string processing loops (e.g., `word.length > 3`) still incur allocation costs for the short strings.
**Action:** Move length filtering to the Regex engine (e.g., `/\S{4,}/g`) to prevent allocation of filtered-out strings entirely.

## 2025-01-25 - Sorting Strings
**Learning:** `localeCompare` is significantly slower (~45x) than binary operators (`<`, `>`) for simple ASCII strings like ISO dates (`YYYY-MM-DD`).
**Action:** When sorting IDs, ISO dates, or other ASCII keys where locale rules don't matter, prefer binary comparison.

## 2025-01-26 - Premature React.memo on Atoms
**Learning:** Applying `React.memo` to generic atomic components (like Button) without profiling is risky. If props (like `onClick` or `children`) are unstable, the memoization overhead is wasted.
**Action:** Only memoize atoms if measurement shows they are re-rendering frequently with stable props, or if they are "pure" presentational components often used in large lists.

## 2025-01-26 - Canvas Stroke Batching
**Learning:** Calling `ctx.stroke()` inside a loop (e.g., for a grid) triggers expensive rasterization for every segment, causing high CPU/GPU overhead (~1300 calls/frame vs 1).
**Action:** Batch path construction using `ctx.moveTo`/`ctx.lineTo` inside the loop, and call `ctx.stroke()` ONCE at the end. Use separate loops if fill/stroke layering is required.
## 2026-01-26 - Context Splitting for Input Performance
**Learning:** A unified React Context that holds both rapidly changing state (`value`) and stable configuration (`disabled`) forces all consumers to re-render on every keystroke, even those that only depend on the stable props.
**Action:** Split Contexts into `ValueContext` (volatile) and `StateContext` (stable) so that components like Action Buttons can subscribe only to the stable context and avoid re-rendering during typing.
## 2025-04-08 - Added React.memo to TraceViewer component
**Learning:** Found that `TraceViewer` component in `packages/renderer/src/components/studio/observability/TraceViewer.tsx` was not using `React.memo`, even though it manages its own state for traces and selected traces. This component renders a list of traces and can be susceptible to unnecessary re-renders when parent components update.
**Action:** Wrapped `TraceViewer` with `React.memo` to prevent re-renders when parent components update and its own state remains unchanged.
