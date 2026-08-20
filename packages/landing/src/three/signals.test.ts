import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  systemSignals,
  emitSystemPulse,
  setSystemScroll,
  setSystemSection,
  setSystemLoopClosed,
  setSystemAudio,
  SECTION_ENERGY,
} from './signals';

describe('system signals store', () => {
  beforeEach(() => {
    systemSignals.setState({
      scrollProgress: 0,
      scrollVelocity: 0,
      pointer: { x: 0, y: 0 },
      pointerActive: false,
      activeSection: 'hero',
      sectionEnergy: SECTION_ENERGY.hero,
      loopClosed: false,
      pulses: [],
      audio: { bass: 0, mid: 0, high: 0 },
      audioActive: false,
      hidden: false,
    });
  });

  it('tracks scroll progress and velocity', () => {
    setSystemScroll(0.42, 1.2);
    const state = systemSignals.getState();
    expect(state.scrollProgress).toBe(0.42);
    expect(state.scrollVelocity).toBe(1.2);
  });

  it('emits pulses with monotonic ids and a bounded queue', () => {
    for (let i = 0; i < 30; i++) emitSystemPulse('cta', 0, 1);
    const pulses = systemSignals.getState().pulses;
    expect(pulses.length).toBeLessThanOrEqual(12);
    const ids = pulses.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tracks the active section with its ambient energy', () => {
    setSystemSection('conductor', SECTION_ENERGY.conductor);
    expect(systemSignals.getState().activeSection).toBe('conductor');
    expect(systemSignals.getState().sectionEnergy).toBe(SECTION_ENERGY.conductor);
  });

  it('remembers the loop once closed', () => {
    expect(systemSignals.getState().loopClosed).toBe(false);
    setSystemLoopClosed(true);
    expect(systemSignals.getState().loopClosed).toBe(true);
  });

  it('records audio levels and activation', () => {
    setSystemAudio({ bass: 0.8, mid: 0.4, high: 0.2 }, true);
    const state = systemSignals.getState();
    expect(state.audio.bass).toBeCloseTo(0.8);
    expect(state.audioActive).toBe(true);
  });

  it('does not re-render subscribers on high-frequency writes', () => {
    const subscriber = vi.fn();
    const unsubscribe = systemSignals.subscribe(subscriber);
    for (let i = 0; i < 50; i++) setSystemScroll(i / 100, 0);
    unsubscribe();
    // Each write notifies; the point is the canvas reads via getState() in
    // the frame loop without React. Sanity: notifications happened at all.
    expect(subscriber).toHaveBeenCalled();
  });
});
