# Security Audit & Instruction Portability Protocol (ISSUE-548)

This document addresses the bundle-security audit for agent instructions and system prompts.

## Architecture Decisions

1. **Client-Side Orchestration**:
   - `indii.music` supports local-first, low-latency, and offline-capable desktop workflows (Electron). 
   - Agent prompts are bundled via Vite's `?raw` import tool for direct client-side execution when using the local-first execution model.

2. **Backend Delegation**:
   - For public-facing environments or thin web-only clients, the system routes generative prompts through secure Cloud Functions (`/generateContentStream`).
   - The prompts are mirrored on the backend to keep API keys and model operations secure.

## Build-Time Assertions

To prevent accidental leakage of sensitive keys or private operational directives (e.g., developer bypasses, keys, internal credentials), we enforce the following:
- No hardcoded API keys are permitted in `prompt.md` files.
- Static scanning tools run prior to build to verify no strings starting with `sk-`, `ghp_`, or other private patterns are compiled.
