import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { audioContextManager } from './AudioContextManager';
import { useStore } from '@/core/store';

/**
 * The PIP player routes its media element through the shared context's
 * graph, so suspending the context while music plays = silent music.
 * These tests pin that behavior: hidden tab + playing -> context stays
 * running; hidden tab + idle -> context suspends and resumes on return.
 */

describe('AudioContextManager visibility behavior', () => {
    const callCounts = { suspend: 0, resume: 0 };
    let originalVisibility: PropertyDescriptor | undefined;

    function setVisibility(value: 'visible' | 'hidden') {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value,
        });
    }

    beforeEach(() => {
        originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
        callCounts.suspend = 0;
        callCounts.resume = 0;
        vi.stubGlobal('AudioContext', class {
            state = 'running';
            suspend = vi.fn(async () => {
                this.state = 'suspended';
                callCounts.suspend++;
            });
            resume = vi.fn(async () => {
                this.state = 'running';
                callCounts.resume++;
            });
            close = vi.fn(async () => {});
            destination = {};
            createMediaElementSource = vi.fn();
            createAnalyser = vi.fn(() => ({
                fftSize: 0,
                smoothingTimeConstant: 0,
                frequencyBinCount: 0,
                getByteFrequencyData: vi.fn(),
                connect: vi.fn(),
            }));
        });
        setVisibility('visible');
        useStore.setState({ isPlaying: false });
    });

    afterEach(async () => {
        await audioContextManager.dispose();
        vi.unstubAllGlobals();
        if (originalVisibility) {
            Object.defineProperty(document, 'visibilityState', originalVisibility);
        }
        useStore.setState({ isPlaying: false });
    });

    it('keeps music alive on tab hide while playing, and suspends/resumes when idle', async () => {
        // The singleton's visibility listener is installed once at module
        // load and removed by dispose(), so the whole journey lives in one
        // test.
        audioContextManager.initialize();

        // 1. Music playing + tab hides -> context must keep running.
        useStore.setState({ isPlaying: true });
        setVisibility('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.waitFor(() => expect(callCounts.suspend).toBe(0));

        // 2. User pauses, tab hides again -> idle context suspends.
        setVisibility('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        useStore.setState({ isPlaying: false });
        setVisibility('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.waitFor(() => expect(callCounts.suspend).toBe(1));

        // 3. Tab returns -> context resumes.
        setVisibility('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.waitFor(() => expect(callCounts.resume).toBe(1));
    });
});
