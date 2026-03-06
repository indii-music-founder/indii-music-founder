# Registration Checklist UI Specification

**Version:** 1.0  
**Date:** 2026-03-06  
**For:** indiiOS Royalty Collection Feature  
**Assignee:** Ant (Claude Code)  
**Source:** INDEX (OpenClaw)

---

## Overview

The Registration Checklist is the primary UI for artists to track and complete royalty-related registrations. It serves as both an onboarding guide and ongoing dashboard for royalty collection setup.

---

## Component Structure

```
RegistrationChecklist
├── ChecklistHeader
│   ├── Title & Description
│   ├── Overall Progress Bar
│   └── Estimated Completion Time
├── RegistrationSection (collapsible, 4 sections)
│   ├── ProRegistrationSection
│   ├── SoundExchangeSection
│   ├── MlcSection
│   └── CopyrightSection
├── ActionPanel (sticky footer)
│   ├── Primary Action Button
│   └── Secondary Help Link
└── ReleaseGateBanner (conditional)
    ├── Block Status
    └── Required Actions
```

---

## 1. ChecklistHeader

### Visual Design
- **Background:** Card with subtle gradient (indigo-50 to white)
- **Padding:** p-6
- **Border:** rounded-lg, border border-gray-200

### Elements

#### Title & Description
```
Title: "Royalty Collection Setup"
Subtitle: "Complete these registrations to ensure you collect all royalties from your music."
Font: text-2xl font-bold (title), text-gray-600 (subtitle)
```

#### Overall Progress Bar
```
Visual: Horizontal segmented progress bar
- 4 segments (PRO, SoundExchange, MLC, Copyright)
- Each segment: gray (not started) → yellow (in progress) → green (complete)
- Current segment: pulsing animation if in progress

Label: "2 of 4 complete"
Font: text-sm text-gray-500
```

#### Estimated Completion Time
```
Text: "About 45 minutes total"
Icon: Clock icon (lucide-react Clock)
Style: text-sm text-gray-500, flex items-center gap-2
```

---

## 2. Registration Sections

Each section follows this pattern:
- Collapsible card (default: PRO expanded, others collapsed)
- Status indicator (icon + text)
- Content area (form/guide)
- Action buttons

### 2.1 PRO Registration Section

**Priority:** CRITICAL (blocks releases if incomplete)

#### Header (always visible)
```
Icon: Building2 (lucide-react)
Title: "Performance Rights Organization (PRO)"
Subtitle: "Collect royalties when your music is played on radio, TV, streaming, live venues"
Status Badge: "Required" (red) | "In Progress" (yellow) | "Complete" (green)
Toggle: ChevronDown/ChevronUp
```

#### Expanded Content

**Status: NOT_STARTED**
```
Alert Box (yellow):
  Icon: AlertTriangle
  Title: "Required before releasing music"
  Text: "You must register with a PRO before your music generates royalties. PROs do not pay retroactively."

Comparison Table:
  | Feature | BMI | ASCAP | SESAC |
  |---------|-----|-------|-------|
  | Cost | Free | $50 | Invite-only |
  | Payout | Quarterly | Quarterly | Monthly |
  | Best for | Most artists | Songwriters | Established |

Action: "Choose a PRO" → opens selection modal
```

**Status: IN_PROGRESS**
```
Current Step Display:
  Step 1: Account created ✓
  Step 2: Application submitted ✓
  Step 3: Awaiting IPI number ← current (pulsing)

Timeline:
  Expected completion: 5-7 business days
  Next payout quarter: Q2 (May 2026)

Action: "Check Status" (links to PRO portal)
```

**Status: ACTIVE**
```
Success State:
  Icon: CheckCircle (green, large)
  Title: "Registered with BMI"
  Details:
    - IPI Number: 123456789
    - Registration date: March 1, 2026
    - Next statement: May 2026

Action: "View Account" (external link)
```

### 2.2 SoundExchange Section

**Priority:** RECOMMENDED (does not block releases)

#### Header
```
Icon: Radio (lucide-react)
Title: "SoundExchange"
Subtitle: "Collect digital performance royalties from Pandora, SiriusXM, web radio"
Status Badge: "Recommended" (blue) | "Complete" (green)
```

#### Expanded Content

**Key Info Box:**
```
Title: "What is SoundExchange?"
Text: "Unlike PROs, SoundExchange pays performers (you), not just songwriters. This is separate money for the same plays."

Split Visualization:
  Sound Recording Owner: 50%
  Featured Artist: 45%
  Session Musicians: 5%
```

**Action:** "Register Free" → opens SoundExchange in new tab

### 2.3 MLC Section

**Priority:** RECOMMENDED (blocks if PRO not done)

#### Header
```
Icon: FileMusic (lucide-react)
Title: "Mechanical Licensing Collective (MLC)"
Subtitle: "Collect mechanical royalties from streaming (Spotify, Apple Music)"
Status Badge: "Waiting on PRO" (gray) | "Ready to start" (blue) | "Complete" (green)
```

#### Expanded Content

**Dependency Warning (if PRO not complete):**
```
Alert Box (gray):
  Icon: Lock
  Title: "Complete PRO registration first"
  Text: "The MLC requires your IPI number from your PRO registration."
  Action: "Go to PRO Registration" (scrolls to that section)
```

**Ready State:**
```
Info Box:
  Title: "Why MLC matters"
  Text: "Streaming services pay mechanical royalties to the MLC. If you're not registered, that money goes unclaimed."

Action: "Register with MLC" → opens MLC portal
```

### 2.4 Copyright Section

**Priority:** OPTIONAL (recommended for important works)

#### Header
```
Icon: Copyright (lucide-react)
Title: "Copyright Registration"
Subtitle: "Register with Library of Congress for full legal protection"
Status Badge: "Optional" (gray) | "Complete" (green)
```

#### Expanded Content
```
Info Box:
  Title: "When to register"
  Text: "Copyright exists automatically when you create music. Registration is only needed if you plan to sue for infringement."

Cost: $45-65 per work
Timeline: 3-9 months

Action: "Learn More" (collapsible with detailed info)
```

---

## 3. ActionPanel (Sticky Footer)

**Position:** Fixed bottom, full width
**Background:** White with shadow-lg
**Padding:** p-4

### States

**Incomplete Required Items:**
```
Primary Button: "Continue Setup" (disabled, gray)
Secondary Text: "Complete PRO registration to enable releases"
```

**All Required Complete:**
```
Primary Button: "Go to Dashboard" (enabled, indigo)
Secondary Text: "You're ready to release music!"
```

**Help Link:**
```
Text: "Need help? Chat with our Publishing Agent"
Icon: MessageCircle
Style: text-sm text-indigo-600 hover:text-indigo-800
```

---

## 4. ReleaseGateBanner (Conditional)

**Display:** When user attempts to schedule release with incomplete gates

### Visual
- **Background:** Red-50 border-l-4 border-red-500
- **Padding:** p-4
- **Position:** Top of checklist (sticky)

### Content
```
Icon: AlertOctagon (red)
Title: "Release blocked"
Text: "Complete these items before scheduling your release:"

List:
  ✗ PRO registration (required)
  ✗ Split sheet signed (required)
  ○ MLC registration (recommended)

Action: "Fix Issues" (scrolls to first incomplete item)
```

---

## 5. Interactive Behaviors

### Section Expansion
- Click header to expand/collapse
- Only one section expanded at a time (accordion style)
- PRO section expanded by default

### Progress Updates
- Real-time status updates from backend
- Polling every 30 seconds when section is expanded
- Visual feedback on status change (subtle pulse)

### External Links
- All "Register" buttons open in new tab
- Track outbound clicks for analytics
- Show "Return to check status" reminder

### Mobile Behavior
- Full-width cards
- Stacked layout (no side-by-side)
- Bottom sheet for PRO selection modal

---

## 6. Data Integration

### Props Interface
```typescript
interface RegistrationChecklistProps {
  userId: string;
  royaltyProfile: RoyaltyProfile;
  releaseGate?: ReleaseGate; // If checking before release
  onStatusChange?: (status: RegistrationStatus) => void;
  onComplete?: () => void;
}
```

### API Endpoints Used
```
GET /api/royalty/profile/:userId
GET /api/royalty/checklist/:userId
POST /api/royalty/pro/select (body: { pro: 'BMI' | 'ASCAP' | 'SESAC' })
```

---

## 7. Empty/Loading States

### Loading
```
Skeleton cards (4 sections)
Pulsing gray backgrounds
"Loading your registration status..."
```

### Error
```
Alert: "Couldn't load registration status"
Action: "Retry" button
Fallback: Show all sections as "not started" with manual refresh
```

---

## 8. Analytics Events

```typescript
events: {
  'checklist_viewed': { userId, source: 'onboarding' | 'settings' | 'release_gate' }
  'section_expanded': { section: 'pro' | 'soundexchange' | 'mlc' | 'copyright' }
  'pro_selected': { pro: 'BMI' | 'ASCAP' | 'SESAC' }
  'external_link_clicked': { destination: string }
  'checklist_completed': { userId, timeSpentMinutes }
}
```

---

## 9. Accessibility

- All interactive elements keyboard accessible
- ARIA labels for status indicators
- Focus management on section expand
- Color not sole indicator (icons + text)
- Reduced motion support

---

## 10. Implementation Notes

### Dependencies
- lucide-react (icons)
- @/components/ui (shadcn/ui components)
- @/services/royalty (royalty API service)

### File Structure
```
src/modules/royalty/components/
├── RegistrationChecklist.tsx
├── ChecklistHeader.tsx
├── RegistrationSection.tsx
├── ProRegistrationSection.tsx
├── SoundExchangeSection.tsx
├── MlcSection.tsx
├── CopyrightSection.tsx
├── ActionPanel.tsx
├── ReleaseGateBanner.tsx
└── index.ts
```

### State Management
- Local state for UI (expanded sections)
- Zustand store for data (royalty profile)
- React Query for server state

---

## Related Documents

- `royalty-models.ts` — Data models
- `royalty-rules.md` — Business logic
- `integration-notes.md` — Agent integration
