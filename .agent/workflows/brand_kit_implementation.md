---
description: Implementation of the Brand Kit and Onboarding System
---

# Brand Kit & Onboarding

**System for checking Artist Identity & Release metadata.**

## Architecture

* **UI:** `OnboardingModal.tsx` (Chat interface, "indii" agent).
* **Logic:** `onboardingService.ts` (Gemini 3.0 Pro, file processing).
* **State:** `store.ts` (`userProfile.brandKit`).

## Usage Flow

1. **Dashboard** -> **Brand Kit** (Sparkles Icon).
2. Chat with agent -> Updates `UserProfile` store.
3. Upload Assets -> Stored/Linked in profile.

## Key Functions

* `runOnboardingConversation`: Handles chat + file attachments.
* `processFunctionCalls`: Updates state (`updateProfile`, `addImageAsset`).
* `calculateProfileStatus`: % completion tracker.
