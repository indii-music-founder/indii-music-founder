## 2024-06-27 - [Unbreakable Code Blocks]
**Learning:** `ReactMarkdown` does not automatically apply `overflow-x-auto` to code blocks styled with Tailwind Typography (`prose`) unless specifically configured or overridden.
**Action:** Always override the `pre` component in `ReactMarkdown` to wrap it in a container with `overflow-x-auto` for mobile resilience.
