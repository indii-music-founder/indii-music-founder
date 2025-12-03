# Legacy Architecture Documentation

**Date:** 2025-12-03
**Status:** Archived & Deleted

## Overview

The `src/_archive_legacy` directory contained a previous iteration of the IndiiOS application. This version was built primarily with vanilla TypeScript and direct DOM manipulation, rather than the React-based architecture of the current application.

## Key Components

### 1. Core Logic

- **`dashboard.ts`**: Managed the main dashboard UI, project grid rendering, and settings. It handled direct DOM element creation (`document.createElement`) and event binding.
- **`dom.ts`**: A central registry of HTML elements. It exported references to DOM nodes (e.g., `projectGrid`, `consistencySlider`) and initialized them via `initDOM()`.
- **`db.ts`**: A wrapper around IndexedDB using the `indiiOS_DB` database. It managed stores for `images`, `history`, `prompts`, `settings`, `canvas`, and `agent_memory`. It included logic for backing up and restoring data via ZIP files.

### 2. State Management

- **`state.ts`**: Likely held global mutable state, though not deeply analyzed.
- **`router.ts`**: Handled basic client-side routing.

### 3. UI/UX

- **`ui.ts`**: General UI utilities.
- **`toast.ts`**: A simple toast notification system.
- **`canvas.ts`**: Logic for the infinite canvas feature.

### 4. Services

- **`video.ts`**: Handled video generation logic.
- **`ai.ts`**: Interface for AI model interactions.

## Data Structure (IndexedDB)

The legacy database `indiiOS_DB` (v3) had the following stores:

- `images`: Uploaded assets.
- `history`: Generated content history.
- `prompts`: Saved prompts.
- `settings`: App configuration.
- `canvas`: Canvas state/images.
- `agent_memory`: Chat history for the agent.

## Reason for Archival

The application has been migrated to a modern React-based architecture (likely Next.js or Vite + React) to improve maintainability, component reusability, and state management. The legacy code was kept for reference but is now being removed to clean up the codebase.
