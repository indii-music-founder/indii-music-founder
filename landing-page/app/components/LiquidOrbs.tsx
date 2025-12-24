'use client';

import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { KawaseBlurFilter } from '@pixi/filter-kawase-blur';
import { createNoise2D } from 'simplex-noise';
import debounce from 'debounce';
import hsl from 'hsl-to-hex';
import { useAudioStore } from '../store/audioStore';

// --- Performance Detection ---
function detectPerformanceTier(): 'high' | 'medium' | 'low' {
    if (typeof window === 'undefined') return 'medium';

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4; // GB, non-standard but widely supported

    // Low-end: mobile with <4 cores or <4GB RAM
    if (isMobile && (cores < 4 || memory < 4)) return 'low';
    // Medium: mobile or desktop with 4-6 cores
    if (isMobile || cores <= 6) return 'medium';
    // High: desktop with 6+ cores and good memory
    return 'high';
}

// --- Configuration (performance-adaptive) ---
const PERF_TIER = typeof window !== 'undefined' ? detectPerformanceTier() : 'medium';
const PERF_CONFIG = {
    high: { maxOrbs: 50, resolution: 2, blurQuality: 10 },
    medium: { maxOrbs: 25, resolution: 1.5, blurQuality: 6 },
    low: { maxOrbs: 12, resolution: 1, blurQuality: 3 },
};
const { maxOrbs: MAX_ORB_COUNT, resolution: RESOLUTION, blurQuality: BLUR_QUALITY } = PERF_CONFIG[PERF_TIER];

const BASE_RADIUS = 60; // Base size of orbs
const COLOR_RANGE = {
    hueMin: 180, // Cyan
    hueMax: 280, // Purple
    sat: 80,
    light: 60
};
const SPEED_FACTOR = 0.002; // How fast they move

export default function LiquidOrbs() {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const orbsRef = useRef<Orb[]>([]);

    // Scroll State (We need to listen to scroll)
    // Since this is outside the R3F Canvas, we can't use useScroll directly easily without bridging.
    // We'll use a native scroll listener on the window/body for this overlay effect.
    const scrollRef = useRef(0);

    // Subscribe to Audio Store
    // We use a ref for the data to avoid re-creating the loop on every frame update
    const freqDataRef = useRef({ bass: 0, mid: 0, high: 0 });

    useEffect(() => {
        const unsub = useAudioStore.subscribe((state) => {
            freqDataRef.current = state.frequencyData;
        });

        // Native Scroll Listener for the overlay
        // The R3F ScrollControls uses a virtual scroll, so we might need to hook into the DOM element it creates if possible,
        // or just approximate with window scroll if the body is scrolling.
        // However, R3F ScrollControls usually sets document height.
        const onScroll = () => {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            const s = window.scrollY;
            scrollRef.current = s / h; // 0 to 1
        };

        window.addEventListener('scroll', onScroll);

        return () => {
            unsub();
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        let app: PIXI.Application | null = null;
        let mounted = true;
        let handleResize: (() => void) | null = null;

        const initPixi = async () => {
            // 1. Initialize PixiJS Application (v8 is async)
            app = new PIXI.Application();

            await app.init({
                resizeTo: window,
                backgroundAlpha: 0,
                antialias: PERF_TIER !== 'low', // Disable antialiasing on low-end devices
                autoDensity: true,
                resolution: RESOLUTION,
            });

            if (!mounted || !containerRef.current) {
                app.destroy();
                return;
            }

            // Clear any existing canvas to prevent duplicates
            while (containerRef.current.firstChild) {
                containerRef.current.removeChild(containerRef.current.firstChild);
            }

            containerRef.current.appendChild(app.canvas);
            appRef.current = app;

            // 2. Create Stage
            const orbStage = new PIXI.Container();
            app.stage.addChild(orbStage);

            // 3. Apply Filter (quality adjusted by performance tier)
            const blurFilter = new KawaseBlurFilter(30, BLUR_QUALITY, true);
            // @ts-expect-error pixi.js filters typing does not include generic containers
            orbStage.filters = [blurFilter];

            // 4. Create Orbs
            const orbs: Orb[] = [];
            const noise2D = createNoise2D();

            for (let i = 0; i < MAX_ORB_COUNT; i++) {
                const orb = new Orb(noise2D, i);
                orbs.push(orb);
                orbStage.addChild(orb.graphics);
            }
            orbsRef.current = orbs;

            // 5. Animation Loop
            app.ticker.add(() => {
                const { bass, mid, high } = freqDataRef.current;
                const scrollProgress = scrollRef.current; // 0 to 1

                // Calculate active orb count based on scroll
                // Start with 5, ramp up to MAX
                const activeCount = Math.floor(5 + (scrollProgress * (MAX_ORB_COUNT - 5)));

                // Global modulation based on Bass (Kick)
                const globalScale = 1 + (bass * 0.2);
                orbStage.scale.set(globalScale);
                // Center the scaling
                orbStage.x = (app!.screen.width - app!.screen.width * globalScale) / 2;
                orbStage.y = (app!.screen.height - app!.screen.height * globalScale) / 2;

                orbs.forEach((orb, i) => {
                    // Only update and show active orbs
                    if (i < activeCount) {
                        orb.graphics.visible = true;
                        orb.update(bass, mid, high, app!.screen.height);
                    } else {
                        orb.graphics.visible = false;
                        orb.reset(app!.screen.height); // Keep them ready at bottom
                    }
                });
            });

            // 6. Handle Resize
            handleResize = debounce(() => {
                if (app && app.renderer) {
                    app.resize();
                    orbs.forEach(orb => orb.setBounds(window.innerWidth, window.innerHeight));
                }
            }, 200);

            window.addEventListener('resize', handleResize);
        };

        initPixi();

        return () => {
            mounted = false;
            if (handleResize) {
                window.removeEventListener('resize', handleResize);
            }
            // Cleanup
            if (app) {
                // v8 destroy
                app.destroy({ removeView: true }, { children: true, texture: true });
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed bottom-0 left-0 w-full h-full pointer-events-none z-0 opacity-60 mix-blend-screen"
            style={{
                // Full screen mask to allow bubbles everywhere but fade at very top
                maskImage: 'linear-gradient(to top, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, black 80%, transparent 100%)',
                zIndex: 0 // Explicitly set z-index
            }}
        />
    );
}

// --- Orb Class ---
class Orb {
    graphics: PIXI.Graphics;
    noise2D: (x: number, y: number) => number;
    index: number;

    // State
    x: number = 0;
    y: number = 0;
    radius: number = 0;
    baseRadius: number = 0;
    color: number = 0;
    baseColorHue: number = 0;

    // Bounds
    boundsX: number = window.innerWidth;
    boundsY: number = window.innerHeight;

    // Noise Offsets (for organic movement)
    xOff: number;
    yOff: number;
    inc: number;

    popping: boolean = false;
    popScale: number = 1;

    constructor(noiseInstance: (x: number, y: number) => number, index: number) {
        this.noise2D = noiseInstance;
        this.index = index;
        this.graphics = new PIXI.Graphics();

        // Random starting parameters
        this.xOff = Math.random() * 1000;
        this.yOff = Math.random() * 1000;
        this.inc = SPEED_FACTOR + (Math.random() * 0.002); // Slight speed variance

        this.setBounds(window.innerWidth, window.innerHeight);
        this.reset(window.innerHeight);
    }

    setBounds(w: number, h: number) {
        this.boundsX = w;
        this.boundsY = h;
    }

    reset(screenHeight: number) {
        this.x = this.boundsX / 2 + (Math.random() - 0.5) * this.boundsX; // Full width spread
        this.y = screenHeight + (Math.random() * 200); // Start well below screen

        this.baseRadius = BASE_RADIUS + (Math.random() * 40);
        this.radius = this.baseRadius;

        this.baseColorHue = COLOR_RANGE.hueMin + Math.random() * (COLOR_RANGE.hueMax - COLOR_RANGE.hueMin);
        this.color = parseInt(hsl(this.baseColorHue, COLOR_RANGE.sat, COLOR_RANGE.light).replace('#', ''), 16);

        this.popping = false;
        this.popScale = 1;
    }

    update(bass: number, mid: number, high: number, screenHeight: number) {
        if (this.popping) {
            // Pop animation
            this.popScale += 0.2;
            this.graphics.clear();
            this.graphics.beginFill(this.color, 1 - (this.popScale - 1) * 2); // Fade out fast
            this.graphics.drawCircle(this.x, this.y, this.radius * this.popScale);
            this.graphics.endFill();

            if (this.popScale > 1.5) {
                this.reset(screenHeight);
            }
            return;
        }

        // 1. Audio Reactivity
        const targetRadius = this.baseRadius + (bass * 40);
        this.radius += (targetRadius - this.radius) * 0.1;

        const speedMultiplier = 1 + (high * 4);

        const hueShift = mid * 60;
        const currentHue = (this.baseColorHue + hueShift) % 360;
        this.color = parseInt(hsl(currentHue, COLOR_RANGE.sat, COLOR_RANGE.light + (high * 20)).replace('#', ''), 16);

        // 2. Calculate Organic Movement using Simplex Noise
        const nX = this.noise2D(this.xOff, this.xOff);
        const nY = this.noise2D(this.yOff, this.yOff);

        this.x += nX * 2 * speedMultiplier;
        this.y -= (Math.abs(nY) * 2 + 1.0) * speedMultiplier; // Constant upward flow

        // 3. Update Noise Offsets
        this.xOff += this.inc * speedMultiplier;
        this.yOff += this.inc * speedMultiplier;

        // 4. Random Pop Chance (Higher with Highs)
        if (this.y < screenHeight * 0.5 && Math.random() < (0.001 + high * 0.01)) {
            this.popping = true;
        }

        // 5. Wrap / Reset if off screen
        if (this.y < -this.radius * 2) {
            this.reset(screenHeight);
            this.y = screenHeight + this.radius; // Reset to bottom
        }

        // 6. Render
        this.graphics.clear();
        this.graphics.beginFill(this.color);
        this.graphics.drawCircle(this.x, this.y, this.radius);
        this.graphics.endFill();
    }
}
