# indiiOS Improvement Roadmap

This document tracks the implementation of technical improvements and architectural upgrades.

## Phase 1: Architecture & Foundation

- [x] **State Management**: Refactored to Zustand with modular slices (`authSlice`, `appSlice`, `creativeSlice`).
- [x] **Robust Initialization**: Implemented `initializeAuth` and `loadProjects` in `App.tsx` for reliable startup.
- [x] **Multi-Tenancy**: Implemented Organization/Project hierarchy and context switching.

## Phase 2: User Experience (Feedback Loop)

- [ ] **Toast System**: Implement a notification service (`toast.ts`) and UI container.
- [ ] **Integration**: Replace silent operations (Save, Error) with Toast feedback.

## Phase 3: Data Integrity & Safety

- [ ] **ZIP Export**: Add `JSZip` and implement full project export (assets + JSON).
- [ ] **Database Vacuum**: Implement Garbage Collection for orphaned Firestore records.

## Phase 4: AI Hardening

- [x] **Tool Validation**: Implement strict schema validation for Agent tool outputs.
- [x] **Multi-Agent Architecture**: Implement Hub-and-Spoke model with specialized agents.
- [x] **Specialist Agents**: Added Road Manager, Brand Manager, and Legal Advisor.
- [ ] **Semantic Memory**: Implement Long-Term Memory retrieval for Agent Zero.

## Phase 5: UI Polish

- [x] **Mobile Density**: Refactored "Studio Mode" tabs and Navbar for mobile responsiveness.
- [x] **Landing Page**: Implemented "Liquid Orbs" and "Data Vault" visuals.

## Phase 6: Stability & Scale (Current Focus)

- [ ] **Stress Testing**: Execute the [Stress Test Plan](./STRESS_TEST_PLAN.md).
- [x] **E2E Testing**: Implement Playwright flows for critical paths.
- [x] **Backend Migration**: Migrated Image Generation and heavy tasks to Firebase Functions.

## Phase 7: New Capabilities

- [x] **Road Manager**: Logistics and itinerary planning.
- [x] **Brand Manager**: Brand consistency and asset generation.
- [ ] **Voice Control**: Audio-in prompts.
