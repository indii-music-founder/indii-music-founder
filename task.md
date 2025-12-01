# Rndr-AI-v1 Task List

## Current Focus: Critical Bug Fixes & Feature Restoration

### 1. Music Studio Restoration (COMPLETED)

- [x] **Fix Essentia.js Loading**: Restored WASM integration with global checks.
- [x] **Real Analysis**: Implemented `analyzeAudioFile` using Essentia algorithms (Rhythm, Key, RMS).
- [x] **UI Fixes**: Fixed `NaN%` metrics display.
- [x] **UX Improvements**: Added click-to-upload to drop zone.
- [x] **Diagnostics**: Added "Run Diagnostics (x10)" button to verify engine stability.

### 2. Video Generation Workflow (COMPLETED)

- [x] **Fix Routing**: Implemented hard override in `OrchestratorService` for video keywords.
- [x] **Verify**: Confirmed prompt passing to `VideoWorkflow`.

### 3. Critical Bug: /select-org White Page (NEXT PRIORITY)

- [ ] **Investigate**: Check browser console for errors on `/select-org`.
- [ ] **Debug**: Inspect `SelectOrgClient` component.
- [ ] **Fix**: Resolve rendering issue.

### 4. Creative Director Agent (NEW)

- [x] **Initialize**: Created agent structure (AGENTS.md, .mcp.json).
- [x] **Install Dependencies**: Install Mastra SDK.
- [x] **Implement Agent**: Create agent entry point with Gemini 3.0 Pro.
- [x] **Create Tools**: Implement Image and Video generation tools.
- [ ] **Integrate**: Connect agent to React frontend (AgentZero).

### 5. General Improvements

- [ ] **File Drop UI**: Make drop area more prominent, add "Take Picture" for mobile.
- [ ] **"Check UI click"**: Investigate origin of this log message.
- [ ] **Genkit Tools**: Convert remaining features to Genkit tools.
- [ ] **Error Handling**: Implement robust error boundaries.
