/**
 * System signals store — the single, THREE-free channel between the DOM page
 * (scroll, sections, CTAs, thesis audio) and the WebGL system experience.
 *
 * The render loop reads this store via getState() inside useFrame, so high-
 * frequency updates never trigger React renders. The page writes to it with
 * tiny setters. Keeping this module free of any three/r3f import guarantees
 * the main bundle never pulls WebGL code through the page's imports.
 */
import { create } from 'zustand';

export type PulseKind = 'section' | 'cta' | 'waitlist' | 'stats' | 'conductor' | 'founder' | 'finale';

export interface SystemPulse {
  id: number;
  kind: PulseKind;
  /** Node index (0-7) or hub when the pulse originates at a node. */
  origin: number | 'hub';
  strength: number; // 0..1
  emittedAt: number; // performance.now()
}

export interface AudioLevels {
  bass: number; // 0..1
  mid: number; // 0..1
  high: number; // 0..1
}

export interface SystemSignalsState {
  /** Document scroll progress 0..1. */
  scrollProgress: number;
  /** Smoothed scroll velocity in progress-units per second (can be negative). */
  scrollVelocity: number;
  /** Normalized pointer position, -1..1 on both axes. */
  pointer: { x: number; y: number };
  pointerActive: boolean;
  /** Id of the section currently in the reading zone ('' when none). */
  activeSection: string;
  /** 0..1 ambient energy for the network, derived from the active section. */
  sectionEnergy: number;
  /** Loop closed (founder-access finale reached). */
  loopClosed: boolean;
  pulses: SystemPulse[];
  audio: AudioLevels;
  audioActive: boolean;
  /** True while the document is hidden. */
  hidden: boolean;

  setScroll: (progress: number, velocity: number) => void;
  setPointer: (x: number, y: number, active: boolean) => void;
  setSection: (id: string, energy: number) => void;
  setLoopClosed: (closed: boolean) => void;
  emitPulse: (kind: PulseKind, origin?: number | 'hub', strength?: number) => void;
  setAudio: (levels: AudioLevels, active: boolean) => void;
  setHidden: (hidden: boolean) => void;
}

let pulseId = 0;

/** Per-section ambient energy: quiet during text sections, active near system moments. */
export const SECTION_ENERGY: Record<string, number> = {
  hero: 0.5,
  waitlist: 0.32,
  detroit: 0.22,
  thesis: 0.22,
  stats: 0.7,
  legacy: 0.4,
  capabilities: 0.55,
  conductor: 0.8,
  studio: 0.5,
  principles: 0.25,
  onboarding: 0.3,
  'founder-access': 0.9,
  footer: 0.35,
};

const MAX_PULSES = 12;

export const systemSignals = create<SystemSignalsState>((set, get) => ({
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

  setScroll: (progress, velocity) => set({ scrollProgress: progress, scrollVelocity: velocity }),
  setPointer: (x, y, active) => set({ pointer: { x, y }, pointerActive: active }),
  setSection: (id, energy) => {
    if (get().activeSection !== id || Math.abs(get().sectionEnergy - energy) > 0.001) {
      set({ activeSection: id, sectionEnergy: energy });
    }
  },
  setLoopClosed: (closed) => {
    if (get().loopClosed !== closed) set({ loopClosed: closed });
  },
  emitPulse: (kind, origin = 0, strength = 1) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const pulses = [...get().pulses, { id: ++pulseId, kind, origin, strength, emittedAt: now }].slice(
      -MAX_PULSES,
    );
    set({ pulses });
  },
  setAudio: (levels, active) => set({ audio: levels, audioActive: active }),
  setHidden: (hidden) => {
    if (get().hidden !== hidden) set({ hidden });
  },
}));

/** Convenience for DOM components (no React subscription needed). */
export function emitSystemPulse(kind: PulseKind, origin?: number | 'hub', strength?: number) {
  systemSignals.getState().emitPulse(kind, origin, strength);
}

export function setSystemScroll(progress: number, velocity: number) {
  systemSignals.getState().setScroll(progress, velocity);
}

export function setSystemPointer(x: number, y: number, active: boolean) {
  systemSignals.getState().setPointer(x, y, active);
}

export function setSystemSection(id: string, energy: number) {
  systemSignals.getState().setSection(id, energy);
}

export function setSystemLoopClosed(closed: boolean) {
  systemSignals.getState().setLoopClosed(closed);
}

export function setSystemAudio(levels: AudioLevels, active: boolean) {
  systemSignals.getState().setAudio(levels, active);
}

export function setSystemHidden(hidden: boolean) {
  systemSignals.getState().setHidden(hidden);
}
