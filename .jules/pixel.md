# Pixel's Journal

## 2024-05-22 - [KnowledgeChat Streaming Patterns]
**Learning:** JSDOM does not calculate layout properties like `scrollHeight` or `scrollTop` automatically. To verify auto-scrolling behaviors, we must explicitly define `scrollHeight` on the target element (often via `Object.defineProperty` or specific mocks) and verify that the component logic updates `scrollTop` to match.
**Action:** When testing streaming interfaces, mock the scroll container's `scrollHeight` to simulate growing content and assert that `scrollTop` is updated to track it.
