'use client';

/**
 * SystemNetwork — the persistent indii "system" behind the page.
 *
 * Eight nodes (the lifecycle: create → prepare → register → deliver → release
 * → track → operate → repeat) activate progressively with scroll, connected by
 * waveform-like signal traces that carry traveling pulses. Section entries
 * (stats band, conductor, founder access) trigger choreographed events; the
 * thesis soundtrack, when the visitor enables it, makes the whole network
 * breathe with the music.
 *
 * Everything here runs inside useFrame against the signals store — no React
 * state is touched by the animation loop.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { systemSignals, type SystemPulse } from './signals';
import {
  ARC_POSITIONS,
  RING_POSITIONS,
  VERTICAL_SCALE,
  ACTIVATION_THRESHOLDS,
  EDGES,
  HUB_POSITION,
  COLORS,
  NODE_SPRING,
  ENERGY_SPRING,
  LOOP_SPRING,
  HUB_SPRING,
} from './networkConfig';
import type { QualityProfile } from './quality';

const EDGE_COUNT = EDGES.length;
const NODE_COUNT = ARC_POSITIONS.length;

const NODE_VERTEX = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vNormalW;
  void main() {
    // instanceColor exists only for instanced meshes (USE_INSTANCING_COLOR).
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uBrightness;
  varying vec3 vColor;
  varying vec3 vNormalW;
  void main() {
    float fres = pow(1.0 - abs(dot(vNormalW, vec3(0.0, 0.0, 1.0))), 2.0);
    vec3 col = uColor * (0.16 + 0.9 * fres) * (0.2 + 0.8 * vColor.r) * uBrightness;
    col += vec3(1.0) * vColor.g * 1.1; // pulse flash
    gl_FragColor = vec4(col, 1.0);
  }
`;

const EDGE_VERTEX = /* glsl */ `
  in float aEdge;
  in float aPhase;
  out float vEdge;
  out float vPhase;
  void main() {
    vEdge = aEdge;
    vPhase = aPhase;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const EDGE_FRAGMENT = /* glsl */ `
  uniform float uEdgeActive[8];
  uniform float uTravel[8];
  uniform float uTravelStrength;
  uniform float uFlash;
  uniform float uEnergy;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uAudio;
  uniform float uAudioActive;
  uniform float uBrightness;
  uniform float uPass;
  in float vEdge;
  in float vPhase;

  out vec4 fragColor;

  void main() {
    int e = int(vEdge);
    float edgeOn = uEdgeActive[e];
    if (edgeOn < 0.01) discard;

    // Oscilloscope shimmer along the trace.
    float shimmer = 0.72 + 0.28 * sin(vPhase * 42.0 - uTime * 3.2);
    // The system breathes with the music when the thesis soundtrack plays.
    float breath = 1.0 + uAudioActive * (0.55 * uAudio.x + 0.3 * uAudio.y + 0.18 * uAudio.z);

    // A traveling pulse belongs to ONE edge — index by this fragment's edge.
    float travel = 0.0;
    {
      float d = abs(vPhase - uTravel[e]);
      travel = smoothstep(0.09, 0.0, d);
    }

    float a = edgeOn * shimmer * breath * (0.12 + 0.3 * uEnergy) * uBrightness;
    a += travel * uTravelStrength * 0.85;
    a += uFlash * edgeOn * 0.7;

    vec3 col = uColor + travel * uTravelStrength * 1.25;
    if (uPass > 0.5) {
      a *= 0.5; // soft glow pass widens the trace visually
    }
    fragColor = vec4(col * a, 1.0);
  }
`;

const EQ_VERTEX = /* glsl */ `
  varying vec3 vColor;
  void main() {
    // instanceColor exists only for instanced meshes (USE_INSTANCING_COLOR).
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const EQ_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBrightness;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(uColor * vColor.r * uBrightness, 1.0);
  }
`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const spring = (current: number, target: number, k: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-k * dt));

/**
 * Module-scope scratch objects for per-frame matrix/color math. They are NOT
 * React values (no hook involvement), so mutating them in the animation loop
 * is safe and allocation-free. A single scene exists at a time, so sharing
 * between mounts is harmless.
 */
const scratchDummy = new THREE.Object3D();
const scratchColor = new THREE.Color();
const scratchAudioVec = new THREE.Vector3();

interface Travel {
  edge: number;
  phase: number;
  speed: number;
  strength: number;
}

interface NetworkProps {
  profile: QualityProfile;
}

export default function SystemNetwork({ profile }: NetworkProps) {
  const viewport = useThree((state) => state.viewport);

  const nodeScaleRef = useRef<Float32Array>(new Float32Array(NODE_COUNT));
  const nodeFlashRef = useRef<Float32Array>(new Float32Array(NODE_COUNT));
  const loopProgressRef = useRef(0);
  const energyRef = useRef(0);
  const edgeFlashRef = useRef(0);
  const hubScaleRef = useRef(0);
  const hubTargetRef = useRef(0);
  const travelsRef = useRef<Travel[]>([]);
  const consumedPulsesRef = useRef<Set<number>>(new Set());
  const elapsedRef = useRef(0);
  const framesRef = useRef(0);
  const fpsRef = useRef(0);
  const viewportKeyRef = useRef('');

  const s = viewport.width; // viewport-relative unit

  // ── Node world positions (arc + ring) ───────────────────────────────────
  const nodeWorld = useMemo(() => {
    // On portrait screens the headline is taller — drop the whole system so
    // the first signal clears the hero type instead of sitting behind it.
    const aspect = viewport.height / viewport.width;
    const verticalShift = aspect > 1.2 ? -0.14 : 0;
    const yScale = 0.5 * VERTICAL_SCALE * (viewport.height / viewport.width);
    const arc = ARC_POSITIONS.map(
      (p) => new THREE.Vector3(p.nx * s * 0.5, (p.ny + verticalShift) * s * yScale, 0),
    );
    const ring = RING_POSITIONS.map(
      (p) => new THREE.Vector3(p.nx * s * 0.5, (p.ny + verticalShift) * s * yScale, 0),
    );
    return { arc, ring };
  }, [s, viewport.height, viewport.width]);

  // ── Edge geometry ───────────────────────────────────────────────────────
  const edgeGeometry = useMemo(() => {
    const segments = profile.edgeSegments;
    const vertexCount = EDGE_COUNT * segments * 2;
    const positions = new Float32Array(vertexCount * 3);
    const edgesAttr = new Float32Array(vertexCount);
    const phasesAttr = new Float32Array(vertexCount);

    let v = 0;
    for (let e = 0; e < EDGE_COUNT; e++) {
      for (let i = 0; i < segments; i++) {
        for (let k = 0; k < 2; k++) {
          const phase = (i + k) / segments;
          edgesAttr[v] = e;
          phasesAttr[v] = phase;
          v++;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aEdge', new THREE.BufferAttribute(edgesAttr, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phasesAttr, 1));
    return geometry;
  }, [profile.edgeSegments]);

  const updateEdgePositions = (positions: THREE.Vector3[]) => {
    const attr = edgeGeometry.getAttribute('position') as THREE.BufferAttribute;
    const segments = profile.edgeSegments;
    const arr = attr.array as Float32Array;
    let v = 0;
    for (let e = 0; e < EDGE_COUNT; e++) {
      const a = positions[EDGES[e][0]];
      const b = positions[EDGES[e][1]];
      for (let i = 0; i < segments; i++) {
        for (let k = 0; k < 2; k++) {
          const t = (i + k) / segments;
          arr[v++] = a.x + (b.x - a.x) * t;
          arr[v++] = a.y + (b.y - a.y) * t;
          arr[v++] = 0;
        }
      }
    }
    attr.needsUpdate = true;
  };

  // ── Materials ───────────────────────────────────────────────────────────
  const nodeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NODE_VERTEX,
        fragmentShader: NODE_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color(COLORS.core) },
          uTime: { value: 0 },
          uBrightness: { value: profile.brightness },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [profile.brightness],
  );

  const edgeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: EDGE_VERTEX,
        fragmentShader: EDGE_FRAGMENT,
        uniforms: {
          uEdgeActive: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
          uTravel: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
          uTravelStrength: { value: 0 },
          uFlash: { value: 0 },
          uEnergy: { value: 0.3 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(COLORS.line) },
          uAudio: { value: new THREE.Vector3(0, 0, 0) },
          uAudioActive: { value: 0 },
          uBrightness: { value: profile.brightness },
          uPass: { value: 0 },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [profile.brightness],
  );
  const edgeGlowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: EDGE_VERTEX,
        fragmentShader: EDGE_FRAGMENT,
        uniforms: {
          uEdgeActive: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
          uTravel: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
          uTravelStrength: { value: 0 },
          uFlash: { value: 0 },
          uEnergy: { value: 0.3 },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(COLORS.line) },
          uAudio: { value: new THREE.Vector3(0, 0, 0) },
          uAudioActive: { value: 0 },
          uBrightness: { value: profile.brightness },
          uPass: { value: 1 },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [profile.brightness],
  );

  const eqMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EQ_VERTEX,
        fragmentShader: EQ_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color(COLORS.hub) },
          uBrightness: { value: profile.brightness },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [profile.brightness],
  );

  // ── Refs to instanced meshes ────────────────────────────────────────────
  const coreMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const eqMeshRef = useRef<THREE.InstancedMesh>(null);
  const edgeLineRef = useRef<THREE.LineSegments>(null);
  const edgeGlowLineRef = useRef<THREE.LineSegments>(null);
  const hubGroupRef = useRef<THREE.Group>(null);
  const hubRingARef = useRef<THREE.Mesh>(null);
  const hubRingBRef = useRef<THREE.Mesh>(null);
  const hubCoreRef = useRef<THREE.Mesh>(null);

  const dummy = scratchDummy;
  const color = scratchColor;
  const edgeAudioVec = scratchAudioVec;
  const coreRadius = 0.011 * s;
  const ringRadius = 0.026 * s;
  const ringTube = 0.0016 * s;

  // ── Pulse handling ──────────────────────────────────────────────────────
  const consumePulses = (pulses: SystemPulse[]) => {
    const consumed = consumedPulsesRef.current;
    for (const pulse of pulses) {
      if (consumed.has(pulse.id)) continue;
      consumed.add(pulse.id);
      const travels = travelsRef.current;
      switch (pulse.kind) {
        case 'stats': {
          edgeFlashRef.current = 1.3 * pulse.strength;
          break;
        }
        case 'conductor': {
          hubTargetRef.current = 1;
          // Pulse outward along every existing trace (inactive edges discard).
          for (let e = 0; e < EDGE_COUNT; e++) {
            travels.push({ edge: e, phase: 0, speed: 0.5, strength: 0.7 });
          }
          break;
        }
        case 'founder': {
          // Ring wave: a pulse travels around the completed loop.
          for (let e = 0; e < EDGE_COUNT; e++) {
            travels.push({ edge: e, phase: e / EDGE_COUNT, speed: 0.5, strength: 1.1 });
          }
          break;
        }
        case 'finale': {
          for (let e = 0; e < EDGE_COUNT; e++) {
            travels.push({ edge: e, phase: e / EDGE_COUNT, speed: 0.8, strength: 1.4 });
          }
          edgeFlashRef.current = 0.9;
          break;
        }
        case 'cta':
        case 'waitlist': {
          const origin = typeof pulse.origin === 'number' ? pulse.origin : 0;
          nodeFlashRef.current[origin] = 1;
          if (origin < EDGE_COUNT) {
            travels.push({ edge: origin, phase: 0, speed: 0.65, strength: pulse.strength });
          }
          break;
        }
        default:
          break;
      }
    }
    // Prune consumed ids that no longer exist (store caps the queue).
    if (consumed.size > 64) {
      const live = new Set(pulses.map((p) => p.id));
      for (const id of Array.from(consumed)) {
        if (!live.has(id)) consumed.delete(id);
      }
    }
  };

  // ── Opening signal ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setTimeout(() => {
      systemSignals.getState().emitPulse('cta', 0, 0.55);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, []);

  // Instance colors must exist BEFORE the first render, or the shader
  // programs compile without USE_INSTANCING_COLOR (setColorAt creates the
  // attribute lazily, which would be one frame too late).
  useLayoutEffect(() => {
    const coreMesh = coreMeshRef.current;
    const ringMesh = ringMeshRef.current;
    const eqMesh = eqMeshRef.current;
    color.setRGB(0, 0, 0);
    if (coreMesh) {
      for (let i = 0; i < NODE_COUNT; i++) coreMesh.setColorAt(i, color);
      if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;
    }
    if (ringMesh) {
      for (let i = 0; i < NODE_COUNT; i++) ringMesh.setColorAt(i, color);
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }
    if (eqMesh) {
      for (let i = 0; i < 8; i++) eqMesh.setColorAt(i, color);
      if (eqMesh.instanceColor) eqMesh.instanceColor.needsUpdate = true;
    }
  }, [color]);

  // ── QA debug hook: exact node positions in screen space (dev only) ─────
  const camera = useThree((state) => state.camera);
  const renderer = useThree((state) => state.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const v = new THREE.Vector3();
    const publish = () => {
      const signals = systemSignals.getState();
      const positions = nodeWorld.arc.map((arcPos, i) => {
        const ringPos = nodeWorld.ring[i];
        const loop = loopProgressRef.current;
        v.set(
          arcPos.x + (ringPos.x - arcPos.x) * loop,
          arcPos.y + (ringPos.y - arcPos.y) * loop,
          0,
        ).project(camera);
        return {
          i,
          active: nodeScaleRef.current[i] > 0.5,
          screen: {
            x: ((v.x + 1) / 2) * window.innerWidth,
            y: ((-v.y + 1) / 2) * window.innerHeight,
          },
        };
      });
      (window as unknown as { __indiiDebug?: unknown }).__indiiDebug = {
        nodes: positions,
        loop: loopProgressRef.current,
        energy: signals.sectionEnergy,
        activeSection: signals.activeSection,
        scrollProgress: signals.scrollProgress,
        scrollVelocity: signals.scrollVelocity,
        hidden: signals.hidden,
        frames: framesRef.current,
        fps: fpsRef.current,
        scale0: nodeScaleRef.current[0],
        renderer: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          programs: renderer.info.programs?.length ?? 0,
        },
      };
    };
    publish();
    let lastFrames = framesRef.current;
    const interval = window.setInterval(() => {
      const now = framesRef.current;
      fpsRef.current = (now - lastFrames) * 2; // 500ms window
      lastFrames = now;
      publish();
    }, 500);
    return () => window.clearInterval(interval);
  }, [nodeWorld, camera, renderer]);

  // ── Per-frame choreography ──────────────────────────────────────────────
  // ── Edge uniforms (core + glow pass share the same values). ────────────
  // THREE materials are mutable by design; uniform writes happen inside a
  // plain helper so the animation loop never mutates memoized React values.
  const writeEdgeUniforms = (
    material: THREE.ShaderMaterial,
    values: {
      time: number;
      active: number[];
      travel: number[];
      travelStrength: number;
      flash: number;
      energy: number;
      audio: THREE.Vector3;
      audioActive: number;
    },
  ) => {
    material.uniforms.uTime.value = values.time;
    material.uniforms.uEdgeActive.value = values.active;
    material.uniforms.uTravel.value = values.travel;
    material.uniforms.uTravelStrength.value = values.travelStrength;
    material.uniforms.uFlash.value = values.flash;
    material.uniforms.uEnergy.value = values.energy;
    (material.uniforms.uAudio.value as THREE.Vector3).copy(values.audio);
    material.uniforms.uAudioActive.value = values.audioActive;
  };

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta || 0.016);
    const time = state.clock.elapsedTime;
    elapsedRef.current = time;
    framesRef.current += 1;

    const signals = systemSignals.getState();
    const { scrollProgress, sectionEnergy, pulses, audio, audioActive, hidden, scrollVelocity } = signals;
    if (hidden) return;

    consumePulses(pulses);

    // Energy + loop + flash springs.
    energyRef.current = spring(energyRef.current, sectionEnergy, ENERGY_SPRING, dt);
    const loopTarget = signals.loopClosed ? 1 : 0;
    loopProgressRef.current = spring(loopProgressRef.current, loopTarget, LOOP_SPRING, dt);
    const loop = loopProgressRef.current;
    edgeFlashRef.current = Math.max(0, edgeFlashRef.current - dt * 1.4);
    hubScaleRef.current = spring(hubScaleRef.current, hubTargetRef.current, HUB_SPRING, dt);

    // Node scales + flashes.
    for (let i = 0; i < NODE_COUNT; i++) {
      const target = smoothstep(ACTIVATION_THRESHOLDS[i] - 0.02, ACTIVATION_THRESHOLDS[i] + 0.02, scrollProgress);
      nodeScaleRef.current[i] = spring(nodeScaleRef.current[i], target, NODE_SPRING, dt);
      nodeFlashRef.current[i] = Math.max(0, nodeFlashRef.current[i] - dt * 2.4);
    }

    // Travels.
    const travels = travelsRef.current;
    const speedScale = 1 + Math.abs(scrollVelocity) * 0.3;
    const travelPhases = new Array<number>(EDGE_COUNT).fill(-1);
    let travelStrength = 0;
    for (let i = travels.length - 1; i >= 0; i--) {
      const travel = travels[i];
      travel.phase += dt * travel.speed * speedScale;
      if (travel.phase > 1.08) {
        travels.splice(i, 1);
        continue;
      }
      if (travel.phase > travelPhases[travel.edge]) {
        travelPhases[travel.edge] = travel.phase;
        travelStrength = Math.max(travelStrength, travel.strength);
      }
    }

    // Node world positions (arc → ring as the loop closes) + drift.
    const positions = nodeWorld.arc.map((arcPos, i) => {
      const ringPos = nodeWorld.ring[i];
      let x = arcPos.x + (ringPos.x - arcPos.x) * loop;
      let y = arcPos.y + (ringPos.y - arcPos.y) * loop;
      if (profile.nodeDrift) {
        x += Math.sin(time * 0.3 + i * 1.7) * 0.004 * s;
        y += Math.cos(time * 0.22 + i * 2.3) * 0.004 * s;
      }
      return new THREE.Vector3(x, y, 0);
    });

    // Edge endpoints + per-edge activity.
    const edgeActive: number[] = [];
    for (let e = 0; e < EDGE_COUNT; e++) {
      const [a, b] = EDGES[e];
      if (e === EDGE_COUNT - 1) {
        edgeActive.push(smoothstep(0.35, 0.85, loop));
      } else {
        const sa = nodeScaleRef.current[a];
        const sb = nodeScaleRef.current[b];
        edgeActive.push(smoothstep(0.25, 0.75, Math.min(sa, sb)));
      }
    }

    const vwKey = `${viewport.width.toFixed(3)}:${viewport.height.toFixed(3)}`;
    // Nodes drift continuously (MEDIUM/HIGH), so edge endpoints follow them
    // every frame — a few hundred floats, cheaper than a visible desync.
    if (profile.nodeDrift || vwKey !== viewportKeyRef.current) {
      viewportKeyRef.current = vwKey;
      updateEdgePositions(positions);
    }

    // Edge uniforms (core + glow pass share the same values).
    const audioLevels = audioActive && profile.audioReactive ? audio : { bass: 0, mid: 0, high: 0 };
    const audioVec = edgeAudioVec;
    audioVec.set(audioLevels.bass, audioLevels.mid, audioLevels.high);
    const edgeValues = {
      time,
      active: edgeActive,
      travel: travelPhases,
      travelStrength,
      flash: edgeFlashRef.current,
      energy: energyRef.current,
      audio: audioVec,
      audioActive: audioActive && profile.audioReactive ? 1 : 0,
    };
    writeEdgeUniforms(edgeMaterial, edgeValues);
    writeEdgeUniforms(edgeGlowMaterial, edgeValues);

    // Node instance matrices + colors.
    const coreMesh = coreMeshRef.current;
    const ringMesh = ringMeshRef.current;
    if (coreMesh && ringMesh) {
      for (let i = 0; i < NODE_COUNT; i++) {
        const scale = Math.max(0.0001, nodeScaleRef.current[i]);
        dummy.position.copy(positions[i]);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        coreMesh.setMatrixAt(i, dummy.matrix);

        dummy.rotation.z = time * (0.25 + i * 0.05);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        ringMesh.setMatrixAt(i, dummy.matrix);

        const activation = nodeScaleRef.current[i];
        color.setRGB(activation, nodeFlashRef.current[i], 0);
        coreMesh.setColorAt(i, color);
        ringMesh.setColorAt(i, color);
      }
      coreMesh.instanceMatrix.needsUpdate = true;
      ringMesh.instanceMatrix.needsUpdate = true;
      if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }

    // Hero EQ column (musical glyph).
    const eqMesh = eqMeshRef.current;
    if (eqMesh && profile.heroEq) {
      for (let i = 0; i < 8; i++) {
        const beat =
          0.5 +
          0.5 * Math.sin(time * 2.3 + i * 0.72) +
          (audioActive ? audio.bass * 1.4 + audio.mid * 0.8 : 0);
        const h = Math.max(0.06, Math.min(1.6, beat));
        dummy.position.set(positions[0].x + coreRadius * 2.6, positions[0].y + (i - 3.5) * 0.011 * s, 0);
        dummy.scale.set(1, h, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        eqMesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.5 + 0.5 * h, 0, 0);
        eqMesh.setColorAt(i, color);
      }
      eqMesh.instanceMatrix.needsUpdate = true;
      if (eqMesh.instanceColor) eqMesh.instanceColor.needsUpdate = true;
    }

    // Hub glyph.
    const hubGroup = hubGroupRef.current;
    if (hubGroup) {
      const hs = Math.max(0.0001, hubScaleRef.current);
      const aspect = viewport.height / viewport.width;
      const verticalShift = aspect > 1.2 ? -0.14 : 0;
      hubGroup.position.set(
        HUB_POSITION.nx * s * 0.5,
        (HUB_POSITION.ny + verticalShift) * s * 0.5 * VERTICAL_SCALE * aspect,
        0,
      );
      hubGroup.scale.setScalar(hs);
      if (hubRingARef.current) hubRingARef.current.rotation.z = time * 0.4;
      if (hubRingBRef.current) hubRingBRef.current.rotation.z = -time * 0.28;
      const hubPulse = 1 + 0.12 * Math.sin(time * 1.6);
      if (hubCoreRef.current) hubCoreRef.current.scale.setScalar(hubPulse);
    }
  });

  // ── Dispose ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      nodeMaterial.dispose();
      edgeMaterial.dispose();
      edgeGlowMaterial.dispose();
      eqMaterial.dispose();
      edgeGeometry.dispose();
    };
  }, [nodeMaterial, edgeMaterial, edgeGlowMaterial, eqMaterial, edgeGeometry]);

  return (
    <group>
      {/* Signal traces (two passes: core trace + soft glow). */}
      <lineSegments ref={edgeLineRef} geometry={edgeGeometry} material={edgeMaterial} renderOrder={1} />
      <lineSegments ref={edgeGlowLineRef} geometry={edgeGeometry} material={edgeGlowMaterial} renderOrder={2} />

      {/* Nodes: cores + orbit rings. */}
      <instancedMesh
        ref={coreMeshRef}
        args={[undefined, undefined, NODE_COUNT]}
        frustumCulled={false}
        renderOrder={3}
      >
        <sphereGeometry args={[coreRadius, 10, 10]} />
        <primitive object={nodeMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh
        ref={ringMeshRef}
        args={[undefined, undefined, NODE_COUNT]}
        frustumCulled={false}
        renderOrder={4}
      >
        <torusGeometry args={[ringRadius, ringTube, 6, 28]} />
        <primitive object={nodeMaterial} attach="material" />
      </instancedMesh>

      {/* Hero EQ column. */}
      {profile.heroEq && (
        <instancedMesh
          ref={eqMeshRef}
          args={[undefined, undefined, 8]}
          frustumCulled={false}
          renderOrder={5}
        >
          <boxGeometry args={[0.0022 * s, 0.012 * s, 0.0022 * s]} />
          <primitive object={eqMaterial} attach="material" />
        </instancedMesh>
      )}

      {/* Conductor hub. */}
      {profile.hubGlyph && (
        <group ref={hubGroupRef} scale={0.0001} renderOrder={6}>
          <mesh ref={hubCoreRef} frustumCulled={false}>
            <sphereGeometry args={[0.014 * s, 16, 16]} />
            <primitive object={nodeMaterial} attach="material" />
          </mesh>
          <mesh ref={hubRingARef} rotation={[Math.PI / 2.6, 0, 0]} frustumCulled={false}>
            <torusGeometry args={[0.032 * s, 0.0018 * s, 8, 40]} />
            <primitive object={nodeMaterial} attach="material" />
          </mesh>
          <mesh ref={hubRingBRef} rotation={[Math.PI / 1.7, 0.4, 0]} frustumCulled={false}>
            <torusGeometry args={[0.046 * s, 0.0012 * s, 8, 48]} />
            <primitive object={nodeMaterial} attach="material" />
          </mesh>
        </group>
      )}
    </group>
  );
}
