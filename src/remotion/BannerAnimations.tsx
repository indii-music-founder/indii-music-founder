import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  staticFile,
} from 'remotion';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const TEAL = '#00E5CC';
const TEAL_END = '#00B8D4';
const DARK = '#0A0A12';
const DARK_INNER = '#0C0C1A';
const TOTAL_FRAMES = 150; // 5s @ 30fps — all animations loop back to frame 0 state

// Screenshot paths in public/brand/
const SCREENSHOTS = [
  staticFile('brand/screenshot-dashboard.png'),
  staticFile('brand/screenshot-agent.png'),
  staticFile('brand/screenshot-creative.png'),
  staticFile('brand/screenshot-distribution.png'),
];

// ─────────────────────────────────────────────────────────────
// Helper: seamless loop easing
// Maps frame to a 0→1→0 curve for seamless looping
// ─────────────────────────────────────────────────────────────
function loopValue(frame: number, total: number, startFraction: number, peakFraction: number): number {
  const startFrame = total * startFraction;
  const peakFrame = total * peakFraction;
  const endFrame = total - startFrame; // mirror

  if (frame < startFrame) return 0;
  if (frame <= peakFrame) {
    return interpolate(frame, [startFrame, peakFrame], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }
  if (frame <= endFrame) return 1;
  return interpolate(frame, [endFrame, total], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
}

// ─────────────────────────────────────────────────────────────
// II Logo
// ─────────────────────────────────────────────────────────────
const IILogo: React.FC<{
  size: number;
  opacity?: number;
  scale?: number;
  glowSize?: number;
}> = ({ size, opacity = 1, scale = 1, glowSize = 0 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    style={{
      opacity,
      transform: `scale(${scale})`,
      filter: glowSize > 0 ? `drop-shadow(0 0 ${glowSize}px ${TEAL}88)` : undefined,
    }}
  >
    <defs>
      <linearGradient id="ban-outer" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={TEAL} />
        <stop offset="100%" stopColor={TEAL_END} />
      </linearGradient>
      <linearGradient id="ban-ii" x1="180" y1="120" x2="340" y2="400" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={TEAL} />
        <stop offset="100%" stopColor={TEAL_END} />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="128" fill="url(#ban-outer)" />
    <rect x="48" y="48" width="416" height="416" rx="96" fill={DARK_INNER} />
    <circle cx="200" cy="155" r="28" fill="url(#ban-ii)" />
    <circle cx="312" cy="155" r="28" fill="url(#ban-ii)" />
    <rect x="174" y="210" width="52" height="160" rx="26" fill="url(#ban-ii)" />
    <rect x="286" y="210" width="52" height="160" rx="26" fill="url(#ban-ii)" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// Brand text
// ─────────────────────────────────────────────────────────────
const BrandText: React.FC<{ opacity: number; y: number }> = ({ opacity, y }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        color: '#FFFFFF',
        fontSize: 72,
        fontWeight: 700,
        letterSpacing: -2,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      }}
    >
      indiiOS
    </div>
    <div
      style={{
        opacity: opacity * 0.9,
        transform: `translateY(${y * 1.2}px)`,
        color: TEAL,
        fontSize: 20,
        fontWeight: 500,
        letterSpacing: 4,
        textTransform: 'uppercase' as const,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      }}
    >
      The Sovereign Creative Engine
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Screenshot card (real app screenshots)
// ─────────────────────────────────────────────────────────────
const ScreenshotCard: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  frame: number;
  total: number;
  enterFraction: number;
  peakFraction: number;
}> = ({ src, x, y, w, h, rotation, opacity, frame, total, enterFraction, peakFraction }) => {
  const vis = loopValue(frame, total, enterFraction, peakFraction) * opacity;

  // Subtle continuous float
  const floatY = Math.sin(frame * 0.04 + x * 0.01) * 5;
  const floatX = Math.cos(frame * 0.03 + y * 0.01) * 3;

  return (
    <div
      style={{
        position: 'absolute',
        left: x + floatX,
        top: y + floatY,
        width: w,
        height: h,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${TEAL}33`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 1px ${TEAL}44`,
        transform: `rotate(${rotation}deg) scale(${0.8 + vis * 0.2})`,
        opacity: vis,
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Vinyl record
// ─────────────────────────────────────────────────────────────
const VinylRecord: React.FC<{
  x: number;
  y: number;
  size: number;
  frame: number;
  total: number;
  enterFraction: number;
  opacity: number;
}> = ({ x, y, size, frame, total, enterFraction, opacity }) => {
  const rot = frame * 0.8; // continuous spin — seamless at any loop point
  const vis = loopValue(frame, total, enterFraction, 0.35) * opacity;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 50% 50%, #333 0%, #111 30%, #222 31%, #0a0a0a 60%, #1a1a1a 61%, #0a0a0a 100%)`,
        transform: `rotate(${rot}deg)`,
        opacity: vis,
        boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.3, height: size * 0.3,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${TEAL}44, ${TEAL}11)`,
          border: `1px solid ${TEAL}33`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8, height: 8,
          borderRadius: '50%',
          background: DARK,
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Equalizer bars (continuous sine — always loops seamlessly)
// ─────────────────────────────────────────────────────────────
const EqualizerBars: React.FC<{
  x: number;
  y: number;
  frame: number;
  total: number;
  enterFraction: number;
  opacity: number;
  barCount?: number;
}> = ({ x, y, frame, total, enterFraction, opacity, barCount = 12 }) => {
  // Use a frequency that completes a whole number of cycles in TOTAL_FRAMES
  // 150 frames / 30fps = 5s. sin with period = 150 frames → freq = 2π/150
  const freq = (2 * Math.PI) / total;
  const vis = loopValue(frame, total, enterFraction, 0.4) * opacity;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        bottom: y,
        display: 'flex',
        gap: 4,
        alignItems: 'flex-end',
        opacity: vis,
      }}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const height = 20 + Math.sin(frame * freq * 3 + i * 0.8) * 15 + Math.cos(frame * freq * 2 + i * 1.2) * 10;
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: Math.max(4, height),
              borderRadius: 3,
              background: `linear-gradient(to top, ${TEAL}44, ${TEAL}88)`,
            }}
          />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Particles (use sine/cosine — inherently loopable)
// ─────────────────────────────────────────────────────────────
const Particles: React.FC<{
  frame: number;
  total: number;
  count?: number;
  opacity?: number;
}> = ({ frame, total, count = 30, opacity = 0.6 }) => {
  const particles = React.useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    };
    const r = rng(42);
    return Array.from({ length: count }).map(() => ({
      x: r() * 100,
      y: r() * 100,
      size: 1 + r() * 3,
      speed: 1 + r() * 3, // whole-number-ish multipliers for loop alignment
      phase: r() * Math.PI * 2,
    }));
  }, [count]);

  const freq = (2 * Math.PI) / total;

  return (
    <>
      {particles.map((p, i) => {
        const px = p.x + Math.sin(frame * freq * p.speed + p.phase) * 3;
        const py = p.y + Math.cos(frame * freq * p.speed + p.phase) * 2;
        const pOpacity = 0.3 + Math.sin(frame * freq * 2 + p.phase) * 0.3;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${px}%`,
              top: `${py}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: TEAL,
              opacity: pOpacity * opacity,
            }}
          />
        );
      })}
    </>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 1: "Cinematic Assembly"
// Screenshots fly in from corners, logo appears center, fade out to loop
// ═════════════════════════════════════════════════════════════
export const BannerCinematic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = TOTAL_FRAMES;

  // Logo: fade in 0.1→0.3, hold, fade out 0.85→1.0
  const logoVis = loopValue(frame, T, 0.1, 0.3);
  const logoScale = spring({ frame: frame - T * 0.1, fps, config: { damping: 12, stiffness: 80 } });

  // Text
  const textVis = loopValue(frame, T, 0.35, 0.5);
  const textY = interpolate(textVis, [0, 1], [30, 0]);

  // Glow — sine-based loop
  const freq = (2 * Math.PI) / T;
  const glowOpacity = 0.3 + Math.sin(frame * freq) * 0.2;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <Particles frame={frame} total={T} opacity={0.4} />

      {/* Center teal glow */}
      <div style={{
        position: 'absolute', width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${TEAL}33 0%, transparent 60%)`,
        opacity: glowOpacity,
      }} />

      {/* Real screenshots flying in from corners */}
      <ScreenshotCard src={SCREENSHOTS[0]} x={-200} y={-120} w={640} h={400} rotation={-12} opacity={0.75} frame={frame} total={T} enterFraction={0.15} peakFraction={0.35} />
      <ScreenshotCard src={SCREENSHOTS[1]} x={500} y={-100} w={700} h={440} rotation={8} opacity={0.65} frame={frame} total={T} enterFraction={0.2} peakFraction={0.4} />
      <ScreenshotCard src={SCREENSHOTS[2]} x={-180} y={450} w={600} h={380} rotation={6} opacity={0.55} frame={frame} total={T} enterFraction={0.25} peakFraction={0.45} />
      <ScreenshotCard src={SCREENSHOTS[3]} x={480} y={420} w={680} h={420} rotation={-10} opacity={0.6} frame={frame} total={T} enterFraction={0.28} peakFraction={0.48} />

      {/* Vinyl records */}
      <VinylRecord x={-100} y={600} size={250} frame={frame} total={T} enterFraction={0.12} opacity={0.4} />
      <VinylRecord x={800} y={-80} size={200} frame={frame} total={T} enterFraction={0.18} opacity={0.35} />

      {/* Center logo and text */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, zIndex: 10 }}>
        <IILogo size={200} opacity={logoVis} scale={Math.min(logoScale, 1)} glowSize={logoVis * 25} />
        <BrandText opacity={textVis} y={textY} />
      </div>

      <EqualizerBars x={750} y={60} frame={frame} total={T} enterFraction={0.3} opacity={0.5} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 2: "Zoom Through"
// Camera zooms through parallax layers — zoom resets smoothly
// ═════════════════════════════════════════════════════════════
export const BannerZoomThrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = TOTAL_FRAMES;

  // Camera zoom: 0.7 → 1.15 → 0.7 (loopable)
  const freq = (2 * Math.PI) / T;
  const cameraZoom = 0.925 + Math.sin(frame * freq - Math.PI / 2) * 0.225;

  const logoVis = loopValue(frame, T, 0.15, 0.35);
  const logoScale = spring({ frame: frame - T * 0.2, fps, config: { damping: 10, stiffness: 60 } });
  const textVis = loopValue(frame, T, 0.4, 0.55);
  const textY = interpolate(textVis, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `scale(${cameraZoom})`, display: 'contents' }}>
        {/* Deep background — records */}
        <VinylRecord x={-150} y={-100} size={400} frame={frame} total={T} enterFraction={0.02} opacity={0.15} />
        <VinylRecord x={700} y={500} size={350} frame={frame} total={T} enterFraction={0.04} opacity={0.12} />

        <Particles frame={frame} total={T} count={40} opacity={0.4} />

        {/* Mid layer — screenshot cards */}
        <ScreenshotCard src={SCREENSHOTS[0]} x={-260} y={-50} w={720} h={450} rotation={-15} opacity={0.55} frame={frame} total={T} enterFraction={0.06} peakFraction={0.3} />
        <ScreenshotCard src={SCREENSHOTS[1]} x={420} y={-40} w={760} h={470} rotation={10} opacity={0.5} frame={frame} total={T} enterFraction={0.1} peakFraction={0.35} />
        <ScreenshotCard src={SCREENSHOTS[2]} x={-220} y={400} w={680} h={420} rotation={8} opacity={0.45} frame={frame} total={T} enterFraction={0.12} peakFraction={0.38} />
        <ScreenshotCard src={SCREENSHOTS[3]} x={400} y={380} w={720} h={450} rotation={-12} opacity={0.45} frame={frame} total={T} enterFraction={0.15} peakFraction={0.4} />

        {/* Center glow */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${TEAL}44 0%, transparent 55%)`,
          opacity: 0.5 + Math.sin(frame * freq) * 0.2,
        }} />

        {/* Logo */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -55%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10,
        }}>
          <IILogo size={220} opacity={logoVis} scale={Math.min(logoScale, 1)} glowSize={20} />
          <BrandText opacity={textVis} y={textY} />
        </div>

        <EqualizerBars x={380} y={40} frame={frame} total={T} enterFraction={0.25} opacity={0.6} barCount={16} />
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 3: "Orbit"
// Screenshots orbit around the central logo — continuous spin
// ═════════════════════════════════════════════════════════════
export const BannerOrbit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = TOTAL_FRAMES;

  const logoVis = loopValue(frame, T, 0.03, 0.2);
  const logoScale = spring({ frame: frame - T * 0.05, fps, config: { damping: 10, stiffness: 70 } });
  const textVis = loopValue(frame, T, 0.35, 0.5);
  const textY = interpolate(textVis, [0, 1], [20, 0]);

  // Orbit angle: exactly one full revolution in T frames for seamless loop
  const orbitAngle = (frame / T) * 360;
  const orbitRadius = 340;

  // 4 orbiting screenshot positions
  const orbitItems = [0, 90, 180, 270].map((offset, i) => {
    const angle = ((orbitAngle + offset) * Math.PI) / 180;
    const ox = Math.cos(angle) * orbitRadius;
    const oy = Math.sin(angle) * orbitRadius * 0.35;
    const zIndex = Math.sin(angle) > 0 ? 5 : 15;
    const itemOpacity = loopValue(frame, T, 0.05 + i * 0.04, 0.2 + i * 0.04);
    const itemScale = 0.7 + Math.sin(angle) * 0.15;

    return { ox, oy, zIndex, itemOpacity, itemScale, angle };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <Particles frame={frame} total={T} count={25} opacity={0.3} />

      {/* Center glow */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${TEAL}22 0%, transparent 60%)`,
        opacity: 0.6,
      }} />

      {/* Orbit ring */}
      <div style={{
        position: 'absolute', width: orbitRadius * 2, height: orbitRadius * 0.7,
        borderRadius: '50%', border: `1px solid ${TEAL}15`,
        opacity: 0.3,
      }} />

      {/* Orbiting screenshots */}
      {orbitItems.map((item, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `calc(50% + ${item.ox}px - 200px)`,
            top: `calc(50% + ${item.oy}px - 130px)`,
            zIndex: item.zIndex,
          }}
        >
          <div
            style={{
              width: 400,
              height: 260,
              borderRadius: 10,
              overflow: 'hidden',
              opacity: item.itemOpacity * 0.8,
              transform: `scale(${item.itemScale})`,
              border: `1px solid ${TEAL}33`,
              boxShadow: `0 8px 30px rgba(0,0,0,0.5)`,
            }}
          >
            <Img
              src={SCREENSHOTS[i]}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      ))}

      {/* Center logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10 }}>
        <IILogo size={180} opacity={logoVis} scale={Math.min(logoScale, 1)} glowSize={20} />
        <BrandText opacity={textVis} y={textY} />
      </div>

      <EqualizerBars x={420} y={80} frame={frame} total={T} enterFraction={0.2} opacity={0.4} barCount={10} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 4: "Glitch Reveal"
// Scan lines and digital distortion — looping scan
// ═════════════════════════════════════════════════════════════
export const BannerGlitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = TOTAL_FRAMES;

  // Scan line loops vertically — exact loop
  const scanY = interpolate(frame % T, [0, T], [-100, 1200]);

  // Glitch offset — sine-based for loopability
  const freq = (2 * Math.PI) / T;
  const glitchX = Math.sin(frame * freq * 7) * (loopValue(frame, T, 0.1, 0.35) > 0.5 ? 8 : 2);
  const glitchFlash = Math.sin(frame * freq * 13) > 0.85;

  const logoVis = loopValue(frame, T, 0.15, 0.4);
  const logoScale = spring({ frame: frame - T * 0.2, fps, config: { damping: 8, stiffness: 100 } });
  const textVis = loopValue(frame, T, 0.45, 0.6);
  const textY = interpolate(textVis, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      {/* Scan lines overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
        background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${TEAL}08 2px, ${TEAL}08 4px)`,
        opacity: 0.5,
      }} />

      {/* Scan beam */}
      <div style={{
        position: 'absolute', left: 0, top: scanY, width: '100%', height: 3,
        background: `linear-gradient(90deg, transparent 0%, ${TEAL}88 50%, transparent 100%)`,
        boxShadow: `0 0 30px ${TEAL}44, 0 0 60px ${TEAL}22`,
        zIndex: 25,
      }} />

      <div style={{ transform: `translateX(${glitchX}px)`, display: 'contents' }}>
        <Particles frame={frame} total={T} count={20} opacity={0.3} />

        {/* Screenshot cards with glitch appearance */}
        <ScreenshotCard src={SCREENSHOTS[0]} x={-180} y={-100} w={600} h={370} rotation={-10} opacity={0.55} frame={frame} total={T} enterFraction={0.1} peakFraction={0.35} />
        <ScreenshotCard src={SCREENSHOTS[1]} x={480} y={-60} w={640} h={400} rotation={7} opacity={0.5} frame={frame} total={T} enterFraction={0.15} peakFraction={0.4} />
        <ScreenshotCard src={SCREENSHOTS[2]} x={-160} y={420} w={560} h={350} rotation={5} opacity={0.45} frame={frame} total={T} enterFraction={0.18} peakFraction={0.42} />
        <ScreenshotCard src={SCREENSHOTS[3]} x={460} y={400} w={620} h={380} rotation={-8} opacity={0.45} frame={frame} total={T} enterFraction={0.2} peakFraction={0.45} />

        <VinylRecord x={-120} y={580} size={220} frame={frame} total={T} enterFraction={0.08} opacity={0.3} />
        <VinylRecord x={780} y={-60} size={180} frame={frame} total={T} enterFraction={0.12} opacity={0.25} />
      </div>

      {/* Glitch flash */}
      {glitchFlash && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `${TEAL}08`,
          zIndex: 15,
        }} />
      )}

      {/* Center content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10, transform: `translateX(${glitchX * 0.5}px)` }}>
        <IILogo size={200} opacity={logoVis} scale={Math.min(logoScale, 1)} glowSize={15} />
        <BrandText opacity={textVis} y={textY} />
      </div>

      <EqualizerBars x={700} y={50} frame={frame} total={T} enterFraction={0.25} opacity={0.5} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 5: "Pulse Wave"
// Concentric pulse rings — looping radial waves
// ═════════════════════════════════════════════════════════════
export const BannerPulse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = TOTAL_FRAMES;

  const logoVis = loopValue(frame, T, 0.02, 0.15);
  const logoScale = spring({ frame: frame - T * 0.03, fps, config: { damping: 8, stiffness: 90, mass: 0.6 } });
  const textVis = loopValue(frame, T, 0.35, 0.5);
  const textY = interpolate(textVis, [0, 1], [25, 0]);

  // Pulse rings — continuous loop with staggered phases
  const freq = (2 * Math.PI) / T;
  const pulseRings = [0, 0.25, 0.5, 0.75].map((phase, i) => {
    const t = (frame * freq + phase * 2 * Math.PI) % (2 * Math.PI);
    const ringScale = 0.3 + (t / (2 * Math.PI)) * 2.7;
    const ringOpacity = Math.sin(t) * 0.5;
    const color = i % 2 === 0 ? TEAL : TEAL_END;
    return { ringScale, ringOpacity: Math.max(0, ringOpacity), color };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <Particles frame={frame} total={T} count={35} opacity={0.4} />

      {/* Pulse rings */}
      {pulseRings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 200, height: 200,
            borderRadius: 60,
            border: `2px solid ${ring.color}`,
            transform: `scale(${ring.ringScale})`,
            opacity: ring.ringOpacity,
          }}
        />
      ))}

      {/* Screenshot cards appearing on pulse waves */}
      <ScreenshotCard src={SCREENSHOTS[0]} x={-220} y={-100} w={680} h={420} rotation={-12} opacity={0.6} frame={frame} total={T} enterFraction={0.1} peakFraction={0.35} />
      <ScreenshotCard src={SCREENSHOTS[1]} x={460} y={-80} w={720} h={440} rotation={9} opacity={0.55} frame={frame} total={T} enterFraction={0.15} peakFraction={0.4} />
      <ScreenshotCard src={SCREENSHOTS[2]} x={-190} y={400} w={640} h={400} rotation={7} opacity={0.5} frame={frame} total={T} enterFraction={0.18} peakFraction={0.43} />
      <ScreenshotCard src={SCREENSHOTS[3]} x={440} y={380} w={700} h={430} rotation={-11} opacity={0.45} frame={frame} total={T} enterFraction={0.22} peakFraction={0.47} />

      <VinylRecord x={-130} y={560} size={240} frame={frame} total={T} enterFraction={0.08} opacity={0.35} />
      <VinylRecord x={790} y={-70} size={200} frame={frame} total={T} enterFraction={0.12} opacity={0.3} />

      {/* Center logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10 }}>
        <IILogo size={200} opacity={logoVis} scale={Math.min(logoScale, 1)} glowSize={logoVis * 30} />
        <BrandText opacity={textVis} y={textY} />
      </div>

      <EqualizerBars x={400} y={50} frame={frame} total={T} enterFraction={0.2} opacity={0.5} barCount={14} />
    </AbsoluteFill>
  );
};
