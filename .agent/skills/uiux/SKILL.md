# indiiOS UI/UX Design Program

> [!IMPORTANT]
> This document defines the standard design language for the indiiOS ecosystem. All modules must adhere to these tokens and patterns to ensure a premium, consistent experience.

## 1. Core Principles

- **Environment-Aware Theming**: Each department has a primary brand color.
- **Glassmorphism**: Use semi-transparent backgrounds with high-blur and subtle borders.
- **Micro-interactions**: Use `framer-motion` for smooth state transitions and hover effects.
- **Consistency**: High-level dashboards share structural patterns (Sidebars, Toolbars, HUD Headers).

## 2. Department Tokens (CSS Variables)

Defined in `index.css`, these tokens should be used via Tailwind utilities or `var()`:

| Department | Token | Color | Usage |
| :--- | :--- | :--- | :--- |
| **Royalties (Finance)** | `--color-dept-royalties` | `#FFC107` | Precision, Wealth, Accuracy |
| **Marketing & PR** | `--color-dept-marketing` | `#E91E63` | Energy, Impact, Social |
| **Creative Studio** | `--color-dept-creative` | `#A855F7` | Vision, Intuition, Art |
| **Distribution** | `--color-dept-distribution` | `#2196F3` | Logistics, Flow, Reach |

## 3. Standard Layout Patterns

### Main Container

```tsx
<div className="h-screen bg-background text-foreground flex overflow-hidden">
  {/* Standard Sidebar */}
  <aside className="w-64 border-r border-white/5 bg-background/40 backdrop-blur-xl">
    ...
  </aside>

  {/* Main Content Area */}
  <main className="flex-1 flex flex-col relative overflow-hidden">
    <header className="h-14 border-b border-white/5 bg-background/20 backdrop-blur-md px-6 flex items-center">
      ...
    </header>
    <div className="flex-1 overflow-y-auto p-6">
      ...
    </div>
  </main>
</div>
```

## 4. Component Standards

### Focus States

Always use department-specific rings for interactive inputs:
`focus-visible:ring-2 focus-visible:ring-dept-[name]/50 focus-visible:ring-offset-0`

### Buttons

Primary action buttons should use the department background:
`bg-dept-[name] text-white shadow-lg shadow-dept-[name]/20 hover:opacity-90`

### Cards

Use the glassmorphism utility:
`bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl`

---

*Last Updated: 2026-01-20*
