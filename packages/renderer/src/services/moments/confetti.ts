/**
 * Dependency-free canvas confetti burst for Moment celebrations.
 *
 * Uses the Frequency palette plus warm amber gold, runs a single
 * requestAnimationFrame loop that auto-stops after ~2.2s, and becomes an
 * immediate no-op when `prefers-reduced-motion: reduce` is active.
 */

import { FREQUENCY_PALETTE } from '@shared/share/shareCardTemplates';

export const CONFETTI_COLORS = [
    FREQUENCY_PALETTE.resonanceBlue,
    FREQUENCY_PALETTE.frequencyPink,
    FREQUENCY_PALETTE.dopaminePink,
    FREQUENCY_PALETTE.electricBlue,
    '#FFB800',
] as const;

export interface ConfettiOptions {
    durationMs?: number;
    particleCount?: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    vr: number;
    color: string;
    isRect: boolean;
}

function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Triggers a single celebratory confetti burst on the supplied canvas element.
 * Returns a cleanup callback that cancels the animation frame and clears the canvas.
 */
export function burstConfetti(
    canvas: HTMLCanvasElement | null | undefined,
    options: ConfettiOptions = {},
): () => void {
    if (typeof window === 'undefined' || !canvas || prefersReducedMotion()) {
        return () => {};
    }

    const ctx = canvas.getContext('2d');
    if (!ctx || typeof window.requestAnimationFrame !== 'function') {
        return () => {};
    }

    const durationMs = options.durationMs ?? 2200;
    const particleCount = options.particleCount ?? 64;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width || canvas.width || 640, 320);
    const height = Math.max(rect.height || canvas.height || 480, 240);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const originX = width * 0.5;
    const originY = height * 0.36;
    const particles: Particle[] = Array.from({ length: particleCount }, (_, idx) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
        const speed = 3.5 + Math.random() * 6.5;
        return {
            x: originX + (Math.random() - 0.5) * 40,
            y: originY + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            size: 5 + Math.random() * 5,
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.24,
            color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length]!,
            isRect: idx % 3 !== 0,
        };
    });

    let rafId: number | null = null;
    let stopped = false;
    let startTime: number | null = null;

    const cleanup = () => {
        stopped = true;
        if (rafId !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
        ctx.clearRect(0, 0, width, height);
    };

    const tick = (now: number) => {
        if (stopped) return;
        if (startTime === null) startTime = now;

        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        ctx.clearRect(0, 0, width, height);

        const alpha = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;
        for (const p of particles) {
            p.vy += 0.18;
            p.vx *= 0.985;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.vr;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            if (p.isRect) {
                ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (elapsed < durationMs) {
            rafId = window.requestAnimationFrame(tick);
        } else {
            cleanup();
        }
    };

    rafId = window.requestAnimationFrame(tick);
    return cleanup;
}
