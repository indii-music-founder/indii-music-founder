# UI State & Changelog

**Last Updated:** 2025-12-01
**Status:** Production Ready

## 1. Landing Page (indiiOS)

**Location:** `landing-page/app/components/Overlays.tsx`

The landing page features a "Business Partner" copy style, emphasizing profitability and independence over sci-fi abstractions.

### Key Visual Elements (DO NOT BREAK)

* **Hero Text:** Rotates between "Your Music. Your Rules." and "Your Independence Operating System".
* **Agent Section:**
  * **Headline:** "Agent R" (Note: This is the *only* place "Agent R" is preserved as a legacy marketing term, or it needs to be updated to "indii" if the rebrand extends to marketing copy. *Action: Checked code, it currently says "Agent R" with a reversed 'R' visual effect.*)
  * **Sub-roles:** "THE ARCHITECT" (Strategy) and "THE BUILDER" (Execution).
* **Value Props:**
  * "Smart Audio Analysis" (Blue)
  * "Career Strategy" (Pink)
  * "Rights Protection" (Green)
* **CTA:** "Launch Studio" button pointing to `https://indiios-studio.web.app`.

## 2. Main Application (indiiOS)

### 2.1. Navigation & Branding

**Location:** `src/modules/creative/components/CreativeNavbar.tsx`

* **Brand Name:** "indii" (Lowercase, modern).
* **Agent Button:** Labeled "indii" (formerly Agent R).

### 2.2. Agent Window

**Location:** `src/core/components/AgentWindow.tsx`

* **Title:** "indii"
* **Persona:** Dynamic based on project (Director, Musician, etc.).

### 2.3. File Drop Zone

**Location:** `src/modules/creative/components/CreativeGallery.tsx`

* **Visuals:** Prominent dashed border, large upload icon.
* **Mobile:** Dedicated "Take Picture" button visible on small screens.

### 2.4. Authentication Flow

**Location:** `src/modules/auth/SelectOrg.tsx`

* **State:** Simplified animation to prevent white-page rendering errors.
* **Safety:** Includes `ErrorBoundary` wrapping.

## 3. "Do Not Break" Rules

1. **Landing Page Copy:** Do not revert to "Neural Network" or "Sci-Fi" terminology without explicit approval. Keep it business-focused.
2. **Agent Identity:** The app *must* refer to the agent as "indii". "Agent R" is deprecated in the app (though currently present in landing page marketing copy as a stylistic choice).
3. **Mobile Uploads:** The `capture="environment"` attribute on the file input is critical for mobile usability. Do not remove.
