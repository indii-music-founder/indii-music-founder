import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';

/**
 * indiiOS Animated Logo Reveal
 * 
 * Timeline (at 30fps, 150 frames = 5 seconds):
 * - 0-30:   Dark void, subtle particle glow fades in
 * - 15-50:  Teal outer rounded square scales up from 0 with spring bounce
 * - 35-65:  Dark inner panel fades in with scale
 * - 50-80:  Left "i" bar slides up from below + left dot drops from above
 * - 60-90:  Right "i" bar slides up from below + right dot drops from above
 * - 80-110: Glow pulse radiates outward
 * - 100-140: "indiiOS" text fades in letter by letter
 * - 110-150: Tagline "The Sovereign Creative Engine" fades in
 */

const TEAL_START = '#00E5CC';
const TEAL_END = '#00B8D4';
const DARK_BG = '#0A0A12';
const DARK_INNER = '#0C0C1A';

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // — Outer square entrance (spring) —
  const outerScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });

  const outerOpacity = interpolate(frame, [15, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — Inner panel entrance —
  const innerScale = spring({
    frame: frame - 35,
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.6 },
  });

  const innerOpacity = interpolate(frame, [35, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — Left "i" bar (slides up) —
  const leftBarY = interpolate(frame, [50, 72], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.4)),
  });

  const leftBarOpacity = interpolate(frame, [50, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — Left "i" dot (drops from above) —
  const leftDotY = interpolate(frame, [55, 75], [-60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.bounce),
  });

  const leftDotOpacity = interpolate(frame, [55, 63], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — Right "i" bar (slides up, 10 frame delay) —
  const rightBarY = interpolate(frame, [60, 82], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.4)),
  });

  const rightBarOpacity = interpolate(frame, [60, 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — Right "i" dot (drops from above, 10 frame delay) —
  const rightDotY = interpolate(frame, [65, 85], [-60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.bounce),
  });

  const rightDotOpacity = interpolate(frame, [65, 73], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — Glow pulse —
  const glowScale = interpolate(frame, [80, 110], [0.8, 1.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const glowOpacity = interpolate(frame, [80, 95, 110], [0, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // — "indiiOS" text —
  const textOpacity = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textY = interpolate(frame, [100, 120], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // — Tagline —
  const taglineOpacity = interpolate(frame, [115, 135], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taglineY = interpolate(frame, [115, 135], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // — Ambient background particles —
  const bgGlow = interpolate(frame, [0, 30], [0, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: DARK_BG,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Ambient radial glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${TEAL_START}22 0%, transparent 70%)`,
          opacity: bgGlow,
        }}
      />

      {/* Glow pulse ring */}
      <div
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: 70,
          border: `3px solid ${TEAL_START}`,
          transform: `scale(${glowScale})`,
          opacity: glowOpacity,
          boxShadow: `0 0 40px ${TEAL_START}66, inset 0 0 40px ${TEAL_START}22`,
        }}
      />

      {/* Logo container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
        }}
      >
        {/* SVG Logo Mark */}
        <svg
          width="280"
          height="280"
          viewBox="0 0 512 512"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 ${interpolate(frame, [80, 110], [0, 30], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px ${TEAL_START}66)`,
          }}
        >
          <defs>
            <linearGradient
              id="outer-grad"
              x1="0"
              y1="0"
              x2="512"
              y2="512"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={TEAL_START} />
              <stop offset="100%" stopColor={TEAL_END} />
            </linearGradient>
            <linearGradient
              id="ii-grad"
              x1="180"
              y1="120"
              x2="340"
              y2="400"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={TEAL_START} />
              <stop offset="100%" stopColor={TEAL_END} />
            </linearGradient>
          </defs>

          {/* Outer rounded square */}
          <rect
            width="512"
            height="512"
            rx="128"
            fill="url(#outer-grad)"
            opacity={outerOpacity}
            transform={`translate(256, 256) scale(${outerScale}) translate(-256, -256)`}
          />

          {/* Inner dark panel */}
          <rect
            x="48"
            y="48"
            width="416"
            height="416"
            rx="96"
            fill={DARK_INNER}
            opacity={innerOpacity}
            transform={`translate(256, 256) scale(${innerScale}) translate(-256, -256)`}
          />

          {/* Left "i" dot */}
          <circle
            cx="200"
            cy="155"
            r="28"
            fill="url(#ii-grad)"
            opacity={leftDotOpacity}
            transform={`translate(0, ${leftDotY})`}
          />

          {/* Left "i" bar */}
          <rect
            x="174"
            y="210"
            width="52"
            height="160"
            rx="26"
            fill="url(#ii-grad)"
            opacity={leftBarOpacity}
            transform={`translate(0, ${leftBarY})`}
          />

          {/* Right "i" dot */}
          <circle
            cx="312"
            cy="155"
            r="28"
            fill="url(#ii-grad)"
            opacity={rightDotOpacity}
            transform={`translate(0, ${rightDotY})`}
          />

          {/* Right "i" bar */}
          <rect
            x="286"
            y="210"
            width="52"
            height="160"
            rx="26"
            fill="url(#ii-grad)"
            opacity={rightBarOpacity}
            transform={`translate(0, ${rightBarY})`}
          />
        </svg>

        {/* "indiiOS" text */}
        <div
          style={{
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            color: '#FFFFFF',
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          indiiOS
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            color: TEAL_START,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          The Sovereign Creative Engine
        </div>
      </div>
    </AbsoluteFill>
  );
};
