'use client';

/**
 * SystemExperience — the WebGL presentation layer for the indii system.
 *
 * Owns the Canvas, camera choreography, adaptive-quality runtime monitoring
 * (frame-time based one-way downgrade), the scroll/section reader, and the
 * thesis-audio bridge. The network itself lives in SystemNetwork.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import * as THREE from 'three';
import SystemNetwork from './SystemNetwork';
import { useSystemSignals } from './useSystemSignals';
import { initAudioBridge } from './audioBridge';
import { systemSignals } from './signals';
import {
  profileForTier,
  stepDown,
  tierRank,
  type QualityProfile,
  type QualityTier,
} from './quality';

const CLEAR_COLOR = '#020202';

/** Frame-time monitor: step one tier down when the EMA frame time stays high. */
function PerformanceGuard({
  profile,
  onDowngrade,
}: {
  profile: QualityProfile;
  onDowngrade: (tier: QualityTier) => void;
}) {
  const emaRef = useRef(0);
  const windowStartRef = useRef(0);
  const downgradedRef = useRef(false);

  useFrame((state, rawDelta) => {
    // Ignore tab pause/resume spikes: after returning to the foreground the
    // first delta can be seconds long and would poison the EMA into a
    // spurious permanent downgrade.
    const raw = rawDelta || 0.016;
    if (raw > 0.25) return;
    const dt = Math.max(0.016, raw);
    emaRef.current = emaRef.current === 0 ? dt : emaRef.current * 0.95 + dt * 0.05;
    const now = state.clock.elapsedTime;
    if (now - windowStartRef.current < 3) return;
    windowStartRef.current = now;

    if (!downgradedRef.current && emaRef.current > 0.024 && tierRank(profile.tier) > tierRank('LOW')) {
      downgradedRef.current = true;
      const next = stepDown(profile.tier);
      console.info(`[indii] Frame-time monitor stepped quality down: ${profile.tier} → ${next}`);
      onDowngrade(next);
    }
  });

  return null;
}

/** Subtle camera: pointer parallax with smoothed inertia; never scrolls. */
function CameraRig({ profile }: { profile: QualityProfile }) {
  const { camera } = useThree();
  const targetRef = useRef({ x: 0, y: 0 });

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta || 0.016);
    const signals = systemSignals.getState();

    if (profile.pointerParallax && signals.pointerActive) {
      targetRef.current.x = signals.pointer.x * 0.45;
      targetRef.current.y = -signals.pointer.y * 0.3;
    } else if (profile.pointerParallax) {
      // Barely-there idle drift (~30s period, a few cm of parallax) so the
      // system never feels frozen; too slow to read as motion.
      const t = state.clock.elapsedTime;
      targetRef.current.x = Math.sin(t * 0.22) * 0.05;
      targetRef.current.y = Math.cos(t * 0.17) * 0.04;
    } else {
      targetRef.current.x = 0;
      targetRef.current.y = 0;
    }

    const k = 1 - Math.exp(-2.6 * dt);
    // Mutating the R3F camera from useFrame is the canonical three.js pattern
    // (the camera is an imperative scene object, not React state).
    // eslint-disable-next-line react-hooks/immutability
    camera.position.x += (targetRef.current.x - camera.position.x) * k;
    camera.position.y += (targetRef.current.y - camera.position.y) * k;
    camera.lookAt(0, -1.4, 0);
  });

  return null;
}

/**
 * HIGH-tier postprocessing (bloom + vignette), built on three's own addons so
 * the stack is version-locked to the installed three. The composer runs as a
 * priority-1 useFrame: R3F disables its own gl.render while a priority>0
 * subscriber exists, so the composer is the ONLY renderer — exactly one scene
 * render per frame, no double draw.
 */
function BloomComposer() {
  const { gl, scene, camera, size } = useThree();

  const passes = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.55,
      0.72,
      0.5,
    );
    c.addPass(bloom);
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 0.18;
    vignette.uniforms.darkness.value = 0.62;
    c.addPass(vignette);
    return { composer: c, bloom, vignette };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    passes.composer.setSize(size.width, size.height);
  }, [passes, size]);

  useFrame(() => {
    passes.composer.render();
  }, 1);

  useEffect(() => {
    return () => {
      // EffectComposer.dispose() only frees its own targets; UnrealBloomPass
      // holds ~11 full-resolution half-float render targets that must be
      // disposed explicitly or the HIGH→MEDIUM downgrade leaks VRAM.
      passes.composer.dispose();
      passes.bloom.dispose();
      passes.vignette.dispose();
    };
  }, [passes]);

  return null;
}

interface SystemExperienceProps {
  initialProfile: QualityProfile;
  onFallback: () => void;
  onTierChange: (tier: QualityTier) => void;
}

export default function SystemExperience({ initialProfile, onFallback, onTierChange }: SystemExperienceProps) {
  const [profile, setProfile] = useState<QualityProfile>(initialProfile);

  // Scroll/section reader + audio bridge (single instance, outside React state).
  useSystemSignals();
  useEffect(() => initAudioBridge(), []);

  // WebGL context loss → hand back to the DOM fallback.
  useEffect(() => {
    const onLost = () => onFallback();
    window.addEventListener('indii:system-context-lost', onLost);
    return () => window.removeEventListener('indii:system-context-lost', onLost);
  }, [onFallback]);

  const handleDowngrade = (tier: QualityTier) => {
    onTierChange(tier);
    setProfile(profileForTier(tier));
  };

  return (
    <Canvas
      frameloop="always"
      dpr={[1, profile.dprMax]}
      gl={{
        antialias: true,
        alpha: false,
        stencil: false,
        depth: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ position: [0, 0, 16], fov: 42, near: 1, far: 60 }}
      onCreated={({ gl }) => {
        gl.setClearColor(CLEAR_COLOR, 1);
        gl.domElement.addEventListener(
          'webglcontextlost',
          (event) => {
            // A detached canvas from a previous StrictMode mount may lose its
            // context after unmount — that is not a real failure.
            if (!gl.domElement.isConnected) return;
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('indii:system-context-lost'));
          },
          false,
        );
      }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
      role="presentation"
    >
      <PerformanceGuard profile={profile} onDowngrade={handleDowngrade} />
      <CameraRig profile={profile} />
      <SystemNetwork profile={profile} />

      {profile.bloom && <BloomComposer />}
    </Canvas>
  );
}
