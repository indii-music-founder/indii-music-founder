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
    onstart: (() => void) | null;
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
    start = vi.fn(() => { this.onstart?.(); });
    stop = vi.fn();
    onstart: (() => void) | null = null;
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

    it('does not report the expected aborted error that follows an intentional stop', async () => {
        const svc = await loadService();
        const onError = vi.fn();
        const onEnd = vi.fn();
        svc.startDictation({ onError, onEnd });

        svc.stopDictation();
        lastInstance().onerror!({ error: 'aborted' });
        expect(onError).not.toHaveBeenCalled();

        // The session still ends cleanly through onend.
        lastInstance().onend!();
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('treats silence (no-speech) as a natural end, never as a failure', async () => {
        const svc = await loadService();
        const onError = vi.fn();
        const onEnd = vi.fn();
        svc.startDictation({ onError, onEnd });

        lastInstance().onerror!({ error: 'no-speech' });
        expect(onError).not.toHaveBeenCalled();

        lastInstance().onend!();
        expect(onEnd).toHaveBeenCalledTimes(1);
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

    it('supersedes the previous owner when another surface starts dictating', async () => {
        const svc = await loadService();
        const firstFinal = vi.fn();
        const firstSuperseded = vi.fn();
        svc.startDictation({ onFinal: firstFinal, onSuperseded: firstSuperseded });

        // A second surface (e.g. the docked panel while the overlay is live) takes over.
        const secondFinal = vi.fn();
        const secondSuperseded = vi.fn();
        expect(svc.startDictation({ onFinal: secondFinal, onSuperseded: secondSuperseded })).toBe(true);

        expect(firstSuperseded).toHaveBeenCalledTimes(1);
        expect(secondSuperseded).not.toHaveBeenCalled();

        // Events now flow ONLY to the new owner.
        lastInstance().onresult!(makeEvent([
            { transcript: 'fresh take ', isFinal: true },
        ]));
        expect(firstFinal).not.toHaveBeenCalled();
        expect(secondFinal).toHaveBeenCalledWith('fresh take ');
        expect(lastInstance().start).toHaveBeenCalledTimes(1); // engine never restarted
    });

    it('after supersession, engine end does not notify the deposed owner', async () => {
        const svc = await loadService();
        const firstEnd = vi.fn();
        const firstSuperseded = vi.fn();
        svc.startDictation({ onEnd: firstEnd, onSuperseded: firstSuperseded });
        svc.startDictation({ onEnd: vi.fn() });

        lastInstance().onend!();
        expect(firstEnd).not.toHaveBeenCalled();
        expect(firstSuperseded).toHaveBeenCalledTimes(1);
        expect(svc.isDictatingActive()).toBe(false);
    });

    it('queues a session started during the stop-in-flight window and starts it when the engine frees', async () => {
        const svc = await loadService();
        const firstSuperseded = vi.fn();
        const firstEnd = vi.fn();
        svc.startDictation({ onSuperseded: firstSuperseded, onEnd: firstEnd });

        // Release: stop() is requested but the engine's onend has NOT fired yet.
        svc.stopDictation();
        expect(lastInstance().stop).toHaveBeenCalledTimes(1);

        // Quick re-engage before the async end lands (release → talk again).
        const secondFinal = vi.fn();
        const secondEnd = vi.fn();
        expect(svc.startDictation({ onFinal: secondFinal, onEnd: secondEnd })).toBe(true);
        expect(firstSuperseded).toHaveBeenCalledTimes(1);
        // No start() yet — calling it mid-stop would throw InvalidStateError.
        expect(lastInstance().start).toHaveBeenCalledTimes(1);

        // Engine resolves the stop: the queued session starts, the old one never reports end.
        lastInstance().onend!();
        expect(lastInstance().start).toHaveBeenCalledTimes(2);
        expect(firstEnd).not.toHaveBeenCalled();
        expect(secondEnd).not.toHaveBeenCalled();
        expect(svc.isDictatingActive()).toBe(true);

        // Results flow to the NEW session.
        lastInstance().onresult!(makeEvent([{ transcript: 'fresh take ', isFinal: true }]));
        expect(secondFinal).toHaveBeenCalledWith('fresh take ');
    });

    it('separates final fragments that lack Chrome trailing spaces', async () => {
        const svc = await loadService();
        const finals: string[] = [];
        svc.startDictation({ onFinal: (t) => finals.push(t) });

        lastInstance().onresult!(makeEvent([{ transcript: 'hello', isFinal: true }]));
        lastInstance().onresult!(makeEvent([
            { transcript: 'hello', isFinal: true },
            { transcript: 'world', isFinal: true },
        ], 1));

        expect(finals.at(-1)).toBe('hello world');
    });

    it('legacy startListening supersedes a live dictation session and resets single-shot config', async () => {
        const svc = await loadService();
        const superseded = vi.fn();
        const dictEnd = vi.fn();
        svc.startDictation({ onSuperseded: superseded, onEnd: dictEnd });
        expect(lastInstance().continuous).toBe(true);

        const onResult = vi.fn();
        svc.startListening(onResult);

        expect(superseded).toHaveBeenCalledTimes(1);
        expect(svc.isDictatingActive()).toBe(false);
        expect(lastInstance().continuous).toBe(false);
        expect(lastInstance().interimResults).toBe(false);
        expect(lastInstance().start).toHaveBeenCalledTimes(2);

        lastInstance().onresult!(makeEvent([{ transcript: 'onboarded', isFinal: true }]));
        expect(onResult).toHaveBeenCalledWith('onboarded');
        expect(dictEnd).not.toHaveBeenCalled();
    });

    it('stopDictation discards a session queued during the stop-in-flight window', async () => {
        const svc = await loadService();
        svc.startDictation({});
        svc.stopDictation();

        const queuedEnd = vi.fn();
        expect(svc.startDictation({ onEnd: queuedEnd })).toBe(true);
        svc.stopDictation(); // Esc/cancel lands before the engine frees

        lastInstance().onend!();
        expect(lastInstance().start).toHaveBeenCalledTimes(1); // never restarted
        expect(queuedEnd).not.toHaveBeenCalled();
        expect(svc.isDictatingActive()).toBe(false);
    });

    it('stopDictationIfOwner stops only the session that still owns the engine', async () => {
        const svc = await loadService();
        const first = { onEnd: vi.fn() };
        const second = { onEnd: vi.fn() };
        svc.startDictation(first);
        svc.startDictation(second); // supersedes first

        svc.stopDictationIfOwner(first); // deposed owner — must not touch the engine
        expect(lastInstance().stop).not.toHaveBeenCalled();
        expect(svc.isDictatingActive()).toBe(true);

        svc.stopDictationIfOwner(second);
        expect(lastInstance().stop).toHaveBeenCalledTimes(1);
    });
});
