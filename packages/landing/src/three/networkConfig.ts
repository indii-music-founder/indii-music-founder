/**
 * Network choreography config — the story of the indii system in numbers.
 *
 * 8 nodes = the product lifecycle: create → prepare → register → deliver →
 * release → track → operate → repeat. Nodes sit in a loose arc behind the
 * page; when the visitor reaches Founder Access the arc closes into a loop —
 * the "repeat" of the lifecycle, drawn as a ring.
 *
 * Positions are normalized viewport coordinates (-1..1) so the composition
 * adapts to any aspect ratio; the scene multiplies them by the live viewport.
 */

export interface NetworkPoint {
  nx: number;
  ny: number;
}

/** Arc formation: the system before it closes. */
export const ARC_POSITIONS: NetworkPoint[] = [
  { nx: 0.6, ny: -0.36 }, //  0 create  — visible from the hero, below the headline
  { nx: 0.72, ny: -0.5 }, //  1 prepare
  { nx: 0.62, ny: -0.62 }, // 2 register
  { nx: 0.34, ny: -0.7 }, //  3 deliver
  { nx: 0.0, ny: -0.72 }, //  4 release
  { nx: -0.34, ny: -0.7 }, // 5 track
  { nx: -0.62, ny: -0.62 }, // 6 operate
  { nx: -0.72, ny: -0.5 }, //  7 repeat — appears late, closes the loop
];

/** Ring formation: the closed loop (centered low, inside the viewport). */
export const RING_POSITIONS: NetworkPoint[] = [
  { nx: 0.42, ny: -0.28 },
  { nx: 0.297, ny: 0.017 },
  { nx: 0, ny: 0.14 },
  { nx: -0.297, ny: 0.017 },
  { nx: -0.42, ny: -0.28 },
  { nx: -0.297, ny: -0.577 },
  { nx: 0, ny: -0.7 },
  { nx: 0.297, ny: -0.577 },
];

/** Vertical squash so the arc stays comfortably inside the frame. */
export const VERTICAL_SCALE = 0.85;

/** Scroll progress at which each node activates. */
export const ACTIVATION_THRESHOLDS: number[] = [-0.5, 0.14, 0.24, 0.34, 0.46, 0.56, 0.68, 0.8];

/** Edges between consecutive lifecycle nodes; index 7 is the closing loop edge. */
export const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 0], // only drawn when the loop closes
];

/** Hub glyph position (Conductor moment) — center of the arc. */
export const HUB_POSITION: NetworkPoint = { nx: 0, ny: -0.34 };

export const COLORS = {
  core: '#FFB800',
  line: '#FFC94D',
  hub: '#FFE08A',
  white: '#FFFFFF',
};

/** Springs: higher = snappier. */
export const NODE_SPRING = 3.2;
export const ENERGY_SPRING = 2.2;
export const LOOP_SPRING = 2.6;
export const HUB_SPRING = 3.0;
