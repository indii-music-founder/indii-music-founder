import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { QualityTier } from '../../three/quality';

export interface PassportSingularityCanvasProps {
  /** Quality tier detected cleanly without blocking initial bundle */
  tier: QualityTier;
  /** Paused by user WCAG 2.2.2 control or reduced motion */
  paused: boolean;
  /** True when hovered/focused on "Find my next steps" CTA */
  pullActive: boolean;
  /** True during the ~280ms event-horizon plunge transition */
  warping: boolean;
  /** 0 = Discovery Hero (full cosmic impact), 1..6 = Wizard/Report (calm ambient horizon) */
  step: number;
  /** Normalized viewport anchor (0..1, 0..1) of the primary CTA center */
  focalPoint: { x: number; y: number };
}

const ACCRETION_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ACCRETION_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform vec2 uPointer;
  uniform float uPull;
  uniform float uWarp;
  uniform float uIntensity;
  uniform float uDetail;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p, float octaves) {
    float v = 0.0;
    float a = 0.52;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      if (float(i) >= octaves) break;
      v += a * noise(p);
      p = rot * p * 2.04 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    // Shift UV so center sits right behind the "Find my next steps" CTA aperture
    vec2 centerUv = vec2(uCenter.x, 1.0 - uCenter.y);
    vec2 p = (vUv - centerUv) * vec2(aspect, 1.0);

    // Subtle cursor gravitational sway
    vec2 pointerDelta = uPointer * 0.045;
    p -= pointerDelta * (1.0 - smoothstep(0.0, 0.9, length(p)));

    // Warp inward compression on CTA engage
    float scale = 1.0 - uWarp * 0.28 - uPull * 0.06;
    p *= scale;

    float r = length(p);
    float angle = atan(p.y, p.x);

    // Match the ~-13deg equatorial disk tilt so WebGL plasma aligns with horizon plane
    float cTilt = 0.974;
    float sTilt = 0.225;
    vec2 tilted = vec2(p.x * cTilt + p.y * sTilt, -p.x * sTilt + p.y * cTilt);
    vec2 diskCoord = vec2(tilted.x * 0.92, tilted.y * 3.15);
    float diskR = length(diskCoord);

    // Smooth C-infinity vertical curve avoids any horizontal seam across the core
    float smoothY = sqrt(tilted.y * tilted.y + 0.0028);
    float lensWarp = 0.055 / (r + 0.075);
    vec2 lensedCoord = vec2(tilted.x, smoothY - lensWarp * 0.36);
    float lensR = length(vec2(lensedCoord.x * 0.96, lensedCoord.y * 1.18));

    // Inner event horizon shadow void framing the centered CTA
    float horizonRadius = 0.168 - uPull * 0.016 - uWarp * 0.032;
    float eventHorizon = smoothstep(horizonRadius, horizonRadius + 0.018, r);

    // Sculptural razor-thin photon ring (no blown-out glare)
    float photonRing = exp(-pow((r - (horizonRadius + 0.014)) * 52.0, 2.0));
    float innerHalo = exp(-pow((r - (horizonRadius + 0.042)) * 20.0, 2.0)) * (0.42 + uPull * 0.42);

    // Swirling Keplerian disk turbulence
    float swirlSpeed = uTime * (0.44 + uPull * 0.8 + uWarp * 1.9);
    float twist = angle + 2.9 / (diskR + 0.18) - swirlSpeed;
    float radialBands = sin(diskR * 28.0 - swirlSpeed * 2.1) * 0.5 + 0.5;
    float plasma = fbm(vec2(twist * 1.45, diskR * 5.2 - swirlSpeed * 0.5), uDetail);
    float plasmaFine = fbm(vec2(twist * 2.6 + 4.1, diskR * 9.5 - swirlSpeed * 0.9), uDetail);

    // Disk density mask
    float diskEnvelope = smoothstep(0.14, 0.26, diskR) * exp(-max(diskR - 0.21, 0.0) * 2.6);
    float lensEnvelope = smoothstep(0.155, 0.22, lensR) * exp(-max(lensR - 0.2, 0.0) * 5.2);
    float totalDisk = max(diskEnvelope * (0.42 + 0.68 * plasma), lensEnvelope * (0.28 + 0.45 * plasmaFine));

    // Relativistic Doppler beaming (approaching rim shines warmer)
    float doppler = 0.78 + 0.34 * cos(angle + 0.45);

    // Color palette: Obsidian -> Copper Ember -> Champagne Gold -> White Hot -> Electric Cyan edge
    vec3 colWhiteHot = vec3(1.0, 0.95, 0.84);
    vec3 colGold = vec3(1.0, 0.722, 0.0);     // #FFB800
    vec3 colEmber = vec3(0.902, 0.318, 0.0);  // #E65100
    vec3 colCyan = vec3(0.0, 0.941, 1.0);     // #00F0FF
    vec3 colPink = vec3(0.996, 0.180, 0.604); // #FE2E9A

    vec3 diskColor = mix(colEmber, colGold, clamp(plasma * 1.25 + radialBands * 0.22, 0.0, 1.0));
    diskColor = mix(diskColor, colWhiteHot, smoothstep(0.72, 0.99, photonRing * 0.85 + plasmaFine * 0.32));

    // Faint cyan/magenta high-energy ionization outer rim
    float outerRim = smoothstep(0.32, 0.64, diskR) * exp(-max(diskR - 0.42, 0.0) * 2.3);
    diskColor += colCyan * outerRim * (0.18 + 0.14 * plasmaFine);
    diskColor += colPink * outerRim * 0.07 * (1.0 - plasma);

    vec3 finalColor = vec3(0.0);
    finalColor += diskColor * totalDisk * doppler * (0.85 + uPull * 0.48 + uWarp * 0.85);
    finalColor += mix(colGold, colWhiteHot, 0.55) * photonRing * (0.78 + uPull * 0.65);
    finalColor += colGold * innerHalo * 0.45;

    // Mask event horizon shadow cleanly so hero copy & CTA inside aperture stay crisp
    finalColor *= mix(0.03, 1.0, eventHorizon);
    // Keep outer corners pitch black so DOM framing melts naturally into #000000
    float outerFade = 1.0 - smoothstep(0.54, 1.22, r);
    finalColor *= outerFade * uIntensity;

    float alpha = clamp((totalDisk * 0.88 + photonRing * 0.68 + innerHalo * 0.38) * outerFade * uIntensity, 0.0, 0.95);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const PARTICLES_VERTEX = /* glsl */ `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aColorMix;
  attribute float aTilt;

  varying float vAlpha;
  varying float vColorMix;

  uniform float uTime;
  uniform float uPull;
  uniform float uWarp;
  uniform vec2 uCenterNdc;
  uniform vec2 uPointer;
  uniform float uAspect;
  uniform float uIntensity;
  uniform float uDpr;

  void main() {
    float span = 5.4;
    float baseSpeed = 0.20 + uPull * 0.85 + uWarp * 2.1;
    // Particles continuously spiral from outer perimeter into the horizon void
    float flow = mod(aRadius - uTime * baseSpeed, span) + 0.48;
    float normR = clamp((flow - 0.48) / span, 0.0, 1.0);

    // Keplerian angular acceleration near horizon
    float omega = aSpeed * (1.0 + 1.45 / (flow * flow + 0.15)) * (1.0 + uPull * 0.55);
    float theta = aAngle + uTime * omega;

    // Funnel depth pulls closer as radius shrinks
    float funnelY = -pow(1.0 - normR, 2.2) * (0.4 + uPull * 0.35);

    vec3 pos;
    pos.x = cos(theta) * flow * 1.15;
    pos.y = sin(theta) * flow * (0.58 + aTilt * 0.18) + funnelY * 0.15;
    pos.z = sin(theta + 1.1) * flow * 0.25 - (1.0 - normR) * (1.15 + uWarp * 1.4);

    // Subtle pointer attraction in outer halo
    pos.xy += uPointer * 0.16 * normR;

    // Project relative to the CTA focal anchor in clip space
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_Position.xy += uCenterNdc * gl_Position.w;

    float horizonFade = smoothstep(0.48, 0.72, flow);
    float outerFade = 1.0 - smoothstep(4.2, 5.8, flow);
    vAlpha = horizonFade * outerFade * uIntensity * (0.55 + uPull * 0.35);
    vColorMix = aColorMix;

    float sizeScale = aSize * uDpr * (1.0 + (1.0 - normR) * 0.65 + uWarp * 0.8);
    gl_PointSize = clamp(sizeScale * (3.2 / max(-mvPos.z, 1.0)), 1.5, 16.0);
  }
`;

const PARTICLES_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying float vColorMix;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 16.0);
    vec3 gold = vec3(1.0, 0.74, 0.08);
    vec3 cyan = vec3(0.0, 0.94, 1.0);
    vec3 ember = vec3(0.95, 0.38, 0.05);
    vec3 white = vec3(1.0, 0.97, 0.9);

    vec3 col = gold;
    if (vColorMix > 0.78) col = white;
    else if (vColorMix > 0.56) col = cyan;
    else if (vColorMix > 0.35) col = ember;

    gl_FragColor = vec4(col * core, core * vAlpha);
  }
`;

export default function PassportSingularityCanvas({
  tier,
  paused,
  pullActive,
  warping,
  step,
  focalPoint,
}: PassportSingularityCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Mutable animation state read inside requestAnimationFrame (zero React re-renders)
  const stateRef = useRef({
    paused,
    pullActive,
    warping,
    step,
    focalPoint,
    pointer: { x: 0, y: 0 },
    targetPointer: { x: 0, y: 0 },
    offscreen: false,
    docHidden: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
    smoothPull: 0,
    smoothWarp: 0,
    smoothIntensity: step === 0 ? 1 : 0.28,
    smoothCenter: { x: focalPoint.x, y: focalPoint.y },
  });

  useEffect(() => {
    stateRef.current.paused = paused;
    stateRef.current.pullActive = pullActive;
    stateRef.current.warping = warping;
    stateRef.current.step = step;
    stateRef.current.focalPoint = focalPoint;
  }, [paused, pullActive, warping, step, focalPoint]);

  useEffect(() => {
    if (tier === 'FALLBACK' || webglFailed) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: tier === 'HIGH',
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const dprMax = tier === 'HIGH' ? 2 : tier === 'MEDIUM' ? 1.5 : 1;
    const particleCount = tier === 'HIGH' ? 3200 : tier === 'MEDIUM' ? 1800 : 900;
    const detailOctaves = tier === 'HIGH' ? 4 : tier === 'MEDIUM' ? 3 : 2;

    const getDpr = () => Math.min(window.devicePixelRatio || 1, dprMax);
    renderer.setPixelRatio(getDpr());
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      50,
    );
    camera.position.set(0, 0.25, 6.2);

    // 1. Relativistic Accretion Disk Quad (clipped behind foreground particles)
    const initialFocal = stateRef.current.focalPoint;
    const initialStep = stateRef.current.step;
    const diskUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight) },
      uCenter: { value: new THREE.Vector2(initialFocal.x, initialFocal.y) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPull: { value: 0 },
      uWarp: { value: 0 },
      uIntensity: { value: initialStep === 0 ? 1 : 0.28 },
      uDetail: { value: detailOctaves },
    };

    const diskGeometry = new THREE.PlaneGeometry(2, 2);
    const diskMaterial = new THREE.ShaderMaterial({
      vertexShader: ACCRETION_VERTEX,
      fragmentShader: ACCRETION_FRAGMENT,
      uniforms: diskUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const diskMesh = new THREE.Mesh(diskGeometry, diskMaterial);
    diskMesh.frustumCulled = false;
    diskMesh.renderOrder = 0;
    scene.add(diskMesh);

    // 2. 3,200 Gravitational Telemetry Particles spiraling toward CTA singularity
    const radii = new Float32Array(particleCount);
    const angles = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const colorMix = new Float32Array(particleCount);
    const tilts = new Float32Array(particleCount);
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Cluster into 3 spiral arms + ambient halo
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const r = 0.5 + Math.pow(Math.random(), 0.72) * 5.3;
      radii[i] = r;
      angles[i] = arm + r * 0.55 + (Math.random() - 0.5) * 1.45;
      speeds[i] = 0.24 + Math.random() * 0.34;
      sizes[i] = 2.0 + Math.random() * 5.5;
      colorMix[i] = Math.random();
      tilts[i] = (Math.random() - 0.5) * 0.9;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    particleGeo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    particleGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    particleGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    particleGeo.setAttribute('aColorMix', new THREE.BufferAttribute(colorMix, 1));
    particleGeo.setAttribute('aTilt', new THREE.BufferAttribute(tilts, 1));

    const particleUniforms = {
      uTime: { value: 0 },
      uPull: { value: 0 },
      uWarp: { value: 0 },
      uCenterNdc: { value: new THREE.Vector2((initialFocal.x - 0.5) * 2, (0.5 - initialFocal.y) * 2) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: camera.aspect },
      uIntensity: { value: initialStep === 0 ? 1 : 0.28 },
      uDpr: { value: getDpr() },
    };

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLES_VERTEX,
      fragmentShader: PARTICLES_FRAGMENT,
      uniforms: particleUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(particleGeo, particleMaterial);
    points.frustumCulled = false;
    points.renderOrder = 1;
    scene.add(points);

    // 3. Three Sculpted Orbital Rings surrounding the CTA aperture
    const ringGroup = new THREE.Group();
    const ringSpecs = [
      { radius: 1.55, tube: 0.0055, color: 0xffb800, opacity: 0.32, tiltX: 1.15, tiltY: 0.22 },
      { radius: 2.15, tube: 0.004, color: 0x00f0ff, opacity: 0.2, tiltX: 1.32, tiltY: -0.28 },
      { radius: 2.85, tube: 0.0035, color: 0xffb800, opacity: 0.16, tiltX: 0.96, tiltY: 0.15 },
    ];
    const ringDisposables: Array<{ geo: THREE.TorusGeometry; mat: THREE.MeshBasicMaterial }> = [];

    if (tier !== 'LOW') {
      ringSpecs.forEach((spec) => {
        const geo = new THREE.TorusGeometry(spec.radius, spec.tube, 6, 128);
        const mat = new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: spec.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.set(spec.tiltX, spec.tiltY, 0);
        ringGroup.add(mesh);
        ringDisposables.push({ geo, mat });
      });
      scene.add(ringGroup);
    }

    // Event listeners: pointer, resize, visibility, content-visibility-auto
    const onPointerMove = (e: PointerEvent) => {
      const x = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const y = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
      stateRef.current.targetPointer = { x, y };
    };

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      const dpr = getDpr();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      diskUniforms.uResolution.value.set(w, h);
      particleUniforms.uAspect.value = camera.aspect;
      particleUniforms.uDpr.value = dpr;
    };

    let rafId = 0;
    let lastNow = performance.now();
    let elapsed = 0;

    const shouldRun = () =>
      !stateRef.current.paused &&
      !stateRef.current.offscreen &&
      !stateRef.current.docHidden;

    const tick = (now: number) => {
      rafId = 0;
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      const s = stateRef.current;

      elapsed += dt * (1 + s.smoothPull * 0.75 + s.smoothWarp * 1.9);

      // Smooth interpolation (no abrupt jumps on hover/focus)
      const lerp = 1 - Math.exp(-dt * 5.5);
      s.smoothPull += ((s.pullActive ? 1 : 0) - s.smoothPull) * lerp;
      s.smoothWarp += ((s.warping ? 1 : 0) - s.smoothWarp) * (1 - Math.exp(-dt * 9.0));
      const targetIntensity = s.step === 0 ? 1.0 : 0.28;
      s.smoothIntensity += (targetIntensity - s.smoothIntensity) * lerp;
      s.smoothCenter.x += (s.focalPoint.x - s.smoothCenter.x) * lerp;
      s.smoothCenter.y += (s.focalPoint.y - s.smoothCenter.y) * lerp;
      s.pointer.x += (s.targetPointer.x - s.pointer.x) * lerp;
      s.pointer.y += (s.targetPointer.y - s.pointer.y) * lerp;

      diskUniforms.uTime.value = elapsed;
      diskUniforms.uPull.value = s.smoothPull;
      diskUniforms.uWarp.value = s.smoothWarp;
      diskUniforms.uIntensity.value = s.smoothIntensity;
      diskUniforms.uPointer.value.set(s.pointer.x, s.pointer.y);
      diskUniforms.uCenter.value.set(s.smoothCenter.x, s.smoothCenter.y);

      const ndcX = (s.smoothCenter.x - 0.5) * 2.0;
      const ndcY = (0.5 - s.smoothCenter.y) * 2.0;
      particleUniforms.uTime.value = elapsed;
      particleUniforms.uPull.value = s.smoothPull;
      particleUniforms.uWarp.value = s.smoothWarp;
      particleUniforms.uIntensity.value = s.smoothIntensity;
      particleUniforms.uPointer.value.set(s.pointer.x, s.pointer.y);
      particleUniforms.uCenterNdc.value.set(ndcX, ndcY);

      if (ringGroup.children.length > 0) {
        const worldAnchorX = ndcX * camera.aspect * 2.65;
        const worldAnchorY = ndcY * 2.65;
        ringGroup.position.set(worldAnchorX, worldAnchorY, 0);
        const ringScale = (1 - s.smoothPull * 0.24 - s.smoothWarp * 0.42) * (s.step === 0 ? 1 : 0.8);
        ringGroup.scale.setScalar(ringScale);
        ringGroup.rotation.z = elapsed * 0.14;
        ringGroup.rotation.y = s.pointer.x * 0.18;
        ringGroup.rotation.x = -s.pointer.y * 0.12;
        ringDisposables.forEach((item, idx) => {
          item.mat.opacity =
            ringSpecs[idx].opacity * s.smoothIntensity * (1 + s.smoothPull * 0.65);
        });
      }

      renderer.render(scene, camera);

      if (shouldRun()) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const ensureLoop = () => {
      if (!rafId && shouldRun()) {
        lastNow = performance.now();
        rafId = window.requestAnimationFrame(tick);
      } else if (paused || stateRef.current.offscreen || stateRef.current.docHidden) {
        // Render one crisp static frame at current pose when paused
        renderer.render(scene, camera);
      }
    };

    const onVisibilityChange = () => {
      stateRef.current.docHidden = document.visibilityState === 'hidden';
      if (stateRef.current.docHidden && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else {
        ensureLoop();
      }
    };

    // Content-visibility lifecycle pause (with IntersectionObserver fallback)
    const onContentVisibilityChange = (event: Event) => {
      const skipped = Boolean((event as Event & { skipped?: boolean }).skipped);
      stateRef.current.offscreen = skipped;
      if (skipped && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!skipped) {
        ensureLoop();
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      setWebglFailed(true);
    };

    let io: IntersectionObserver | null = null;
    if (!('contentVisibility' in document.documentElement.style) && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const isVisible = entries.some((entry) => entry.isIntersecting);
          stateRef.current.offscreen = !isVisible;
          if (!isVisible && rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          } else if (isVisible) {
            ensureLoop();
          }
        },
        { rootMargin: '150px' },
      );
      io.observe(container);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    container.addEventListener('contentvisibilityautostatechange', onContentVisibilityChange);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    ensureLoop();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      io?.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      container.removeEventListener('contentvisibilityautostatechange', onContentVisibilityChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      diskGeometry.dispose();
      diskMaterial.dispose();
      particleGeo.dispose();
      particleMaterial.dispose();
      ringDisposables.forEach((d) => {
        d.geo.dispose();
        d.mat.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [tier, webglFailed, paused]); // Re-evaluates cleanly when paused changes so single frozen frame renders

  if (tier === 'FALLBACK' || webglFailed) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 [content-visibility:auto] [contain-intrinsic-size:auto_none_auto_600px]"
    />
  );
}
