## 2024-05-23 - Duplicate Attributes in JSX
**Learning:** React/JSX parsers often silently ignore duplicate attributes, taking the last one defined. This can lead to bugs where one `aria-label` or `className` overrides another intended for a different state (e.g., hover vs. default). `SocialFeed.tsx` had multiple instances of this, likely from copy-pasting or merging Tailwind classes with logic.
**Action:** When auditing components, specifically grep for `aria-label` and `className` occurring twice in the same tag block.
