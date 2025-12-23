# Performance Refactoring Plan

**Created:** 2025-12-12
**Status:** Completed (December 12, 2025)
**Goal:** Make the code fast as lightning

---

## Summary

This document outlines 5 high-impact performance refactoring opportunities identified in the indiiOS codebase. Each section includes the problem, specific line numbers, and exact implementation steps.

---

## Priority 1: VideoEditor.tsx (466 lines)

**Impact:** +40% drag smoothness
**File:** `src/modules/video/editor/VideoEditor.tsx`

### Problems

1. **Event listeners thrashing** (Lines 123-152): useEffect with `dragState` dependency causes window event listeners to be added/removed rapidly during drag operations (~60fps mousemove)
2. **No throttling** (Lines 140-141): `handleMouseMove` updates store on every pixel movement
3. **Inline find() in render** (Lines 59, 173): O(n) lookup for selected clip on every render
4. **Missing passive listeners**: Mouse events not using passive flag

### Solution

```typescript
// 1. Use useRef for drag state to avoid effect recreation
const dragStateRef = useRef(dragState);
useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

// 2. Add throttled mouse handler
const handleMouseMove = useMemo(() =>
  throttle((e: MouseEvent) => {
    if (!dragStateRef.current.isDragging) return;
    // ... existing logic
  }, 16), // ~60fps
[]);

// 3. Use requestAnimationFrame for drag updates
const rafId = useRef<number>();
const updateDragPosition = useCallback((e: MouseEvent) => {
  if (rafId.current) cancelAnimationFrame(rafId.current);
  rafId.current = requestAnimationFrame(() => {
    // ... position update logic
  });
}, []);

// 4. Add event listeners once with cleanup
useEffect(() => {
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('mouseup', handleMouseUp);
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, []); // Empty deps - handlers use refs

// 5. Memoize selected clip lookup
const selectedClip = useMemo(() =>
  clips.find(c => c.id === selectedClipId),
  [clips, selectedClipId]
);
```

### Files to Create

- `src/lib/throttle.ts` - Throttle utility function

---

## Priority 2: VideoTimeline.tsx (287 lines)

**Impact:** +25-30% render speed
**File:** `src/modules/video/editor/components/VideoTimeline.tsx`

### Problems

1. **Array creation in render** (Lines 122-126): `Array.from({ length }).map()` for time ruler runs every render
2. **O(n²) clip filtering** (Lines 175-273): `project.clips.filter(c => c.trackId === track.id).map()` nested in track map
3. **Repeated ternary logic** (Lines 230-262): Keyframe color determination duplicated in map
4. **Set reference lost** (Line 45): `new Set()` in useState loses reference equality

### Solution

```typescript
// 1. Memoize time ruler marks
const timeRulerMarks = useMemo(() => {
  const totalSeconds = Math.ceil(project.durationInFrames / project.fps);
  return Array.from({ length: totalSeconds + 1 }, (_, i) => ({
    second: i,
    label: `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}`,
    position: (i * project.fps / project.durationInFrames) * 100
  }));
}, [project.durationInFrames, project.fps]);

// 2. Pre-group clips by track ID
const clipsByTrack = useMemo(() => {
  const grouped: Record<string, typeof clips> = {};
  for (const clip of project.clips) {
    if (!grouped[clip.trackId]) grouped[clip.trackId] = [];
    grouped[clip.trackId].push(clip);
  }
  return grouped;
}, [project.clips]);

// 3. Extract keyframe color utility
// File: src/modules/video/editor/utils/keyframeUtils.ts
export function getKeyframeColor(easing: string): string {
  switch (easing) {
    case 'easeIn': return 'bg-blue-500';
    case 'easeOut': return 'bg-green-500';
    case 'easeInOut': return 'bg-purple-500';
    default: return 'bg-yellow-500';
  }
}

// 4. Use callback for Set updates
const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(() => new Set());
const toggleExpanded = useCallback((id: string) => {
  setExpandedClipIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}, []);
```

### Files to Create

- `src/modules/video/editor/utils/keyframeUtils.ts` - Keyframe helper functions
- `src/modules/video/editor/components/TimelineTrack.tsx` - Memoized track component
- `src/modules/video/editor/components/TimelineClip.tsx` - Memoized clip component

---

## Priority 3: ChatOverlay.tsx (150+ lines)

**Impact:** +50% with large chat histories
**File:** `src/core/components/ChatOverlay.tsx`

### Problems

1. **Complex dependency array** (Line 60): Creates new string every render with `.map().join(',')`
2. **No virtualization** (Lines 97-170): Large message lists render all items
3. **Sync voice call** (Line 72): `voiceService.speak()` blocks during effect
4. **Unmemoized children** (Line 33): ThoughtChain components recreated on every message

### Solution

```typescript
// 1. Simplify scroll dependency
const messageCount = agentHistory.length;
useEffect(() => {
  scrollToBottom();
}, [messageCount]);

// 2. Add virtualization for large lists
import { FixedSizeList as List } from 'react-window';

const MessageList = memo(({ messages }: { messages: AgentMessage[] }) => (
  <List
    height={400}
    itemCount={messages.length}
    itemSize={80}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <MemoizedMessage message={messages[index]} />
      </div>
    )}
  </List>
));

// 3. Defer voice synthesis
useEffect(() => {
  if (shouldSpeak) {
    const timeoutId = setTimeout(() => voiceService.speak(text), 0);
    return () => clearTimeout(timeoutId);
  }
}, [shouldSpeak, text]);

// 4. Memoize message components
const MemoizedMessage = memo(({ message }: { message: AgentMessage }) => (
  <div className="message">
    {message.text}
    {message.thoughts && <ThoughtChain thoughts={message.thoughts} />}
  </div>
));

const MemoizedThoughtChain = memo(ThoughtChain);
```

### Dependencies to Add

```bash
npm install react-window
npm install -D @types/react-window
```

---

## Priority 4: CommandBar.tsx (327 lines)

**Impact:** +15-20% re-render reduction
**File:** `src/core/components/CommandBar.tsx`

### Problems

1. **Triple registry lookup** (Lines 78, 237-248): `agentRegistry.getAll()` called 3 times per render
2. **Unmemoized handlers** (Lines 82-95): FileReader Promise.all recreated each render
3. **Missing React.memo**: Component has expensive children

### Solution

```typescript
// 1. Memoize agent list
const allAgents = useMemo(() => agentRegistry.getAll(), []);

const delegateOptions = useMemo(() =>
  allAgents
    .filter(a => a.id !== 'agent-zero')
    .map(a => ({ id: a.id, name: a.name, description: a.description })),
  [allAgents]
);

// 2. Memoize file processing handler
const processFiles = useCallback(async (files: File[]) => {
  const results = await Promise.all(
    files.map(file => new Promise<{ name: string; data: string }>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        data: reader.result as string
      });
      reader.readAsDataURL(file);
    }))
  );
  return results;
}, []);

// 3. Extract delegate menu to memoized component
const DelegateMenu = memo(({
  agents,
  onSelect
}: {
  agents: typeof delegateOptions;
  onSelect: (id: string) => void;
}) => (
  <motion.div>
    {agents.map(agent => (
      <button key={agent.id} onClick={() => onSelect(agent.id)}>
        {agent.name}
      </button>
    ))}
  </motion.div>
));

// 4. Wrap entire component
export default memo(CommandBar);
```

---

## Priority 5: PromptBuilder.tsx (140 lines)

**Impact:** +10-15% improvement
**File:** `src/modules/creative/components/PromptBuilder.tsx`

### Problems

1. **Inline array computation** (Lines 16-22): `brandTags` filtered every render
2. **Triple-nested mapping** (Lines 72-135): Complex JSX structure
3. **Duplicated button logic** (Lines 51-62, 95-106, 114-125): Same rendering repeated

### Solution

```typescript
// 1. Memoize brand tags
const brandTags = useMemo(() => {
  if (!userProfile?.brandKit) return [];
  const { colors, fonts, keywords } = userProfile.brandKit;
  return [
    ...(colors || []).map(c => ({ type: 'color', value: c })),
    ...(fonts || []).map(f => ({ type: 'font', value: f })),
    ...(keywords || []).map(k => ({ type: 'keyword', value: k })),
  ];
}, [userProfile?.brandKit]);

// 2. Extract reusable tag button
const TagButton = memo(({
  label,
  onClick,
  active
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "px-2 py-1 rounded text-xs",
      active ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"
    )}
  >
    {label}
  </button>
));

// 3. Use shallow selector for store
const brandKit = useStore(
  useCallback(state => state.userProfile?.brandKit, [])
);
```

---

## Implementation Order

1. **Week 1:** VideoEditor + VideoTimeline (biggest UX impact)
2. **Week 2:** ChatOverlay + react-window integration
3. **Week 3:** CommandBar + PromptBuilder cleanup

---

## New Utility Files to Create

```
src/lib/
├── throttle.ts          # Throttle/debounce utilities
└── canvasUtils.ts       # Already created

src/modules/video/editor/
├── utils/
│   └── keyframeUtils.ts # Keyframe color helpers
└── components/
    ├── TimelineTrack.tsx  # Memoized track row
    └── TimelineClip.tsx   # Memoized clip component
```

---

## Testing Checklist

After each refactor:

- [ ] Run `npm run test` - all tests pass
- [ ] Run `npm run build` - no build errors
- [ ] Manual test drag operations in video editor
- [ ] Check React DevTools Profiler for re-render counts
- [ ] Verify no memory leaks with Chrome DevTools

---

## Metrics to Track

Before/after each refactor, measure:

1. **Re-render count** per user interaction (React DevTools)
2. **Frame rate** during drag operations (Chrome Performance tab)
3. **Time to Interactive** for chat with 100+ messages
4. **Bundle size** change (if adding dependencies)

---

## Already Completed

- [x] CreativeCanvas.tsx refactored (513 → 248 lines, 52% reduction)
- [x] All model references updated to current versions
- [x] Utility functions extracted to `src/lib/canvasUtils.ts`
- [x] CandidatesCarousel component extracted
- [x] CanvasOperationsService created
