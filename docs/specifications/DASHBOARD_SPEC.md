# Feature Specification: indiiOS Dashboard & Settings Hub

## 1. Overview

indiiOS operates as a "Studio-First" application with multi-tenant support (Organizations/Projects). The **Dashboard** serves as the **"Home Screen"** or **"Headquarters"** of the application, handling meta-management of data, projects, and global configurations.

**Current Architecture:** React 19 + Vite, Zustand state management, Firebase (Firestore + Storage).

## 2. User Experience (UX)

### The Navigation Model

* **Current:** Single View (Studio).
* **New:** Dual View Router.
  * **View A: The Dashboard** (Project Selection, Global Settings, Analytics).
  * **View B: The Studio** (Active Workspace - The current app).
* **Transition:** Clicking the "Home" icon in the Studio navbar sends the user to the Dashboard. Clicking a Project Card in the Dashboard enters the Studio.

### Visual Layout

A clean, modular **Bento Grid** layout using the existing dark theme (`#0f0f0f` background, `#1a1a1a` cards).

---

## 3. Core Modules

### A. The Project Hub (Project Management)

Replacing the dropdown selector with a visual grid.

* **Project Cards:** Each card displays:
  * Project Name.
  * **Hero Image:** The most recent or "starred" image generated in that project.
  * Last Modified Date.
  * Asset Count (e.g., "42 Images, 3 Videos").
* **Actions:**
  * **Create New:** With dedicated setup wizard (Name, Context, Default Ratio).
  * **Duplicate:** Clone a project (useful for branching creative directions).
  * **Archive/Delete:** Remove from active view or delete from Firestore.
  * **Merge:** (Phase 2) Combine assets from two projects.

### B. Data & Storage Manager

Cloud storage management via Firebase Storage.

* **Storage Health Bar:** Visual indicator of storage usage per organization.
* **Backup & Restore:**
  * **Export All:** Download a ZIP file containing assets + metadata JSON (via ExportService).
  * **Import:** Restore a backup file.
* **Cache Clearing:** Database vacuum via CleanupService ("Cleanup" button in Dashboard).

### C. Global Configuration

Settings that persist across all projects (stored in Firestore user profile).

* **API Management:** Server-side via Firebase Functions (no client-side key exposure).
* **Model Preferences:**
  * Force specific model versions (e.g., lock `gemini-3-pro-preview`).
  * Set default "Temperature" / Creativity levels.
* **Interface Settings:**
  * Toggle Haptic Feedback.
  * Set Default Aspect Ratio (e.g., always start in 16:9).
  * Reset "Tips" and "Tutorials".

### D. indii Customization

Configuring the default behavior of the autonomous agent.

* **Default Persona:** Set the default "Hat" (Architect, Generalist, Director).
* **Auto-Approval Level:** Configure how often the agent asks for permission (Strict vs. Autonomous).

### E. Analytics & Stats

A fun, gamified view of usage.

* "Total Images Generated"
* "Total Video Runtime"
* "Agent Conversations"
* "Favorite Words" (Word cloud of prompts).

---

## 4. Technical Architecture

### 4.1 Key Components

* `src/modules/dashboard/Dashboard.tsx`: Main dashboard component with Bento Grid layout.
* `src/core/store/slices/appSlice.ts`: Module switching via `activeModule` state.
* `src/core/store/slices/authSlice.ts`: Organization/Project selection state.

### 4.2 Data Layer

* **Firestore Collections:** `organizations`, `projects`, `history`, `assets`
* **Efficient Queries:** Fetch project metadata without loading full asset blobs.
* **Real-time Sync:** Firestore listeners for live updates across devices.

### 4.3 Module Structure

```
src/modules/dashboard/
├── Dashboard.tsx          # Main dashboard view
├── ProjectHub.tsx         # Project grid with cards
├── DataManager.tsx        # Export/Import/Cleanup controls
├── GlobalSettings.tsx     # User preferences
└── Analytics.tsx          # Usage stats and gamification
```

## 5. Implementation Status

### Completed

- [x] Dashboard layout with Bento Grid
- [x] Project selection via SelectOrg component
- [x] Export functionality (ExportService + ZIP)
- [x] Database vacuum (CleanupService)
- [x] Multi-tenant data isolation

### Pending

- [ ] Storage health bar visualization
- [ ] Project duplication feature
- [ ] Analytics/Stats gamification view

---
*This specification defines the UX vision for the indiiOS Dashboard.*
