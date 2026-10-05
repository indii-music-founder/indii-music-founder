# Specification: Blender Model Context Protocol (MCP) Integration

**Document Version:** 1.0.0
**Status:** IMPLEMENTED & DEPLOYED
**Date:** 2026-10-05
**Related GitHub Issues:** #356, #357, #358, #359, #360, #361, #362, #363

---

## 1. Overview
The **Blender MCP Integration** bridges indii Studio with local Blender installations (Blender 4.x/5.x LTS) via standard Model Context Protocol (MCP). It enables generative 3D visualizer rendering, audio-reactive procedural animations, and interactive scene control directly within indii Creative and Video Studios.

---

## 2. Architecture & Component Flow

```
┌────────────────────────────────────────────────────────┐
│                   Renderer (indii Studio)               │
│  - VideoWorkflow.tsx / BlenderVideoPanel.tsx            │
│  - BlenderService.ts (renderer)                         │
│  - BlenderTools.ts (Agent tool bindings)               │
└───────────────────────────▲────────────────────────────┘
                            │ Electron IPC
┌───────────────────────────▼────────────────────────────┐
│                  Main Process (Desktop)                │
│  - packages/main/src/handlers/blender.ts               │
│  - packages/main/src/services/blender/BlenderService.ts│
│  - packages/main/src/services/mcp/MCPClientService.ts  │
└───────────────────────────▲────────────────────────────┘
                            │ Stdio MCP Protocol
┌───────────────────────────▼────────────────────────────┐
│               Local MCP Server (Sidecar)               │
│  - packages/mcp-server-local/src/blender/executor.ts   │
│  - Python Runner: runner.py                            │
└───────────────────────────▲────────────────────────────┘
                            │ Process Execution
┌───────────────────────────▼────────────────────────────┐
│             Native Blender Binary (OS Level)           │
│  - Blender 4.3 / 5.2 LTS                               │
│  - Procedural Geometry Nodes / Sound Strip Sync        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Tool Schemas & Interface

### 3.1 `blender_render_video` (MCP Engine Level)
- **Tool Identifier:** `blender_render_video`
- **Executor:** `packages/mcp-server-local/src/blender/executor.ts`
- **Parameters:**
  ```json
  {
    "type": "object",
    "properties": {
      "audioPath": { "type": "string", "description": "Absolute path to source audio" },
      "outputPath": { "type": "string", "description": "Destination MP4 path" },
      "template": { "type": "string", "description": "Template ID" },
      "resolution": { "type": "string", "enum": ["720p", "1080p", "4k"] },
      "fps": { "type": "number", "default": 30 },
      "duration": { "type": "number", "description": "Duration in seconds" },
      "coverImagePath": { "type": "string", "description": "Optional center artwork" }
    },
    "required": ["audioPath", "outputPath", "template"]
  }
  ```

### 3.2 Agent Tools (`BlenderTools.ts`)
- `blender_get_status()`: Inspects executable discovery, version, and scene state.
- `blender_list_templates()`: Enumerates procedural 3D visualizer templates.
- `blender_render_music_video({ audioPath, template, resolution, duration })`: High-level render request.
- `blender_live_command({ command, params })`: Real-time viewport control.

---

## 4. Key Guarantees & Safeguards

1. **Non-destructive Cancellation:** When a render is cancelled or the window closes, the child PID is terminated (SIGTERM with bounded SIGKILL grace period) and any partial output is automatically purged.
2. **True Progress Tracking:** Frame-by-frame notifications from the Python runner are streamed to the frontend via IPC (`blender:render-progress`). No simulated timers are used.
3. **Storage Security & Persistence:** Finished renders are uploaded to genuine project Cloud Storage paths, with metadata committed in atomic Firestore batches.
4. **Honest Web Mode:** Web environments display a descriptive guidance prompt directing artists to use the native desktop build to leverage local GPU acceleration.

---

## 5. Verification & Test Coverage
- **Unit & Security Tests:** `packages/main/src/handlers/blender.security.test.ts`
- **Tool Wiring Tests:** `packages/renderer/src/services/agent/tools/__tests__/BlenderTools.test.ts`
- **Capability Truth Tests:** `packages/renderer/src/services/agent/capabilityTruth.test.ts`
- **UI Component Tests:** `packages/renderer/src/modules/creative/video/components/BlenderVideoPanel.test.tsx`
- **Regression Protocol:** `MEGA_STRESS_TEST_V13_BLENDER_MCP_AND_ASSET_LIFECYCLE.md` (Routines 131–134)
