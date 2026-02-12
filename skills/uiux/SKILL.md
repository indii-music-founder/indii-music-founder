---
name: UI/UX Expert
description: Expert on indiiOS design system, accessibility, responsive layout, and Framer Motion.
version: 2.0.0
last_updated: 2026-02-06
---

# UI/UX Expert (Platinum Level)

**Expert mastery of the indiiOS visual language, animations, and accessibility.**

---

## 1. Core Visual Language

> **"Glass, Light, and Depth."**

indiiOS uses a futuristic, high-performance aesthetic.

- **Backgrounds:** Dark, translucent glass (`backdrop-filter: blur()`).
- **Gradients:** Subtle, organic gradients using `color-mix`.
- **Borders:** 1px distinct borders (`white/10`).
- **Shadows:** Multi-layered shadows for depth.

---

## 2. Design Tokens (CSS Variables)

ALWAYS use tokens. NEVER hardcode hex values.

### 2.1 Department Colors

| Dept | Token | Usage |
| --- | --- | --- |
| **Creative** | `--color-dept-creative` | Studio, AI generation |
| **Finance** | `--color-dept-finance` | Dashboard, charts |
| **Legal** | `--color-dept-legal` | Contracts, rights |
| **Marketing** | `--color-dept-marketing` | Campaigns, social |
| **Global** | `--color-primary` | Main actions |

### 2.2 Spacing & Radius

| Scale | Token | Pixels |
| --- | --- | --- |
| **Space** | `--space-1` to `--space-12` | 4px to 48px |
| **Radius** | `--radius-sm` to `--radius-full` | 2px to 9999px |

---

## 3. Component Standards

### 3.1 Glass Card

```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}
```

### 3.2 Department Buttons

```css
.btn-dept-creative {
  background: linear-gradient(135deg, var(--color-dept-creative), color-mix(in srgb, var(--color-dept-creative) 80%, black));
  color: white;
  font-weight: var(--font-semibold);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-md), 0 0 20px rgba(168, 85, 247, 0.3);
}

.btn-dept-creative:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(168, 85, 247, 0.4);
}

.btn-dept-creative:active {
  transform: translateY(0);
}
```

### 3.3 Sidebar Layout

```css
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 256px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border-right: 1px solid var(--color-border);
  padding: var(--space-6);
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.main-content {
  flex: 1;
  margin-left: 256px;
  overflow: hidden;
  padding: var(--space-8);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -256px;
    z-index: 50;
    transition: left 0.3s ease;
  }
  
  .sidebar.open {
    left: 0;
  }
  
  .main-content {
    margin-left: 0;
    padding: var(--space-4);
  }
}
```

---

## 4. Micro-Interactions (framer-motion)

### 4.1 Standard Variants

```typescript
import { motion, Variants } from 'framer-motion';

// Fade + Slide Up
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

// Scale on Hover
export const scaleOnHover: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 }
};

// Stagger Children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

// Pop In
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  }
};
```

### 4.2 Usage Examples

```tsx
// Card with hover effect
<motion.div
  className="glass-card"
  variants={scaleOnHover}
  initial="initial"
  whileHover="hover"
  whileTap="tap"
>
  <CardContent />
</motion.div>

// Staggered list
<motion.ul variants={staggerContainer} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.li key={item.id} variants={fadeInUp}>
      {item.content}
    </motion.li>
  ))}
</motion.ul>

// Page transitions
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

---

## 5. Accessibility Requirements (CRITICAL)

### 5.1 Mandatory Attributes

```tsx
// ❌ WRONG
<button onClick={handleSubmit}>
  <Icon />
</button>

// ✅ CORRECT
<button 
  onClick={handleSubmit}
  aria-label="Submit form"
  type="submit"
>
  <Icon aria-hidden="true" />
</button>

// ❌ WRONG
<input type="email" placeholder="Email" />

// ✅ CORRECT
<div>
  <label htmlFor="email-input">Email Address</label>
  <input 
    id="email-input"
    type="email" 
    placeholder="you@example.com"
    aria-required="true"
  />
</div>

// ❌ WRONG
<div className="modal">...</div>

// ✅ CORRECT
<div 
  role="dialog" 
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Modal Title</h2>
  ...
</div>
```

### 5.2 Focus Management

```css
/* Focus visible ring for keyboard navigation */
.interactive:focus-visible {
  outline: 2px solid var(--color-dept-creative);
  outline-offset: 2px;
}

/* Remove outline for mouse users */
.interactive:focus:not(:focus-visible) {
  outline: none;
}

/* Skip link */
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 999;
}

.skip-link:focus {
  left: 50%;
  transform: translateX(-50%);
  top: 10px;
}
```

### 5.3 Color Contrast

| Element | Minimum Ratio | Recommended |
| --- | --- | --- |
| Body text | 4.5:1 | 7:1 |
| Large text (18px+) | 3:1 | 4.5:1 |
| Interactive elements | 3:1 | 4.5:1 |
| Focus indicators | 3:1 | 4.5:1 |

---

## 6. Mobile-First Patterns

### 6.1 Touch Targets

```css
/* Minimum 44x44px touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Toolbar spacing */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  gap: var(--space-2);
}
```

### 6.2 Responsive Modals

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.modal-content {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

/* Full-screen on mobile */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }
  
  .modal-content {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    max-height: 95vh;
  }
}
```

---

## 7. Dark Mode Implementation

```css
/* CSS variables with prefers-color-scheme */
:root {
  color-scheme: dark light;
}

/* Dark mode (default) */
[data-theme="dark"] {
  --color-bg-primary: #0a0a0a;
  --color-text-primary: #ffffff;
  /* ... dark tokens */
}

/* Light mode */
[data-theme="light"] {
  --color-bg-primary: #ffffff;
  --color-text-primary: #0a0a0a;
  /* ... light tokens */
}

/* System preference fallback */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --color-bg-primary: #ffffff;
    --color-text-primary: #0a0a0a;
  }
}
```

---

## 8. Loading States

### 8.1 Skeleton Screens

```tsx
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div 
    className={`skeleton ${className}`}
    aria-hidden="true"
  />
);

// CSS
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite ease-in-out;
  border-radius: var(--radius-sm);
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 8.2 Loading Spinners

```tsx
const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <svg 
    className={`spinner spinner-${size}`}
    viewBox="0 0 24 24"
    aria-label="Loading"
    role="status"
  >
    <circle cx="12" cy="12" r="10" />
  </svg>
);
```

---

## 9. Best Practices Checklist

### Design

- [ ] No hardcoded colors (use dept-* tokens)
- [ ] Glass/blur effects on elevated surfaces
- [ ] Consistent border radius (use tokens)
- [ ] Proper shadow hierarchy

### Motion

- [ ] Exit animations for removed elements
- [ ] Staggered animations for lists
- [ ] Hover/tap states on interactive elements
- [ ] Page transitions with AnimatePresence

### Accessibility

- [ ] All inputs have labels with `htmlFor`
- [ ] Icon buttons have `aria-label`
- [ ] Modals have `role="dialog"` + `aria-modal`
- [ ] Focus visible outlines work
- [ ] Color contrast meets WCAG AA

### Mobile

- [ ] Touch targets ≥ 44px
- [ ] Scrollable modals on small screens
- [ ] Bottom-aligned mobile navigation
- [ ] No horizontal overflow

---

## 10. Anti-Patterns (AVOID)

```css
/* ❌ NEVER DO THIS */
.bad-button {
  background: red;           /* Use tokens */
  position: absolute;        /* Avoid for main layouts */
  bottom: 3px;              /* Use spacing tokens */
}

/* ✅ CORRECT */
.good-button {
  background: var(--color-dept-marketing);
  /* Layout via flexbox/grid */
  margin-bottom: var(--space-3);
}
```
