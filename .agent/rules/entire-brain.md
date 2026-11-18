## Entire Brain & Graph

Use Entire Brain for task context, retained knowledge, and symbol-graph code inspection before falling back to broad grep.

Rules:
- Begin substantive tasks needing orientation with `entire brain brief "<task>" --json`
- Retrieve past decisions, invariants, and gotchas directly with `entire brain recall "<question>" --json`
- Record durable project learnings (architecture, constraints, preferences, project, workflow) with `entire brain remember "<memory>" --path <category.subcategory.type> --json`
- Use `entire brain inspect` (`code`, `search-graph`, `query-graph`, `context`, `impact`, `regressions`) for symbol-level navigation and regression analysis
- See `.entire/agent-guide.md` for the full command reference and verification rules
