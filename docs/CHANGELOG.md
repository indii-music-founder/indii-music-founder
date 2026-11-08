# Changelog

All notable changes to indii are documented in this file.

## [Unreleased]

### Added

#### Boardroom Multi-View Workspace & Embedded Browser

- **Multi-View Workspace Engine** (`packages/renderer/src/modules/boardroom/components/BoardroomWorkspacePane.tsx`):
  - 4 interactive tool viewports: **Live Browser**, **Studio Module In-Place Preview**, **Asset / Legal Workbench**, and **Agent Live Telemetry Feed**.
  - Dynamic 3-pane responsive layout: Split View (28% table / 40% workspace / 32% chat) and full Stage View with persistent conversation dock.
  - In-chat markdown URL interception: Clicking external web links in boardroom discussion turns immediately opens the workspace browser.
- **Native Electron Web Browser Handler** (`packages/main/src/handlers/boardroomBrowser.ts`):
  - Electron `WebContentsView` attached to `BrowserWindow` bypassing `X-Frame-Options` and CSP frame restrictions for external DSPs and PRO portals.
  - Isolated persistent partition (`persist:boardroom-browser`) ensuring safe session caching.
  - Strict IPC security validation and SSRF filtering via `validateSafeUrlAsync`.
  - Sandboxed HTML `<iframe>` with automated Reader Mode fallback for web/Next.js builds.
- **TypeSafe Jev System One Semantic Intelligence** (`packages/renderer/src/config/typesafeJudgments.ts`):
  - Deterministic semantic classification of browsed URLs into 7 music industry categories (`dsp`, `pro_rights`, `legal_compliance`, `marketing_social`, `press_pr`, `distribution`, `general_research`).
  - Automated department specialist assignment and relevance scoring (0.0 to 1.0).
  - Swarm discussion turn analyzer with autonomous proactive workspace and module recommendations.
- **Comprehensive User Guide**: Authored [`docs/USER_MANUAL_BOARDROOM_WORKSPACE.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/docs/USER_MANUAL_BOARDROOM_WORKSPACE.md) detailing architecture, platform differences, navigation, and shortcuts.

#### Production Readiness & Security Audit

- **Critical Lint Remediation**: Resolved all blocking ESLint errors including `setState` in `useEffect` loops and render-cycle component creation bugs.
- **Security Hardening**:
  - Scrubbed hardcoded Firebase API keys and test credentials from scripts and application code.
  - Enforced strict environment variable usage in `src/config/env.ts` with runtime validation.
  - Verified Firebase Storage security rules via `the-auditor.ts` (confirmed referrer restrictions are active).
  - Manual audit of Electron security primitives (Node integration, Context isolation, Sandbox, CSP) confirmed compliance.
- **Stability Improvements**:
  - Refactored `MerchTable` to use `useCallback` for stable function references.
  - Implemented component caching in `AnimatedNumber` to prevent re-creation during render.
  - Fixed `@ts-expect-error` compliance in test scripts.

### Added (Previous)

#### Membership Tier System

- **MembershipService** (`src/services/MembershipService.ts`): Centralized tier management with limits for free, pro, and enterprise users
  - Video duration limits: 8 min (free), 60 min (pro), 4 hours (enterprise)
  - Daily image generation limits: 10/50/unlimited
  - Storage quotas: 100MB/5GB/100GB
  - Project limits: 3/25/unlimited
- **Video Editor Integration**: `videoEditorStore.ts` now enforces duration limits based on membership tier

#### Database Vacuum / Garbage Collection

- **CleanupService** (`src/services/CleanupService.ts`): Identifies and removes orphaned Firestore records
  - Dry-run scan mode to preview deletions before executing
  - Detects orphaned history items (referencing deleted projects)
  - Detects orphaned projects (referencing deleted organizations)
  - Optional Firebase Storage cleanup for orphaned files
  - Progress callbacks for UI integration
- **Dashboard Integration**: "Cleanup" button with confirmation modal showing scan results before deletion

#### Semantic Memory for Agents

- **ContextPipeline Enhancement** (`src/services/agent/components/ContextPipeline.ts`):
  - Auto-retrieves relevant memories from `MemoryService` based on conversation context
  - Extracts recent context (last 5 exchanges) for semantic similarity search
  - Formats memories into structured prompt section
- **AgentExecutor Update** (`src/services/agent/components/AgentExecutor.ts`):
  - Passes `memoryContext` and `relevantMemories` to agent execution
  - Logs when semantic memories are injected
- **BaseAgent Memory Injection** (`src/services/agent/BaseAgent.ts`):
  - Adds "RELEVANT MEMORIES" section to agent prompts when memories are available
  - Enables agents to maintain continuity across sessions

#### Project Export

- **ExportService** (`src/services/ExportService.ts`): Full project backup to ZIP format
  - Exports project metadata, history, and assets
  - Progress tracking integrated with Toast system
  - Automatic download trigger

#### Voice Control

- **VoiceService** (`src/services/ai/VoiceService.ts`): Web Speech API integration
  - Speech-to-text via `startListening(onResult, onError)`
  - Text-to-speech via `speak(text)`
  - Browser compatibility detection via `isSupported()`
- **CommandBar Integration**: Mic button for voice input
  - Visual feedback when listening (red pulse animation)
  - Transcribed text appends to input field
- **ChatOverlay Integration**: Auto-speak agent responses (when unmuted)
  - Mute/unmute toggle in chat overlay

#### Stress Testing

- **E2E Tests** (`e2e/stress-test.spec.ts`): Performance validation suite
  - Rendering performance test: Validates 30+ fps during rapid scroll
  - Asset loading performance test: Measures time-to-interactive
  - FPS metrics tracking with frame drop detection

### Changed

#### Cloud Architecture

- **Firebase Persistence** (`src/services/firebase.ts`): Updated to modern persistence API
  - Uses `persistentLocalCache` with `persistentMultipleTabManager`
  - Enables automatic offline support and multi-tab synchronization
  - Removed need for custom IndexedDB schema

#### Dashboard

- Added Export button on project cards for ZIP backup
- Added Cleanup button in header for database maintenance

### Removed

- **SCHEMA_UPGRADE_NOTES.md**: Obsolete IndexedDB migration planning document (cloud-first architecture)

---

## [Previous Versions]

### Toast Notification System

- Implemented success, error, info, warning, and loading toast types
- Added progress bar support for loading toasts
- Promise-based API for async operation feedback
- Integrated across Creative Studio, Showroom, and other modules

### Multi-Agent Architecture

- Hub-and-Spoke model with AgentZero as orchestrator
- Specialist agents: Road Manager, Brand Manager, Legal Advisor
- Tool validation with strict JSON schema
- Agent delegation and handover protocols

### Creative Studio

- Infinite canvas with pan/zoom
- Image generation with Gemini 3 Pro
- Product Showroom with placement and scene presets
- Brand assets drawer

### Video Studio

- AI-powered video production workflow
- Director's Cut QA system
- Remotion integration for timeline editing

### Multi-Tenancy

- Organization/Project hierarchy
- Firestore security rules for data isolation
- Context switching between workspaces
