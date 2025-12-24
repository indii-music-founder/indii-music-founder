# Dashboard Enhancements Implementation Plan

**Status:** Ready for Implementation
**Last Updated:** 2025-12-24

---

## Overview

Three features to complete the Dashboard module:

1. **Storage Health Bar** - Visual indicator with Firebase Storage integration
2. **Project Duplication** - Clone projects with all assets
3. **Analytics/Stats View** - Real usage data with gamification

---

## 1. Storage Health Bar Enhancement

### Current State

`DataStorageManager.tsx` already renders a storage bar using `navigator.storage.estimate()` (browser IndexedDB quota). This needs enhancement to show Firebase Storage usage.

### Implementation

**File:** `src/services/dashboard/DashboardService.ts`

```typescript
// Add Firebase Storage stats
static async getFirebaseStorageStats(orgId: string): Promise<StorageStats> {
    // Query organization's storage usage from Firestore metadata
    // Firebase Storage doesn't have direct quota API, so we track usage in Firestore
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    const storageUsed = orgDoc.data()?.storageUsedBytes || 0;

    // Tier-based quotas from MembershipService
    const tier = orgDoc.data()?.membershipTier || 'free';
    const quotas = { free: 1_073_741_824, pro: 10_737_418_240, enterprise: 107_374_182_400 }; // 1GB, 10GB, 100GB

    return {
        usedBytes: storageUsed,
        quotaBytes: quotas[tier],
        percentUsed: (storageUsed / quotas[tier]) * 100
    };
}
```

**File:** `src/modules/dashboard/components/DataStorageManager.tsx`

- Add tier indicator badge
- Color-code bar based on usage (green < 70%, yellow < 90%, red >= 90%)
- Add breakdown tooltip (Images, Videos, Knowledge Base)

### UI Mockup

```
┌─────────────────────────────────────────┐
│ 💾 Storage Health            [PRO TIER] │
├─────────────────────────────────────────┤
│ Used: 2.4 GB / 10 GB                    │
│ ████████████░░░░░░░░░░░░░░░░░  24%      │
│                                         │
│ Breakdown:                              │
│   Images: 1.8 GB    Videos: 0.5 GB      │
│   KB: 0.1 GB                            │
└─────────────────────────────────────────┘
```

---

## 2. Project Duplication Feature

### Current State

`ProjectHub.tsx` has project cards with a "MoreVertical" button but no menu actions.

### Implementation

**File:** `src/modules/dashboard/components/ProjectHub.tsx`

1. Add dropdown menu on MoreVertical click
2. Menu items: Open, Duplicate, Archive, Delete

**File:** `src/services/dashboard/DashboardService.ts`

```typescript
static async duplicateProject(projectId: string): Promise<ProjectMetadata> {
    // 1. Fetch original project
    const original = await getDoc(doc(db, 'projects', projectId));
    const data = original.data();

    // 2. Create new project document
    const newProject = await addDoc(collection(db, 'projects'), {
        ...data,
        name: `${data.name} (Copy)`,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
    });

    // 3. Copy history/assets subcollection
    const historySnap = await getDocs(collection(db, `projects/${projectId}/history`));
    const batch = writeBatch(db);
    historySnap.docs.forEach(doc => {
        batch.set(
            doc(db, `projects/${newProject.id}/history/${doc.id}`),
            doc.data()
        );
    });
    await batch.commit();

    return { id: newProject.id, name: `${data.name} (Copy)`, ... };
}
```

### UI Mockup

```
┌─────────────────────┐
│ [Project Card]   ⋮  │ ← Click
├─────────────────────┤
│   📂 Open           │
│   📋 Duplicate      │ ← New
│   📦 Archive        │
│   🗑️ Delete         │
└─────────────────────┘
```

---

## 3. Analytics/Stats Gamification View

### Current State

`AnalyticsView.tsx` has hardcoded stats (1,248 generations, 8,901 messages).

### Implementation

**File:** `src/services/dashboard/DashboardService.ts`

```typescript
export interface AnalyticsData {
    totalGenerations: number;
    totalMessages: number;
    totalVideoSeconds: number;
    totalProjects: number;
    weeklyActivity: number[]; // Last 7 days
    topPromptWords: { word: string; count: number }[];
    streak: number; // Days in a row
}

static async getAnalytics(orgId: string): Promise<AnalyticsData> {
    // Aggregate from Firestore
    const historySnap = await getDocs(
        query(collection(db, 'history'),
              where('orgId', '==', orgId))
    );

    const generations = historySnap.docs.filter(d => d.data().type === 'image').length;
    const videos = historySnap.docs.filter(d => d.data().type === 'video');
    const videoSeconds = videos.reduce((sum, v) => sum + (v.data().duration || 0), 0);

    // Word cloud from prompts
    const allPrompts = historySnap.docs.map(d => d.data().prompt || '').join(' ');
    const words = allPrompts.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const wordCounts = words.reduce((acc, w) => ({ ...acc, [w]: (acc[w] || 0) + 1 }), {});
    const topWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));

    return { totalGenerations: generations, ... };
}
```

**File:** `src/modules/dashboard/components/AnalyticsView.tsx`

- Fetch real data on mount
- Add animated counters
- Add streak indicator with flame icon
- Add word cloud visualization
- Weekly activity bar chart with real data

### UI Mockup

```
┌─────────────────────────────────────────┐
│ 📊 Studio Stats                🔥 5 day │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │ ⚡ 1,248 │ │ 💬 8,901 │ │ 🎬 2:34  │   │
│ │ Images  │ │ Messages │ │ Video   │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                         │
│ This Week:                              │
│ █▃█▅▇▂█                                 │
│ M T W T F S S                           │
│                                         │
│ Top Words:                              │
│ [neon] [cyberpunk] [portrait] [city]    │
└─────────────────────────────────────────┘
```

---

## File Changes Summary

### New Files

None required - enhancing existing components.

### Modified Files

| File | Changes |
|------|---------|
| `src/services/dashboard/DashboardService.ts` | Add `duplicateProject`, `getAnalytics`, `getFirebaseStorageStats` |
| `src/modules/dashboard/components/DataStorageManager.tsx` | Add tier badge, color-coded bar, breakdown |
| `src/modules/dashboard/components/ProjectHub.tsx` | Add dropdown menu with duplicate action |
| `src/modules/dashboard/components/AnalyticsView.tsx` | Fetch real data, add streak, word cloud |

---

## Implementation Order

1. **DashboardService.ts** - Add all new methods first
2. **DataStorageManager.tsx** - Quick win, visible improvement
3. **ProjectHub.tsx** - Add dropdown + duplicate
4. **AnalyticsView.tsx** - Most complex, do last

---

## Testing Checklist

- [ ] Storage bar shows correct usage from Firebase
- [ ] Storage bar colors based on usage percentage
- [ ] Project duplicate creates new project with "(Copy)" suffix
- [ ] Duplicated project includes all history/assets
- [ ] Analytics shows real generation counts
- [ ] Weekly activity chart reflects actual usage
- [ ] Word cloud generates from real prompts
