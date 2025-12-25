# Physical Media Designer - UI/UX Specification

## Overview

The **Physical Media Designer** is a specialized workspace within IndiiOS for creating print-ready artwork for music formats (CD, Vinyl, Cassette, Posters). It combines a precision layout engine with generative AI capabilities.

## User Interface Layout

### 1. The Workspace Container

- **Layout**: Three-column layout (similar to modern design tools like Figma/Canva but simplified).
  - **Left Sidebar (Assets & Templates)**: 250px wide.
  - **Center Stage (Canvas)**: Flexible width. Focus area.
  - **Right Sidebar (AI Creative Director)**: 300px wide. Chat & Properties. Includes **Tier Status** badge (Free/Pro/Enterprise).

### 2. Left Sidebar: "The Crate"

- **Tabs**:
  - **Templates**: Grid view of available formats (CD Front, Vinyl Jacket, etc.).
    - *Interaction*: Clicking a template loads it onto the canvas.
    - *Premium Content*: Pro/Enterprise templates are marked with a "Sovereign" gold badge.
  - **Assets**: User's uploaded images, logos, and generated assets.
  - **Layers**: Simple list of regions (e.g., "Front Cover", "Spine").

### 3. Center Stage: The Design Canvas

- **Rendering Engine**: HTML5 Canvas (likely via `react-konva` for performance and export).
- **View Controls**: Zoom In/Out, Fit to Screen, Pan.
- **Visual Guides (The "Print Layer")**:
  - **Bleed Area**: A semi-transparent red overlay (`rgba(255, 0, 0, 0.1)`) outside the trim line.
  - **Trim Line**: Solid black line (`1px dashed`) indicating where the cut happens.
  - **Safety Zone**: Green dashed line (`1px`) indicating the safe area for text.
  - **Fold Lines**: Blue dotted lines indicating where paper folds (for J-Cards/Tray cards).
- **Regions**:
  - Each distinct area (Front, Spine, Back) is a "drop zone".
  - Clicking a region selects it for the AI to target.

### 4. Right Sidebar: "Indii (Creative Director)"

- **Context Awareness**: Indii knows which template and which region is selected.
- **Chat Interface**:
  - User: "Generate a Retrowave style background for the cover."
  - Indii: Uses **Nano Banana Pro** (AI_MODELS.IMAGE.GENERATION) to generate 2K/4K images and places them in the selected region.
- **Properties Panel (Contextual)**:
  - If a Text element is selected: Font, Size, Color, Spacing, Rotation (crucial for spines).
  - If an Image is selected: Filter, Scale, Crop.

## Upgrade & Tier Integrity

### 1. "The Bouncer" (Quota Enforcement)

When a user on a restricted tier attempts a Pro-only action or hits a daily quota limit, **The Bouncer** interstitial appears:

- **Daily Limits**: Free users are limited to 50 images and 5 video generations per day (via `MembershipService`).
- **Resolution Caps**: Free tier is limited to 1024px; Pro unlocks 4K.
- **Visual**: A sleek, dark-glass overlay with a vibrant "Upgrade to Indii Pro" call-to-action (CTA).

### 2. Pro/Enterprise Exclusives

- **CMYK Mode**: Professional print-ready color space (Pro only).
- **High-DPI Export**: 300DPI+ exports for physical manufacturing.
- **Unlimited Workspace**: Enterprise tier removes all project and storage caps.

## Interaction Flow

1. **Select Format**: User opens "Physical Designer" -> clicks "Cassette J-Card".
2. **Visual Setup**: Canvas loads the J-Card template. The "Front Panel" region is highlighted.
3. **AI Generation**:
    - User types in Right Sidebar: " Make a futuristic city background, cyan and magenta."
    - System generates 4K image -> Auto-scales to cover the "Front Panel" + Bleed.
4. **Refinement**:
    - User clicks "Spine" region.
    - User types: "Add text 'My Album - The Band' vertically."
    - System places text, rotates it 90/270 degrees automatically based on the template spec.
5. **Export**:
    - User clicks "Export Print Ready".
    - System checks tier limits:
        - **Free**: 150DPI PNG/RGB.
        - **Pro+**: 300DPI PDF/CMYK with bleed & trim marks.
    - System generates the high-res file, ready for the print shop.

## Visual Style

- **Theme**: "Dark Mode" professional suite.
- **Accents**: IndiiOS brand colors (Black/White minimal).
- **Feedback**: Loading states for AI generation (e.g., a "developing" animation).

## Accessibility

- Keyboard shortcuts for Zoom (Ctrl/Cmd +/-).
- Aria labels for all canvas regions.
