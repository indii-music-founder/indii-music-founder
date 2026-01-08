## 2024-05-23 - [Post Generator Accessibility Polish]
**Learning:** `aria-labelledby` is essential for custom radio groups (like the Platform/Vibe selectors) where the visual label isn't a direct parent of the group container. Using `role="group"` without a clear label makes navigation confusing for screen readers.
**Action:** When creating custom selector groups, always ensure the group container references its label via ID, and ensure the decorative icons inside buttons are hidden (`aria-hidden="true"`) to reduce noise.
