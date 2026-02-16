# Implementation Plan - Publicist Module Design & AI Verification

## Status

- [x] **Design Fix**: `PublicistDashboard.tsx` styles updated to use explicit dark mode colors.
- [ ] **Verification**: Verify visual appearance (pending user confirmation/browsing).
- [ ] **AI Bindings Check**: Analyze and fix gaps between `PublicistAgent` and `PublicistService`.

## Problem

1. **Design**: The `PublicistDashboard` was using theme variables that resolved to light colors on a light background (or dark on dark), causing invisibility.
2. **AI Connectivity**: The User requested verification of AI bindings. Analysis shows `PublicistAgent` lacks tools to interact with the database (creating campaigns), and implementation logic for its defined tools.

## Proposed Changes

### 1. Design Verification

- **Action**: Reload the app (via `file_preview` or relying on HMR) and confirm the dashboard is now legible with `bg-slate-950` and `text-white`.

### 2. AI Binding Verification & Fixes

- **Analysis**:
  - `PublicistService` allows: `subscribeToCampaigns`, `addCampaign`, `addContact`.
  - `PublicistAgent` tools: `write_press_release`, `generate_crisis_response`, `generate_social_post`.
  - **GAP**: The Agent cannot *create* a campaign or *read* contacts to personalize the press release.
  - **GAP**: `PublicistAgent.ts` lacks the `functions` implementation block, meaning even if the LLM calls the tool, nothing executes.
- **Proposed Fix**:
  - Update `src/services/agent/definitions/PublicistAgent.ts`:
    - Import `PublicistService`.
    - Add `functions` object with implementations for `create_campaign`.
    - Add `create_campaign` to `tools.functionDeclarations`.
    - `create_campaign` implementation will call `PublicistService.addCampaign` (mocking userId for now or handling it via context injection if available).
  - Ensure `write_press_release` returns structured validation rather than just string text, mimicking a real "Action".

## Verification Plan

1. **Manual Check**:
    - Open Publicist Dashboard.
    - Click "New Campaign" (currently inert, will add a placeholder log/toast).
2. **AI Check**:
    - Verify `PublicistAgent` typescript compilation.
    - Confirm `PublicistService` is correctly imported and utilized.

## File Changes

1. `src/modules/publicist/PublicistDashboard.tsx` (Completed)
2. `src/services/agent/definitions/PublicistAgent.ts` (Update with DB tools)
