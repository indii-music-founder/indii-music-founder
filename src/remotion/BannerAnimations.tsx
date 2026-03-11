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
// Shared constants
// ─────────────────────────────────────────────────────────────
const TEAL = '#00E5CC';
const TEAL_END = '#00B8D4';
const DARK = '#0A0A12';
const DARK_INNER = '#0C0C1A';

// ─────────────────────────────────────────────────────────────
// Shared logo component
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
// Shared text component
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
// Floating dashboard card
// ─────────────────────────────────────────────────────────────
const DashCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  delay: number;
  frame: number;
  fps: number;
}> = ({ x, y, w, h, rotation, opacity, delay, frame, fps }) => {
  const cardScale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 60, mass: 0.7 },
  });
  const cardOpacity = interpolate(frame, [delay, delay + 15], [0, opacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtle float animation
  const floatY = Math.sin((frame - delay) * 0.05) * 4;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + floatY,
        width: w,
        height: h,
        borderRadius: 12,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16162a 100%)',
        border: `1px solid ${TEAL}22`,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px ${TEAL}44`,
        transform: `scale(${cardScale}) rotate(${rotation}deg)`,
        opacity: cardOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Simulated dashboard content */}
      <div style={{ padding: 12 }}>
        <div style={{ width: '60%', height: 8, background: '#ffffff22', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: '80%', height: 6, background: '#ffffff11', borderRadius: 3, marginBottom: 6 }} />
        <div style={{ width: '45%', height: 6, background: '#ffffff11', borderRadius: 3, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: `${TEAL}22` }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '70%', height: 6, background: '#ffffff11', borderRadius: 3, marginBottom: 4 }} />
            <div style={{ width: '50%', height: 6, background: '#ffffff11', borderRadius: 3 }} />
          </div>
        </div>
      </div>
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
  delay: number;
  opacity: number;
}> = ({ x, y, size, frame, delay, opacity }) => {
  const rot = (frame - delay) * 0.8;
  const recOpacity = interpolate(frame, [delay, delay + 20], [0, opacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        opacity: recOpacity,
        boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
      }}
    >
      {/* Center label */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${TEAL}44, ${TEAL}11)`,
          border: `1px solid ${TEAL}33`,
        }}
      />
      {/* Center hole */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: DARK,
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Equalizer bars
// ─────────────────────────────────────────────────────────────
const EqualizerBars: React.FC<{
  x: number;
  y: number;
  frame: number;
  delay: number;
  opacity: number;
  barCount?: number;
}> = ({ x, y, frame, delay, opacity, barCount = 12 }) => {
  const eqOpacity = interpolate(frame, [delay, delay + 15], [0, opacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        bottom: y,
        display: 'flex',
        gap: 4,
        alignItems: 'flex-end',
        opacity: eqOpacity,
      }}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const height = 20 + Math.sin((frame - delay) * 0.12 + i * 0.8) * 15 + Math.cos((frame - delay) * 0.08 + i * 1.2) * 10;
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: Math.max(4, height),
              borderRadius: 3,
              background: `linear-gradient(to top, ${TEAL}44, ${TEAL}88)`,
              transition: 'height 0.1s',
            }}
          />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Particle field
// ─────────────────────────────────────────────────────────────
const Particles: React.FC<{
  frame: number;
  count?: number;
  opacity?: number;
}> = ({ frame, count = 30, opacity = 0.6 }) => {
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
      speed: 0.2 + r() * 0.5,
      phase: r() * Math.PI * 2,
    }));
  }, [count]);

  return (
    <>
      {particles.map((p, i) => {
        const px = p.x + Math.sin(frame * 0.02 * p.speed + p.phase) * 3;
        const py = p.y + Math.cos(frame * 0.015 * p.speed + p.phase) * 2;
        const pOpacity = 0.3 + Math.sin(frame * 0.05 + p.phase) * 0.3;

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
// All layers fly in from different directions and settle into the banner
// ═════════════════════════════════════════════════════════════
export const BannerCinematic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoScale = spring({ frame: frame - 20, fps, config: { damping: 12, stiffness: 80 } });
  const logoOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Text
  const textOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [60, 80], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Center glow
  const glowOpacity = interpolate(frame, [15, 40, 120, 150], [0, 0.5, 0.5, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      {/* Particles */}
      <Particles frame={frame} opacity={interpolate(frame, [10, 40], [0, 0.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />

      {/* Center teal glow */}
      <div style={{
        position: 'absolute',
        width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${TEAL}33 0%, transparent 60%)`,
        opacity: glowOpacity,
      }} />

      {/* Dashboard cards flying in from corners */}
      <DashCard x={-80} y={-40} w={320} h={200} rotation={-12} opacity={0.7} delay={30} frame={frame} fps={fps} />
      <DashCard x={700} y={-20} w={350} h={220} rotation={8} opacity={0.6} delay={40} frame={frame} fps={fps} />
      <DashCard x={-60} y={520} w={300} h={190} rotation={6} opacity={0.5} delay={50} frame={frame} fps={fps} />
      <DashCard x={680} y={500} w={340} h={210} rotation={-10} opacity={0.55} delay={55} frame={frame} fps={fps} />

      {/* Vinyl records */}
      <VinylRecord x={-100} y={600} size={250} frame={frame} delay={35} opacity={0.4} />
      <VinylRecord x={800} y={-80} size={200} frame={frame} delay={45} opacity={0.35} />

      {/* Center logo and text */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, zIndex: 10 }}>
        <IILogo size={200} opacity={logoOpacity} scale={logoScale} glowSize={interpolate(frame, [40, 80], [0, 25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
        <BrandText opacity={textOpacity} y={textY} />
      </div>

      {/* Equalizer */}
      <EqualizerBars x={750} y={60} frame={frame} delay={70} opacity={0.5} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 2: "Zoom Through"
// Camera zooms through layers from deep background to foreground
// ═════════════════════════════════════════════════════════════
export const BannerZoomThrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera zoom — everything scales up over time
  const cameraZoom = interpolate(frame, [0, 150], [0.6, 1.1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoScale = spring({ frame: frame - 40, fps, config: { damping: 10, stiffness: 60 } });
  const textOpacity = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [80, 100], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `scale(${cameraZoom})`, display: 'contents' }}>
        {/* Deep background layer — records far back */}
        <VinylRecord x={-150} y={-100} size={400} frame={frame} delay={0} opacity={0.15} />
        <VinylRecord x={700} y={500} size={350} frame={frame} delay={5} opacity={0.12} />

        {/* Particles layer */}
        <Particles frame={frame} count={40} opacity={0.4} />

        {/* Mid layer — dashboard cards */}
        <DashCard x={-120} y={50} w={380} h={240} rotation={-15} opacity={0.5} delay={10} frame={frame} fps={fps} />
        <DashCard x={650} y={30} w={400} h={250} rotation={10} opacity={0.45} delay={15} frame={frame} fps={fps} />
        <DashCard x={-80} y={480} w={360} h={220} rotation={8} opacity={0.4} delay={20} frame={frame} fps={fps} />
        <DashCard x={620} y={460} w={380} h={240} rotation={-12} opacity={0.4} delay={25} frame={frame} fps={fps} />

        {/* Center glow */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${TEAL}44 0%, transparent 55%)`,
          opacity: interpolate(frame, [20, 50], [0, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }} />

        {/* Foreground — Logo */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -55%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10,
        }}>
          <IILogo size={220} opacity={interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} scale={logoScale} glowSize={20} />
          <BrandText opacity={textOpacity} y={textY} />
        </div>

        {/* Equalizer bars foreground */}
        <EqualizerBars x={380} y={40} frame={frame} delay={60} opacity={0.6} barCount={16} />
      </div>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 3: "Orbit"
// Elements orbit around the central logo
// ═════════════════════════════════════════════════════════════
export const BannerOrbit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 70 } });
  const textOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [70, 90], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Orbit angle
  const orbitAngle = frame * 0.6;
  const orbitRadius = 340;

  // 4 orbiting items
  const orbitItems = [0, 90, 180, 270].map((offset, i) => {
    const angle = ((orbitAngle + offset) * Math.PI) / 180;
    const ox = Math.cos(angle) * orbitRadius;
    const oy = Math.sin(angle) * orbitRadius * 0.35; // Elliptical
    const zIndex = Math.sin(angle) > 0 ? 5 : 15;
    const itemOpacity = interpolate(frame, [10 + i * 8, 25 + i * 8], [0, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const itemScale = 0.6 + Math.sin(angle) * 0.15;

    return { ox, oy, zIndex, itemOpacity, itemScale, angle };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <Particles frame={frame} count={25} opacity={0.3} />

      {/* Center glow */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${TEAL}22 0%, transparent 60%)`,
        opacity: 0.6,
      }} />

      {/* Orbit ring (subtle) */}
      <div style={{
        position: 'absolute', width: orbitRadius * 2, height: orbitRadius * 0.7,
        borderRadius: '50%', border: `1px solid ${TEAL}15`,
        opacity: interpolate(frame, [5, 20], [0, 0.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }} />

      {/* Orbiting elements */}
      {orbitItems.map((item, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `calc(50% + ${item.ox}px - 80px)`,
            top: `calc(50% + ${item.oy}px - 50px)`,
            zIndex: item.zIndex,
          }}
        >
          {i % 2 === 0 ? (
            <DashCard
              x={0} y={0} w={160} h={100}
              rotation={item.angle * (180 / Math.PI) * 0.1}
              opacity={item.itemOpacity}
              delay={0} frame={frame} fps={fps}
            />
          ) : (
            <VinylRecord
              x={0} y={0} size={100}
              frame={frame} delay={0}
              opacity={item.itemOpacity * 0.6}
            />
          )}
        </div>
      ))}

      {/* Center logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10 }}>
        <IILogo size={180} opacity={1} scale={logoScale} glowSize={20} />
        <BrandText opacity={textOpacity} y={textY} />
      </div>

      {/* Equalizer */}
      <EqualizerBars x={420} y={80} frame={frame} delay={50} opacity={0.4} barCount={10} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 4: "Glitch Reveal"
// Logo appears through digital glitch/scan lines
// ═════════════════════════════════════════════════════════════
export const BannerGlitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scan line position
  const scanY = interpolate(frame, [10, 90], [-100, 1200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glitch offsets (pseudo-random based on frame)
  const glitchX = frame > 15 && frame < 85 ? Math.sin(frame * 7.3) * (frame < 50 ? 15 : 3) : 0;
  const glitchActive = (frame > 20 && frame < 30) || (frame > 45 && frame < 52) || (frame > 70 && frame < 75);

  const logoOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 35, fps, config: { damping: 8, stiffness: 100 } });
  const textOpacity = interpolate(frame, [85, 105], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [85, 105], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

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

      {/* Glitch RGB split on content */}
      <div style={{ transform: `translateX(${glitchX}px)`, display: 'contents' }}>
        <Particles frame={frame} count={20} opacity={0.3} />

        {/* Dashboard cards with glitch appearance */}
        <DashCard x={-60} y={-30} w={300} h={180} rotation={-10} opacity={0.5} delay={25} frame={frame} fps={fps} />
        <DashCard x={680} y={20} w={320} h={200} rotation={7} opacity={0.45} delay={35} frame={frame} fps={fps} />
        <DashCard x={-40} y={500} w={280} h={170} rotation={5} opacity={0.4} delay={40} frame={frame} fps={fps} />
        <DashCard x={660} y={480} w={310} h={190} rotation={-8} opacity={0.4} delay={45} frame={frame} fps={fps} />

        {/* Vinyl */}
        <VinylRecord x={-120} y={580} size={220} frame={frame} delay={30} opacity={0.3} />
        <VinylRecord x={780} y={-60} size={180} frame={frame} delay={38} opacity={0.25} />
      </div>

      {/* Glitch flash */}
      {glitchActive && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(${Math.random() * 360}deg, ${TEAL}11, transparent)`,
          zIndex: 15,
        }} />
      )}

      {/* Center content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10, transform: `translateX(${glitchX * 0.5}px)` }}>
        <IILogo size={200} opacity={logoOpacity} scale={logoScale} glowSize={15} />
        <BrandText opacity={textOpacity} y={textY} />
      </div>

      <EqualizerBars x={700} y={50} frame={frame} delay={65} opacity={0.5} />
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════
// VARIANT 5: "Pulse Wave"
// Logo appears with expanding concentric pulse rings
// ═════════════════════════════════════════════════════════════
export const BannerPulse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 8, stiffness: 90, mass: 0.6 } });
  const textOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [70, 90], [25, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Pulse rings — 4 waves at different timings
  const pulseRings = [
    { delay: 20, color: TEAL },
    { delay: 35, color: TEAL_END },
    { delay: 50, color: TEAL },
    { delay: 65, color: TEAL_END },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <Particles frame={frame} count={35} opacity={0.4} />

      {/* Pulse rings */}
      {pulseRings.map((ring, i) => {
        const ringScale = interpolate(frame, [ring.delay, ring.delay + 60], [0.3, 3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        const ringOpacity = interpolate(frame, [ring.delay, ring.delay + 20, ring.delay + 60], [0, 0.6, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 60,
              border: `2px solid ${ring.color}`,
              transform: `scale(${ringScale})`,
              opacity: ringOpacity,
            }}
          />
        );
      })}

      {/* Dashboard cards appearing on pulse waves */}
      <DashCard x={-100} y={-20} w={340} h={210} rotation={-12} opacity={0.55} delay={30} frame={frame} fps={fps} />
      <DashCard x={680} y={10} w={360} h={220} rotation={9} opacity={0.5} delay={42} frame={frame} fps={fps} />
      <DashCard x={-70} y={490} w={320} h={200} rotation={7} opacity={0.45} delay={52} frame={frame} fps={fps} />
      <DashCard x={650} y={470} w={350} h={215} rotation={-11} opacity={0.4} delay={58} frame={frame} fps={fps} />

      {/* Vinyl */}
      <VinylRecord x={-130} y={560} size={240} frame={frame} delay={25} opacity={0.35} />
      <VinylRecord x={790} y={-70} size={200} frame={frame} delay={33} opacity={0.3} />

      {/* Center logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 25, zIndex: 10 }}>
        <IILogo size={200} opacity={1} scale={logoScale} glowSize={interpolate(frame, [5, 40, 80], [0, 30, 15], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
        <BrandText opacity={textOpacity} y={textY} />
      </div>

      <EqualizerBars x={400} y={50} frame={frame} delay={55} opacity={0.5} barCount={14} />
    </AbsoluteFill>
  );
};
