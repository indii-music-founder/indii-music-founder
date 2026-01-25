# indiiOS UI/UX Standards

**Design Language & Tokens.**

## 1. Core

* **Glassmorphism:** Blur backgrounds, semi-transparent.
* **Micro-interactions:** `framer-motion` mandatory for state/hover.

## 2. Dept Tokens (`index.css`)

* Finance: `--color-dept-royalties` (`#FFC107`)
* Marketing: `--color-dept-marketing` (`#E91E63`)
* Creative: `--color-dept-creative` (`#A855F7`)
* Distro: `--color-dept-distribution` (`#2196F3`)

## 3. Utils & Patterns

* **Layout:** Sidebar (`w-64 backdrop-blur`), Main (`flex-1 overflow-hidden`).
* **Focus:** `focus-visible:ring-2 focus-visible:ring-dept-[name]/50`.
* **Buttons:** `bg-dept-[name] text-white shadow-lg`.
* **Cards:** `bg-white/5 border-white/10 backdrop-blur-md rounded-2xl`.
