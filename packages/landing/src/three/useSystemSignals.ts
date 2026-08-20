/**
 * useSystemSignals — one rAF-driven reader that feeds scroll progress, scroll
 * velocity, pointer position, and section activity into the signals store.
 *
 * It never calls React setState: the WebGL loop consumes the store directly,
 * so this whole pipeline runs outside React's render cycle. It also detects
 * section entries and emits the story events (stats burst, conductor hub,
 * founder loop-close, finale) that drive the network's choreography.
 */
import { useEffect, useRef } from 'react';
import {
  setSystemHidden,
  setSystemPointer,
  setSystemScroll,
  setSystemSection,
  setSystemLoopClosed,
  emitSystemPulse,
  SECTION_ENERGY,
} from './signals';

/** Reading zone: a section is "active" when it covers this viewport line. */
const READING_LINE = 0.52;

interface SectionRect {
  id: string;
  top: number;
  bottom: number;
}

const QUERY = '[data-system-section]';

function measureSections(): SectionRect[] {
  if (typeof document === 'undefined') return [];
  const elements = Array.from(document.querySelectorAll<HTMLElement>(QUERY));
  const scrollY = window.scrollY;
  return elements
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return { id: el.dataset.systemSection ?? '', top: rect.top + scrollY, bottom: rect.bottom + scrollY };
    })
    .filter((s) => s.id !== '');
}

export function useSystemSignals() {
  const frameRef = useRef<number | null>(null);
  const rectsRef = useRef<SectionRect[]>([]);
  const lastSectionRef = useRef<string>('');
  const firedEventsRef = useRef<Set<string>>(new Set());
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);

  useEffect(() => {
    const measure = () => {
      rectsRef.current = measureSections();
    };

    // Below-the-fold sections mount lazily (IntersectionObserver) — re-measure
    // whenever the DOM gains sections, so their rects are never stale.
    let remeasureTimer: number | null = null;
    const scheduleRemeasure = () => {
      if (remeasureTimer !== null) return;
      remeasureTimer = window.setTimeout(() => {
        remeasureTimer = null;
        measure();
      }, 120);
    };
    const observer = new MutationObserver(scheduleRemeasure);
    observer.observe(document.body, { childList: true, subtree: true });

    const onResize = () => {
      // Re-measure after layout settles.
      window.requestAnimationFrame(() => window.requestAnimationFrame(measure));
    };

    const onVisibility = () => {
      setSystemHidden(document.hidden);
    };

    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      setSystemPointer(x, y, true);
    };

    const onPointerLeave = () => {
      setSystemPointer(0, 0, false);
    };

    const tick = (time: number) => {
      frameRef.current = window.requestAnimationFrame(tick);

      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));

      const dt = Math.min(0.25, (time - lastTimeRef.current) / 1000 || 0.016);
      lastTimeRef.current = time;
      const delta = progress - lastProgressRef.current;
      lastProgressRef.current = progress;

      const targetVelocity = dt > 0 ? delta / dt : 0;
      velocityRef.current += (Math.max(-6, Math.min(6, targetVelocity)) - velocityRef.current) * 0.35;

      setSystemScroll(progress, velocityRef.current);

      // Section activity — cache rects once; they only change on resize.
      // All comparisons happen in document space (rects are measured + scrollY).
      let activeId = '';
      const viewportLine = window.scrollY + window.innerHeight * READING_LINE;
      for (const section of rectsRef.current) {
        if (section.top <= viewportLine && section.bottom >= viewportLine) {
          activeId = section.id;
          break;
        }
      }
      // First section wins; also fall back to "nearest below" when between sections.
      if (!activeId && rectsRef.current.length > 0) {
        let best = rectsRef.current[0];
        for (const section of rectsRef.current) {
          if (section.top <= viewportLine) best = section;
          else break;
        }
        activeId = best.id;
      }

      if (activeId !== lastSectionRef.current) {
        lastSectionRef.current = activeId;
        const energy = SECTION_ENERGY[activeId] ?? 0.3;
        setSystemSection(activeId, energy);

        // Story events, fired once per section entry.
        if (activeId === 'stats' && !firedEventsRef.current.has('stats')) {
          firedEventsRef.current.add('stats');
          emitSystemPulse('stats');
        }
        if (activeId === 'conductor' && !firedEventsRef.current.has('conductor')) {
          firedEventsRef.current.add('conductor');
          emitSystemPulse('conductor', 'hub');
        }
        if (activeId === 'founder-access') {
          setSystemLoopClosed(true);
          if (!firedEventsRef.current.has('founder')) {
            firedEventsRef.current.add('founder');
            emitSystemPulse('founder');
          }
        }
        if (activeId === 'footer' && !firedEventsRef.current.has('finale')) {
          firedEventsRef.current.add('finale');
          emitSystemPulse('finale');
        }
      }
    };

    measure();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    setSystemHidden(document.hidden);
    frameRef.current = window.requestAnimationFrame((time) => {
      lastTimeRef.current = time;
      tick(time);
    });

    // Layout can shift after fonts/images settle — re-measure a few times.
    const settleTimers = [400, 1200, 2500].map((delay) => window.setTimeout(measure, delay));

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      if (remeasureTimer !== null) window.clearTimeout(remeasureTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
}
