// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the VoiceService continuous dictation mode — the engine
 * behind the chat overlay's TalkButton (talkback: click to talk, release to
 * send). The legacy single-shot startListening path must remain untouched.
 */

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({ AutonomousIntelligence: {} }));
vi.mock('@/services/audio/AudioService', () => ({
    audioService: { stop: vi.fn(), playUrl: vi.fn() },
    AudioPlaybackInterruptedError: class extends Error {},
}));
vi.mock('@/core/store', () => ({ useStore: { getState: vi.fn(() => ({})) } }));

type FakeRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onresult: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onend: (() => void) | null;
};

const createdInstances: FakeRecognition[] = [];
const lastInstance = (): FakeRecognition => createdInstances[createdInstances.length - 1]!;

class FakeSpeechRecognition implements FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    start = vi.fn();
    stop = vi.fn();
    onresult: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onend: (() => void) | null = null;

    constructor() {
        createdInstances.push(this);
    }
}

const resultEntry = (transcript: string, isFinal: boolean) => ({
    0: { transcript },
    isFinal,
});

const makeEvent = (results: Array<{ transcript: string; isFinal: boolean }>, resultIndex = 0) => ({
    resultIndex,
    results: Object.assign({}, results.map((r) => resultEntry(r.transcript, r.isFinal)), {
        length: results.length,
    }),
});

describe('VoiceService.startDictation', () => {
    beforeEach(() => {
        createdInstances.length = 0;
        vi.clearAllMocks();
        const w = window as unknown as Record<string, unknown>;
        w.webkitSpeechRecognition = FakeSpeechRecognition;
        delete w.SpeechRecognition;
        vi.resetModules();
    });

    const loadService = async () => {
        const mod = await import('./VoiceService');
        return new mod.VoiceService();
    };

    it('runs the recognition in continuous mode with interim results', async () => {
        const svc = await loadService();
        const ok = svc.startDictation({ onFinal: vi.fn() });
        expect(ok).toBe(true);
        expect(lastInstance().continuous).toBe(true);
        expect(lastInstance().interimResults).toBe(true);
    });

    it('accumulates finalized words and streams the unstable tail separately', async () => {
        const svc = await loadService();
        const finals: string[] = [];
        const interims: string[] = [];
        svc.startDictation({
            onFinal: (t) => finals.push(t),
            onInterim: (t) => interims.push(t),
        });

        // First pass: one final phrase plus a live tail.
        lastInstance().onresult!(makeEvent([
            { transcript: 'count me in ', isFinal: true },
            { transcript: 'and also', isFinal: false },
        ]));
        expect(finals.at(-1)).toBe('count me in ');
        expect(interims.at(-1)).toBe('and also');

        // Second pass: real engines resend the accumulated results list; only
        // entries from resultIndex onward are new.
        lastInstance().onresult!(makeEvent([
            { transcript: 'count me in ', isFinal: true },
            { transcript: 'and also waiting', isFinal: true },
            { transcript: 'next', isFinal: false },
        ], 1));
        expect(finals.at(-1)).toBe('count me in and also waiting');
        expect(interims.at(-1)).toBe('next');
    });

    it('stopDictation stops gracefully and fires onEnd exactly once', async () => {
        const svc = await loadService();
        const onEnd = vi.fn();
        svc.startDictation({ onEnd });

        svc.stopDictation();
        expect(lastInstance().stop).toHaveBeenCalledTimes(1);

        lastInstance().onend!();
        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(svc.isDictatingActive()).toBe(false);

        // A late duplicate onend must not double-report.
        lastInstance().onend!();
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('reports errors through onError without throwing', async () => {
        const svc = await loadService();
        const onError = vi.fn();
        svc.startDictation({ onError });

        lastInstance().onerror!({ error: 'not-allowed' });
        expect(onError).toHaveBeenCalledWith('not-allowed');
    });

    it('returns false when speech recognition is unavailable', async () => {
        delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
        const svc = await loadService();
        const onError = vi.fn();
        expect(svc.startDictation({ onError })).toBe(false);
        expect(onError).not.toHaveBeenCalled();
    });

    it('is a no-op session guard: starting twice does not restart the engine', async () => {
        const svc = await loadService();
        svc.startDictation({});
        const firstInstance = lastInstance();
        expect(svc.startDictation({})).toBe(true);
        expect(lastInstance()).toBe(firstInstance);
        expect(firstInstance.start).toHaveBeenCalledTimes(1);
    });
});
