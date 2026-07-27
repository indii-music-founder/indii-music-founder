import type * as THREE from 'three';
import type { MaterialNode } from '@react-three/fiber';

/**
 * ISSUE-1190: declarations for React-Three-Fiber custom elements.
 *
 * R3F v8 creates JSX tags dynamically from classes passed to `extend()`, so a
 * custom material genuinely needs a JSX declaration — TypeScript cannot infer
 * a tag that is registered at runtime. R3F v8 targets React 18 and augments the
 * **global** `JSX.IntrinsicElements`, so `declare global` is the correct form
 * here. This file carries top-level imports, which makes it a module — the
 * requirement for `declare global` to be legal. `vite-env.d.ts` is a script (no
 * top-level import/export), which is why the declaration does not belong there.
 *
 * What this file replaces: a blanket `[elemName: string]: any` index signature
 * that made *every* unknown tag legal with *any* props. That is not an escape
 * hatch, it is a repo-wide hole — it is what allowed ISSUE-1185's real keying
 * bug to typecheck cleanly. Declare each custom element explicitly, or not at
 * all. Never reintroduce an index signature to silence a new error.
 */

/** Uniforms of `WaveShaderMaterial` (`components/shared/WaveMesh.tsx`). */
interface WaveShaderMaterialUniforms {
    uTime?: number;
    uAudioEQ?: THREE.Vector4;
    uColorStart?: THREE.Color;
    uColorEnd?: THREE.Color;
    uColorBass?: THREE.Color;
    uColorLowMid?: THREE.Color;
    uColorHighMid?: THREE.Color;
    uColorTreble?: THREE.Color;
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            waveShaderMaterial: MaterialNode<
                THREE.ShaderMaterial & WaveShaderMaterialUniforms,
                typeof THREE.ShaderMaterial
            > & WaveShaderMaterialUniforms;
        }
    }
}

export {};
