# Implementation Plan - Component Kit Integration

This plan outlines the steps to integrate **Prompt Kit**, **Motion Primitives**, and **Kokonut UI** into the Rndr-AI-v1 project to enhance the UI/UX.

## User Review Required

> [!IMPORTANT]
> This plan involves manually configuring `shadcn/ui` infrastructure (`components.json`, `lib/utils.ts`) as it appears to be missing or non-standard.
> We will be replacing existing UI elements (File Drop, Assistant Input) with new components.

## Proposed Changes

### 1. Setup & Infrastructure

* **[NEW]** `src/lib/utils.ts`: Create standard `cn` utility for Tailwind class merging.
* **[NEW]** `components.json`: Create configuration file to enable `shadcn` CLI and registry support.
* **[NEW]** `src/components/ui`: Create directory for atomic components.

### 2. File Upload UI (Kokonut UI)

* **Goal**: Improve the file drop area and add "Take a picture" support.
* **Action**: Install Kokonut UI `file-upload` component.
* **Target**: Replace existing file drop implementation (likely in `VideoWorkflow.tsx` or `AssetManager`).

### 3. Assistant Input (Prompt Kit)

* **Goal**: Standardize and enhance the AI chat input.
* **Action**: Install Prompt Kit `prompt-input` component.
* **Target**: `src/app/assistant/page.tsx`. Replace the current `<textarea>` with `<PromptInput>`.

### 4. Visual Polish (Motion Primitives)

* **Goal**: Add "delight" to the UI.
* **Action**: Install Motion Primitives `text-effect`.
* **Target**: Apply to the "Hello" or welcome message in the Assistant view.

## Verification Plan

### Manual Verification

1. **File Upload**:
    * Drag and drop a file -> Verify it is accepted.
    * Click to upload -> Verify file picker opens.
    * Check mobile view for "Take a picture" option (if supported by component) or ensure responsive layout.
2. **Assistant Input**:
    * Type text -> Verify auto-resize.
    * Press Enter -> Verify message sends.
    * Shift+Enter -> Verify new line.
3. **Text Effect**:
    * Reload Assistant page -> Verify welcome text animates in.
