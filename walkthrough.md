# Walkthrough: UI Standardization (Distribution & Core)

## Overview

This walkthrough documents the standardization of UI tokens and styles across the Distribution module and Core layout components. The goal was to remove hardcoded hex values and consistent apply the `indiiOS` design system (department tokens, glassmorphism, etc.).

## Key Changes

### 1. Distribution Module Components

- **`BankPanel.tsx`**: Updated Revenue Simulator, Tax Engine, and Waterfall inputs to use `bg-black/40`, `bg-white/5` surfaces, and `dept-licensing`/`dept-distribution` accents.
- **`QCPanel.tsx`**: Standardized Metadata inputs and QC results with `dept-marketing` (errors) and `dept-licensing` (pass) tokens.
- **`AuthorityPanel.tsx`**: Applied `dept-creative`, `dept-distribution`, and `dept-royalties` scheme to ISRC, UPC, and DDEX generators.
- **`KeysPanel.tsx`**: Updated Merlin and MLC bridge cards to use `bg-white/5` and department tokens.
- **`DistributorConnectionsPanel.tsx`**: Fixed background opacities and token usage.

### 2. Mobile Navigation (`MobileNav.tsx`)

- **FAB**: Replaced hardcoded `#1a1a1a` with `bg-background` and `hover:bg-white/10`.
- **Drawer**: Updated menu items to dynamic use `colors.hoverBg` and `colors.hoverText` based on the module, ensuring consistency with the desktop Sidebar.

## Verification Results

### Browser Smoke Test

- **Desktop**: Verified consistent layout and department branding across all Distribution tabs.
- **Mobile**: Confirmed correct background colors and interative states for the FAB and navigation drawer.

## Next Steps

- **Docs**: Keep strict adherence to `moduleColors.ts` for any new components.
- **Audit**: Periodically scan for `#` hex values in `.tsx` files to catch regressions.
