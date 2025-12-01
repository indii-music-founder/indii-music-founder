'use client';

import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { KawaseBlurFilter } from '@pixi/filter-kawase-blur';
import { createNoise2D } from 'simplex-noise';
import debounce from 'debounce';
import hsl from 'hsl-to-hex';

// --- Configuration ---
// We expose these as constants so they can be easily tweaked or mapped to Audio later.
const ORB_COUNT = 20;
const BASE_RADIUS = 80; // Base size of orbs
const COLOR_RANGE = {
    hueMin: 180, // Cyan
    hueMax: 280, // Purple
    sat: 80,
    light: 60
};
const SPEED_FACTOR = 0.0015; // How fast they move

export default function LiquidOrbs() {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // 1. Initialize PixiJS Application
        const app = new PIXI.Application({
            resizeTo: window, // Auto-resize to window
            backgroundAlpha: 0, // Transparent background
            antialias: true,
            autoDensity: true,
            resolution: 2, // Retina support
        });

        containerRef.current.appendChild(app.view as unknown as Node);
        appRef.current = app;

        // 2. Create the Stage for Orbs
        // We render orbs into a container so we can apply the blur filter to the *group*
        const orbStage = new PIXI.Container();
        app.stage.addChild(orbStage);

        // 3. Apply the "Liquid" Filter (Kawase Blur)
        // High blur + Thresholding (handled visually by contrast) creates the goo effect
        const blurFilter = new KawaseBlurFilter(30, 10, true);
        // @ts-ignore - PixiJS Filter type compatibility issue with plugin
        orbStage.filters = [blurFilter];

        // 4. Create Orbs
        const orbs: Orb[] = [];
        const noise2D = createNoise2D();

        for (let i = 0; i < ORB_COUNT; i++) {
            const orb = new Orb(noise2D, i);
            orbs.push(orb);
            orbStage.addChild(orb.graphics);
        }

        // 5. Animation Loop
        app.ticker.add(() => {
            orbs.forEach(orb => orb.update());
        });

        // 6. Handle Resize
        const handleResize = debounce(() => {
            app.resize();
            orbs.forEach(orb => orb.setBounds(window.innerWidth, window.innerHeight));
        }, 200);

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            // PixiJS 7+ destroy signature is simpler or object-based, removing specific flags to be safe
            app.destroy(true, { children: true, texture: true });
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed bottom-0 left-0 w-full h-[50vh] pointer-events-none z-0 opacity-60 mix-blend-screen"
            style={{
                maskImage: 'linear-gradient(to top, black 20%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 100%)'
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
    vx: number = 0;
    vy: number = 0;
    radius: number = 0;
    color: number = 0;

    // Bounds
    boundsX: number = window.innerWidth;
    boundsY: number = window.innerHeight;

    // Noise Offsets (for organic movement)
    xOff: number;
    yOff: number;
    inc: number;

    constructor(noiseInstance: (x: number, y: number) => number, index: number) {
        this.noise2D = noiseInstance;
        this.index = index;
        this.graphics = new PIXI.Graphics();

        // Random starting parameters
        this.xOff = Math.random() * 1000;
        this.yOff = Math.random() * 1000;
        this.inc = SPEED_FACTOR + (Math.random() * 0.002); // Slight speed variance

        this.setBounds(window.innerWidth, window.innerHeight);
        this.reset();
    }

    setBounds(w: number, h: number) {
        this.boundsX = w;
        this.boundsY = h;
    }

    reset() {
        // Start somewhere near the bottom center
        this.x = this.boundsX / 2 + (Math.random() - 0.5) * (this.boundsX * 0.5);
        this.y = this.boundsY + (Math.random() * 200); // Start slightly below screen

        // Random Size
        this.radius = BASE_RADIUS + (Math.random() * 50);

        // Random Color from Palette
        const hue = COLOR_RANGE.hueMin + Math.random() * (COLOR_RANGE.hueMax - COLOR_RANGE.hueMin);
        this.color = parseInt(hsl(hue, COLOR_RANGE.sat, COLOR_RANGE.light).replace('#', ''), 16);
    }

    update() {
        // 1. Calculate Organic Movement using Simplex Noise
        // We map noise (-1 to 1) to velocity
        const nX = this.noise2D(this.xOff, this.xOff);
        const nY = this.noise2D(this.yOff, this.yOff);

        // Map noise to position updates
        // We want them to generally float UP (-y) but wander left/right
        this.x += nX * 2;
        this.y -= Math.abs(nY) * 2 + 0.5; // Always float up

        // 2. Update Noise Offsets
        this.xOff += this.inc;
        this.yOff += this.inc;

        // 3. Wrap / Reset if off screen
        if (this.y < -this.radius * 2) {
            this.reset();
            this.y = this.boundsY + this.radius; // Reset to bottom
        }

        // 4. Render
        this.graphics.clear();
        this.graphics.beginFill(this.color);
        this.graphics.drawCircle(this.x, this.y, this.radius);
        this.graphics.endFill();
    }
}
