# Rndr-AI Improvement Roadmap

This document tracks the implementation of improvements identified in the Gold Master v7.6 review.

## Phase 1: Architecture & Foundation
- [ ] **Event Bus**: Implement a central Pub/Sub system to decouple modules (`events.ts`).
- [ ] **State Management**: Refactor `state.ts` to control mutations and emit events on change.
- [ ] **Robust Initialization**: Replace `DOMContentLoaded` chains with Event Bus "App Ready" signals.

## Phase 2: User Experience (Feedback Loop)
- [ ] **Toast System**: Implement a notification service (`toast.ts`) and UI container.
- [ ] **Integration**: Replace silent operations (Save, Error) with Toast feedback.

## Phase 3: Data Integrity & Safety
- [ ] **ZIP Export**: Add `JSZip` and implement full project export (assets + JSON) in `dashboard.ts`.
- [ ] **Database Vacuum**: Implement Garbage Collection for orphaned IndexedDB blobs in `db.ts`.

## Phase 4: AI Hardening
- [ ] **Tool Validation**: Implement strict schema validation for Agent tool outputs.
- [ ] **Semantic Memory**: Implement Long-Term Memory retrieval for Agent Zero.

## Phase 5: UI Polish
- [ ] **Mobile Density**: Refactor "Studio Mode" tabs to use Icons-only layout on mobile devices.
