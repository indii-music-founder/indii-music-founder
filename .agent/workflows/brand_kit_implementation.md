---
description: Implementation of the Brand Kit and Onboarding System
---

# Brand Kit & Onboarding System

## Overview

The Brand Kit system allows artists to define their identity (Bio, Brand Description, Visuals) and current release details (Title, Mood, Themes). This data is used to guide AI generation across the platform.

## Components

### 1. OnboardingModal (`src/modules/onboarding/OnboardingModal.tsx`)

- **Purpose**: Main interface for the Brand Kit builder.
- **Features**:
  - Chat interface with "indii" (AI agent).
  - File upload support (Images, Text Docs) for brand assets.
  - Real-time status tracking of "Artist Identity" and "Current Release" completeness.
  - Live preview of captured data.
- **Integration**: Accessible from the Dashboard via the "Brand Kit" button.

### 2. Onboarding Service (`src/services/onboarding/onboardingService.ts`)

- **Purpose**: Logic layer for the onboarding conversation.
- **Key Functions**:
  - `runOnboardingConversation`: Manages the chat flow with Gemini 2.0 Flash Thinking. Handles file attachments (images as inline data, docs as text).
  - `processFunctionCalls`: Updates the `UserProfile` store based on AI function calls (`updateProfile`, `addImageAsset`, etc.).
  - `calculateProfileStatus`: Computes the completion percentage of the profile.

### 3. Store Integration (`src/core/store.ts`)

- **State**: `userProfile` contains the `BrandKit` data.
- **Actions**: `setUserProfile`, `updateBrandKit`.

## Usage

1. Navigate to the **Dashboard**.
2. Click the **Brand Kit** button (Sparkles icon).
3. Chat with "indii" to build your profile.
4. Upload reference images or bio documents.
5. Watch the progress bars fill up as you provide information.

## Future Improvements

- **Dedicated Brand Kit Store**: If the data grows too large, separate `BrandKit` into its own Zustand store or slice.
- **Asset Management**: A dedicated gallery view for managing uploaded brand assets.
- **Cross-Module Integration**: Explicitly pull Brand Kit colors/fonts into the Creative Studio and Marketing Dashboard.
