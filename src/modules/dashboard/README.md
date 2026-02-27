# Dashboard & Unified Command Module (RC1)

The Dashboard is the "Nervous System" of indiiOS. It serves as the primary entry point for creators, providing a unified, high-level overview of their entire creative and business ecosystem.

## 📊 Key Features
- **Neural Overview:** Real-time metrics for current projects, active releases, and financial status.
- **Activity Feed:** A global event log tracking everything from completed AI renders to royalty payouts.
- **Quick Actions:** One-click shortcuts to frequent tasks (e.g., "Generate Image", "Create Release").
- **Agent Hub:** Direct access to the **Hub Agent (indii)** for session-wide assistance.
- **Module Navigation:** The primary router for switching between **Creative**, **Distribution**, and **Finance** suites.

## 🏗️ Technical Architecture
- **`Dashboard`**: The top-level React component for the unified workspace.
- **`DashboardService`**: Aggregator logic that pulls data from multiple domain-specific stores.
- **Zustand `appSlice`**: Managing the global navigation and layout state.
- **Responsive Layout:** Optimized for both the **Electron Desktop** experience and high-resolution web displays.

## 🔗 Integrations
- **All Modules:** Dynamically renders widgets from every active feature module.
- **Auth Service:** Context-aware display of user profile and active organization.
- **Sync Status:** Real-time tracking of Firestore and Storage synchronization.
