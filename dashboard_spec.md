
# Feature Specification: Rndr-AI Dashboard & Settings Hub

## 1. Overview

Currently, Rndr-AI operates as a "Studio-First" application. Users are immediately dropped into the workspace. Project management is limited to a small dropdown, and settings are scattered across modals.

The **Dashboard** will serve as the **"Home Screen"** or **"Headquarters"** of the application. It acts as a layer *above* the Studio, handling meta-management of data, projects, and global configurations.

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
  * **Archive/Delete:** Remove from active view or delete from IndexedDB.
  * **Merge:** (Phase 2) Combine assets from two projects.

### B. Data & Storage Manager

Since Rndr-AI is client-side, storage management is critical.

* **Storage Health Bar:** Visual indicator of IndexedDB usage (e.g., "Using 450MB of Browser Quota").
* **Backup & Restore:**
  * **Export All:** Download a `.rndr` (JSON + Base64) file containing the entire database.
  * **Import:** Restore a backup file.
* **Cache Clearing:** Buttons to "Delete All Drafts" or "Clear Unused Uploads" to free up space.

### C. Global Configuration

Settings that persist across all projects.

* **API Management:** Secure input for Google API Key (stored in `localStorage` or `IndexedDB`).
* **Model Preferences:**
  * Force specific model versions (e.g., lock `gemini-3-pro-preview-02-05`).
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

### 4.1 New Files

* `dashboard.ts`: Logic for rendering the dashboard grid and handling project CRUD operations.
* `router.ts`: Simple state machine to toggle visibility between `#view-dashboard` and `#view-studio`.

### 4.2 Database Extensions (`db.ts`)

* Need efficient queries to fetch *meta-data* without loading *blobs*.
* **New Method:** `getProjectMetadata()` -> Returns name, ID, and *thumbnail* (not full gallery) to keep the dashboard snappy.

### 4.3 DOM Structure

The `index.html` will be refactored to wrap the existing UI:

```html
<body>
    <!-- View 1: Dashboard (Hidden by default on first load if project exists) -->
    <div id="view-dashboard" class="hidden">
        <!-- Dashboard Grid -->
    </div>

    <!-- View 2: Studio (The current UI) -->
    <div id="view-studio">
        <!-- Existing Navbar, Main Content, Sidebar -->
    </div>
</body>
```

## 5. Implementation Roadmap

### Phase 1: The Skeleton

1. Refactor `index.html` to support the View Switching architecture.
2. Create `dashboard.ts` with a basic Project List.
3. Wire up the "Home" button to switch views instead of resetting the studio.

### Phase 2: Project Management

1. Implement "Create Project" wizard.
2. Implement "Delete Project" (cascading delete of all images/history linked to `projectId`).

### Phase 3: Data & Settings

1. Implement "Export Backup" (Zip generation).
2. Implement "Storage Meter" using `navigator.storage.estimate()`.

---
*This specification represents the "Gold Standard" for user management in a client-side AI application.*
