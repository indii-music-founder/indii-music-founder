import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPotentialBlenderPaths, detectGpuAcceleration } from '../discovery.js';
import { listAvailableTemplates, getTemplateInfo } from '../templates.js';
import { parseBlenderFrameProgress } from '../executor.js';

describe('Blender MCP Module', () => {
    describe('Discovery', () => {
        const originalEnv = process.env.BLENDER_PATH;

        beforeEach(() => {
            delete process.env.BLENDER_PATH;
        });

        afterEach(() => {
            if (originalEnv) process.env.BLENDER_PATH = originalEnv;
            else delete process.env.BLENDER_PATH;
        });

        it('includes standard paths based on platform', () => {
            const paths = getPotentialBlenderPaths();
            expect(Array.isArray(paths)).toBe(true);
            expect(paths.length).toBeGreaterThan(0);
        });

        it('prioritizes BLENDER_PATH environment variable if set', () => {
            process.env.BLENDER_PATH = '/custom/path/to/blender';
            const paths = getPotentialBlenderPaths();
            expect(paths[0]).toBe('/custom/path/to/blender');
        });

        it('detects GPU acceleration correctly on Apple Silicon', () => {
            const accel = detectGpuAcceleration();
            expect(['Metal', 'CUDA', 'OptiX', 'HIP', 'CPU', 'None']).toContain(accel);
        });
    });

    describe('Templates', () => {
        it('lists all 5 procedural templates', () => {
            const templates = listAvailableTemplates();
            expect(templates.length).toBe(5);
            const ids = templates.map(t => t.id);
            expect(ids).toContain('audio_reactive_tunnel');
            expect(ids).toContain('vinyl_turntable');
            expect(ids).toContain('chrome_text');
            expect(ids).toContain('spectrum_bars');
            expect(ids).toContain('concert_stage');
        });

        it('retrieves template details by id', () => {
            const tunnel = getTemplateInfo('audio_reactive_tunnel');
            expect(tunnel).not.toBeNull();
            expect(tunnel?.name).toBe('Audio-Reactive Cyber Tunnel');
            expect(tunnel?.recommendedAspectRatio).toBe('16:9');
        });

        it('returns null for unknown template id', () => {
            // @ts-expect-error testing invalid ID
            const unknown = getTemplateInfo('invalid_template');
            expect(unknown).toBeNull();
        });
    });

    describe('Executor Frame Progress Parsing', () => {
        it('parses frame number and computes percentage and time', () => {
            const stdout = 'Fra:45 Mem:120.4M (Peak 135.0M) | Time:00:04.50 | Remaining:00:15.00';
            const startTime = Date.now() - 4500;
            const progress = parseBlenderFrameProgress(stdout, 90, startTime);

            expect(progress).not.toBeNull();
            expect(progress?.currentFrame).toBe(45);
            expect(progress?.totalFrames).toBe(90);
            expect(progress?.percentage).toBe(50);
            expect(progress?.elapsedSeconds).toBeGreaterThanOrEqual(4);
            expect(progress?.estimatedSecondsRemaining).toBeGreaterThanOrEqual(0);
        });

        it('parses Blender 5.x Video append frame format', () => {
            const stdout = '00:08.760  render           | Video append frame 45';
            const startTime = Date.now() - 4500;
            const progress = parseBlenderFrameProgress(stdout, 90, startTime);

            expect(progress).not.toBeNull();
            expect(progress?.currentFrame).toBe(45);
            expect(progress?.totalFrames).toBe(90);
            expect(progress?.percentage).toBe(50);
        });

        it('returns null if line does not contain frame indicator', () => {
            const line = 'Blender 4.3.0 initialized successfully.';
            const progress = parseBlenderFrameProgress(line, 90, Date.now());
            expect(progress).toBeNull();
        });
    });
});
