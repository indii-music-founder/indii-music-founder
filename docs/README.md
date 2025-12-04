# Documentation Index

This directory contains detailed architectural and technical documentation for indiiOS.

## Architecture

- [Agent System Architecture](./AGENT_SYSTEM_ARCHITECTURE.md)
  - Details the "Hub-and-Spoke" model, `AgentService`, and specialist agent implementation.
  - Explains the tool calling standard and future roadmap for the agent system.

- [Backend Architecture](./BACKEND_ARCHITECTURE.md)
  - Outlines the hybrid client/server architecture.
  - Documents the migration of heavy AI tasks (Image/Video generation) to Firebase Functions and Vertex AI.
  - Lists available backend services and their triggers.

## UI & Design

- [UI State & Branding](./UI_STATE.md)
  - Defines the "indii" brand identity and "Business Partner" persona.
  - Lists critical "Do Not Break" rules for UI elements and copy.
  - Tracks key visual components like the Landing Page and Creative Studio.

## Legacy & Archives

- [Legacy Architecture](./LEGACY_ARCHITECTURE.md)
  - Documentation for the archived `src/_archive_legacy` directory (now removed).
  - Kept for historical reference of the previous vanilla TypeScript implementation.

## Research & Planning

- [Component Kit Research](./component-kit-research.md)
  - Analysis of UI component libraries and design systems.
- [Video Editing Deep Dive](./video-editing-deep-dive.md)
  - Research into programmatic video editing tools (Remotion, etc.).
