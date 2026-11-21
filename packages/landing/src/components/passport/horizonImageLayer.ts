import * as THREE from 'three';

/**
 * Brings the Passport backdrop photograph to life inside the existing WebGL
 * context (no second canvas).
 *
 * The still image is redrawn as a full-screen quad that matches the DOM
 * backdrop exactly (object-cover framing, radial vignette, step opacity), then:
 *  - the accretion disk orbits its black hole with Keplerian shear (inner
 *    streaks move faster than outer ones), using a two-phase flow map so the
 *    texture never winds up into a smear;
 *  - a faint band of light travels around the photon ring;
 *  - the whole image breathes very slowly and drifts against the cursor for depth.
 *
 * The hole, the lensed ring arcs above/below it and the starfield stay still,
 * so the photograph keeps its composition. The DOM <img> underneath remains the
 * LCP element and the fallback; this layer fades in over it once the texture
 * is ready, so there is no visible swap.
 */

export const HORIZON_IMAGE_SRC = '/images/passport-singularity.jpg';

/**
 * Geometry of the black hole in `passport-singularity.jpg` (1376x768), measured
 * from the file: hole centroid of near-black pixels and the principal axis of
 * the bright disk. Re-measure if the image is replaced.
 */
const IMAGE_GEOMETRY = {
  hole: [0.4939, 0.4287] as const, // image UV, y down
  tiltRad: -0.2217, // disk major axis, -12.7deg (rises to the right)
  flatten: 0.3, // apparent minor/major ratio of the disk plane
  innerRadiusPx: 240, // reference radius where the orbit runs at base speed
  ringRadiusPx: 100, // photon ring, just outside the 79px hole
};

/** Radians a streak at the inner reference radius travels per flow period. */
const FLOW_AMPLITUDE = 0.18;
const FLOW_PERIOD_SECONDS = 5;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uImage;
  uniform vec2 uImageSize;
  uniform vec2 uResolution;
  uniform float uFlowTime;
  uniform float uShimmerTime;
  uniform float uZoom;
  uniform vec2 uParallax;
  uniform float uBackdrop;
  uniform float uReveal;

  const vec2 HOLE = vec2(${IMAGE_GEOMETRY.hole[0]}, ${IMAGE_GEOMETRY.hole[1]});
  const float TILT = ${IMAGE_GEOMETRY.tiltRad};
  const float FLATTEN = ${IMAGE_GEOMETRY.flatten};
  const float R0 = ${IMAGE_GEOMETRY.innerRadiusPx.toFixed(1)};
  const float RING_R = ${IMAGE_GEOMETRY.ringRadiusPx.toFixed(1)};
  const float AMP = ${FLOW_AMPLITUDE};
  const float PERIOD = ${FLOW_PERIOD_SECONDS.toFixed(1)};

  vec2 rotate2(vec2 v, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  // Screen UV (y down) -> image UV (y down), matching CSS object-fit: cover.
  vec2 coverUv(vec2 uv) {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    float imageAspect = uImageSize.x / uImageSize.y;
    vec2 c = uv - 0.5;
    if (screenAspect > imageAspect) c.y *= imageAspect / screenAspect;
    else c.x *= screenAspect / imageAspect;
    return c / uZoom + 0.5 + uParallax;
  }

  // Move an image point along its orbit in the tilted, foreshortened disk plane.
  vec2 orbit(vec2 p, float angle) {
    vec2 q = rotate2(p, -TILT);
    vec2 d = vec2(q.x, q.y / FLATTEN);
    float r = length(d);
    float keplerian = pow(R0 / max(r, R0 * 0.55), 1.5);
    vec2 d2 = rotate2(d, angle * keplerian);
    return rotate2(vec2(d2.x, d2.y * FLATTEN), TILT);
  }

  vec3 sampleImage(vec2 uvImg) {
    return texture2D(uImage, vec2(uvImg.x, 1.0 - uvImg.y)).rgb;
  }

  void main() {
    vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);
    vec2 uvImg = coverUv(screenUv);
    vec2 p = (uvImg - HOLE) * uImageSize;

    // Only the disk band moves: thin near the hole, wider toward the tips.
    vec2 q = rotate2(p, -TILT);
    float halfThickness = mix(42.0, 96.0, smoothstep(150.0, 620.0, abs(q.x)));
    float band = 1.0 - smoothstep(halfThickness * 0.7, halfThickness * 1.3, abs(q.y));
    float clearOfHole = smoothstep(RING_R * 0.9, RING_R * 1.5, length(p));
    float motion = band * clearOfHole;

    // Two-phase flow map: each layer drifts for one period, then hands off.
    float t = uFlowTime / PERIOD;
    float ph1 = fract(t);
    float ph2 = fract(t + 0.5);
    float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
    vec2 p1 = orbit(p, AMP * (ph1 - 0.5) * motion);
    vec2 p2 = orbit(p, AMP * (ph2 - 0.5) * motion);
    vec3 col = sampleImage(HOLE + p1 / uImageSize) * w1
             + sampleImage(HOLE + p2 / uImageSize) * (1.0 - w1);

    // Light travelling around the photon ring.
    float ring = exp(-pow((length(p) - RING_R) / 26.0, 2.0));
    float around = atan(p.y, p.x);
    col *= 1.0 + ring * 0.09 * sin(around * 2.0 - uShimmerTime * 0.7);

    // Match the DOM backdrop: radial-gradient(circle at 50% 52%, .45 -> .68 @42% -> 1 @82%).
    vec2 fragPx = screenUv * uResolution;
    vec2 center = vec2(0.5, 0.52) * uResolution;
    float farthest = length(max(center, uResolution - center));
    float dist = length(fragPx - center) / farthest;
    float shade = dist < 0.42
      ? mix(0.45, 0.68, dist / 0.42)
      : mix(0.68, 1.0, clamp((dist - 0.42) / 0.40, 0.0, 1.0));
    col *= (1.0 - shade) * uBackdrop;

    gl_FragColor = vec4(col, uReveal);
  }
`;

export interface HorizonImageFrame {
  /** Seconds since the last frame. */
  dt: number;
  /** Orbit speed multiplier (1 = resting). */
  speed: number;
  /** Smoothed CTA pull (0..1). */
  pull: number;
  /** Smoothed warp incl. step pulses (0..1). */
  warp: number;
  /** Smoothed pointer (-1..1, y up). */
  pointer: { x: number; y: number };
  /** Target backdrop opacity for the current step. */
  backdrop: number;
}

export interface HorizonImageLayer {
  mesh: THREE.Mesh;
  /** True once the texture is on the GPU. */
  isReady: () => boolean;
  setResolution: (width: number, height: number) => void;
  /** Advance the animation by one frame. */
  update: (frame: HorizonImageFrame) => void;
  /** Show the finished image immediately (used when motion is paused). */
  showStatic: () => void;
  dispose: () => void;
}

export function createHorizonImageLayer(options: {
  width: number;
  height: number;
  initialBackdrop: number;
  onReady: () => void;
}): HorizonImageLayer {
  const uniforms = {
    uImage: { value: null as THREE.Texture | null },
    uImageSize: { value: new THREE.Vector2(1376, 768) },
    uResolution: { value: new THREE.Vector2(options.width, options.height) },
    uFlowTime: { value: 0 },
    uShimmerTime: { value: 0 },
    uZoom: { value: 1 },
    uParallax: { value: new THREE.Vector2(0, 0) },
    uBackdrop: { value: options.initialBackdrop },
    uReveal: { value: 0 },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.visible = false;

  let ready = false;
  let disposed = false;
  let revealElapsed = 0;
  let clock = 0;
  let texture: THREE.Texture | null = null;

  new THREE.TextureLoader().load(
    HORIZON_IMAGE_SRC,
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.minFilter = THREE.LinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      loaded.generateMipmaps = false;
      loaded.wrapS = THREE.ClampToEdgeWrapping;
      loaded.wrapT = THREE.ClampToEdgeWrapping;
      const image = loaded.image as { width?: number; height?: number } | undefined;
      if (image?.width && image?.height) uniforms.uImageSize.value.set(image.width, image.height);
      texture = loaded;
      uniforms.uImage.value = loaded;
      mesh.visible = true;
      ready = true;
      options.onReady();
    },
    undefined,
    () => {
      // Texture failed: the DOM <img> stays as the backdrop. Nothing else to do.
    },
  );

  return {
    mesh,
    isReady: () => ready,
    setResolution: (width, height) => uniforms.uResolution.value.set(width, height),
    update: ({ dt, speed, pull, warp, pointer, backdrop }) => {
      if (!ready) return;
      clock += dt;
      uniforms.uFlowTime.value += dt * speed;
      uniforms.uShimmerTime.value += dt * (1 + pull * 0.8 + warp * 2.0);
      // Slow 14s breath, the CTA pull's 6% lean-in, and a small plunge on warp.
      uniforms.uZoom.value = 1 + 0.008 * Math.sin((clock * Math.PI * 2) / 14) + pull * 0.06 + warp * 0.035;
      // Drift against the cursor; the plasma above drifts with it, so they part slightly.
      uniforms.uParallax.value.set(pointer.x * 0.006, -pointer.y * 0.006);
      uniforms.uBackdrop.value += (backdrop - uniforms.uBackdrop.value) * (1 - Math.exp(-dt * 4.3));
      revealElapsed += dt;
      const r = Math.min(1, revealElapsed / 1.2);
      uniforms.uReveal.value = r * r * (3 - 2 * r);
    },
    showStatic: () => {
      if (!ready) return;
      uniforms.uReveal.value = 1;
    },
    dispose: () => {
      disposed = true;
      geometry.dispose();
      material.dispose();
      texture?.dispose();
    },
  };
}
