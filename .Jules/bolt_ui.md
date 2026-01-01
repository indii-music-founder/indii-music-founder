# Bolt UI Journal - indiiOS Design System Archive

> **Purpose:** Document visual unifications, department color mappings, and design system decisions.
> **Architect:** Bolt (UI/System Architect)
> **Last Updated:** 2025-12

---

## 2025-12-31 - Department Color System Implementation

### What Was Unified

Implemented the complete **Department Color System** - a single source of truth for all department-specific theming across indiiOS.

### Files Modified

| File | Change |
|------|--------|
| `src/index.css` | Added 11 department color variables with muted/glow variants, typography tokens, motion variables, and Bolt animation utilities |
| `src/core/theme/moduleColors.ts` | Refactored to use `text-dept-*` and `bg-dept-*` classes instead of hardcoded Tailwind colors |
| `src/core/theme/departmentRegistry.ts` | **NEW** - Type-safe department registry with `getDeptTheme()` utility |

### The Palette (Official Department Colors)

| Department | Color | Hex | CSS Variable |
|------------|-------|-----|--------------|
| Royalties & Finance | Gold | `#FFC107` | `--color-dept-royalties` |
| Distribution | Electric Blue | `#2196F3` | `--color-dept-distribution` |
| Marketing & PR | Vibrant Magenta | `#E91E63` | `--color-dept-marketing` |
| Legal & Contracts | Slate | `#455A64` | `--color-dept-legal` |
| A&R / Creative | Purple | `#9C27B0` | `--color-dept-creative` |
| Touring & Live | Deep Orange | `#FF5722` | `--color-dept-touring` |
| Publishing | Lime | `#8BC34A` | `--color-dept-publishing` |
| Social Media | Cyan | `#00BCD4` | `--color-dept-social` |
| Licensing | Teal | `#009688` | `--color-dept-licensing` |
| Brand | Amber | `#FFB300` | `--color-dept-brand` |
| Campaign | Coral | `#FF7043` | `--color-dept-campaign` |

### Visual Anti-Patterns Eliminated

1. **Hardcoded Tailwind colors** - Replaced `text-teal-400`, `text-emerald-400`, etc. with semantic `text-dept-*` classes
2. **Inconsistent department-to-color mapping** - Finance was green (should be gold), Marketing was teal (should be magenta)
3. **No CSS variable foundation** - Module colors existed only in TypeScript, not as CSS tokens

### New Utilities Added

```css
/* Bolt Animation - for AI-driven UI updates */
.indii-auto-update { animation: bolt-pulse 1.5s; }

/* Department-aware styling */
.dept-glow { box-shadow: 0 0 20px var(--dept-color); }
.dept-border-top { border-top: 2px solid var(--dept-color); }

/* Snappy interactions */
.bolt-interactive { transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
```

### Motion Standards

```css
--transition-speed: 0.25s;        /* Standard */
--transition-speed-fast: 0.15s;   /* Micro-interactions */
--transition-speed-slow: 0.4s;    /* Page transitions */
--transition-timing: cubic-bezier(0.4, 0, 0.2, 1);  /* Material ease */
--transition-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Playful */
```

### Typography Tokens

```css
--font-main: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;  /* Royalty/data screens */
--font-display: 'Geist', var(--font-main);
```

### Visual Impact

- **Eliminated:** 24 disparate color definitions scattered across `moduleColors.ts`
- **Reduced:** CSS redundancy by centralizing all department colors in `:root`
- **Enabled:** Dynamic department theming via `--dept-color` custom property

### The Vibe Check

The app now feels more "Alpha-to-Prod" ready. When switching between Marketing (magenta) and Legal (slate), the visual contrast immediately communicates which operational context you're in. Finance screens now have that "gold standard" premium feel instead of generic green.

---

## Design System Reference

### Usage in Components

```typescript
// Option 1: Use moduleColors (Tailwind classes)
import { getColorForModule } from '@/core/theme/moduleColors';
const colors = getColorForModule('marketing');
// colors.text = 'text-dept-marketing'

// Option 2: Use departmentRegistry (CSS variables)
import { getDeptTheme } from '@/core/theme/departmentRegistry';
const theme = getDeptTheme('marketing');
// theme.color = 'var(--color-dept-marketing)'

// Option 3: Apply to element directly
element.style.setProperty('--dept-color', theme.color);
element.classList.add('dept-border-top', 'indii-auto-update');
```

### Tailwind v4 Integration

The CSS variables are exposed in `@theme {}` block, enabling utilities like:

```html
<div class="text-dept-marketing bg-dept-marketing/10 border-dept-marketing">
  Marketing Department Card
</div>
```

---

## 2025-12-31 - Sidebar Navigation Enhancement

### What Was Unified

Enhanced the **Sidebar navigation** to visually display department colors, making each module instantly identifiable.

### Changes Made

| Component | Enhancement |
|-----------|-------------|
| `NavItem` | Added `--dept-color` CSS variable injection |
| Active indicator | Left border now uses department color (`border-l-[--dept-color]`) |
| Icon glow | Active icons have subtle `drop-shadow` using department color |
| Transitions | Applied `bolt-interactive` class for snappy 0.15s hover |

### Visual Result

When a module is active:
- **Left border accent** in department color (e.g., Marketing = Magenta `#E91E63`)
- **Text color** matches department theme
- **Icon glow** subtle shadow in department color
- **Background tint** 10% opacity of department color

### Code Pattern

```tsx
<button
  style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
  className={`
    bolt-interactive
    ${isActive ? `${colors.text} ${colors.bg} border-l-2 border-l-[--dept-color]` : '...'}
  `}
>
  <Icon className={isActive ? 'drop-shadow-[0_0_4px_var(--dept-color)]' : ''} />
</button>
```

### The Vibe Check

Users can now instantly identify which department they're in by the colored left border accent. Switching from Finance (Gold) to Legal (Slate) is immediately apparent, reducing cognitive load.

---

*Next session: Apply department theming to Manager cards and dashboard headers.*
