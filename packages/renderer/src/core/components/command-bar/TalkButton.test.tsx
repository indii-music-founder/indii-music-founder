import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { TalkButton } from './TalkButton';
import { voiceService } from '@/services/intelligence/VoiceService';

vi.mock('@/services/intelligence/VoiceService', () => ({
    voiceService: {
        isSupported: vi.fn(() => true),
        startDictation: vi.fn(),
        stopDictation: vi.fn(),
        startListening: vi.fn(),
        stopListening: vi.fn(),
    },
}));

type Handlers = {
    onFinal?: (t: string) => void;
    onInterim?: (t: string) => void;
    onEnd?: () => void;
    onError?: (e: unknown) => void;
    onSuperseded?: () => void;
};

describe('TalkButton', () => {
    let captured: Handlers[];
    const onLiveText = vi.fn();
    const onSessionStart = vi.fn();
    const onRelease = vi.fn();
    const onNaturalEnd = vi.fn();
    const onMicError = vi.fn();
    const onStopAgent = vi.fn();
    const isAutoSendArmed = vi.fn(() => true);

    // Fake timers give EVERY caller (including React's scheduler) one consistent
    // clock — wall-clock Once-queues get eaten by framework internals mid-click.
    beforeEach(() => {
        vi.clearAllMocks();
        captured = [];
        vi.useFakeTimers();
        vi.mocked(voiceService.startDictation).mockImplementation(((handlers: Handlers) => {
            captured.push(handlers);
            return true;
        }) as never);
        vi.mocked(voiceService.isSupported).mockReturnValue(true);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const renderButton = (value = '') => render(
        <TalkButton
            value={value}
            onStopAgent={onStopAgent}
            onLiveText={onLiveText}
            onSessionStart={onSessionStart}
            onRelease={onRelease}
            onNaturalEnd={onNaturalEnd}
            onMicError={onMicError}
            isAutoSendArmed={isAutoSendArmed}
        />
    );

    it('opens the talkback channel on the first click and announces the session', () => {
        renderButton('base text');
        const btn = screen.getByTestId('talk-button');
        expect(btn.getAttribute('data-face')).toBe('idle');

        fireEvent.click(btn);

        expect(voiceService.startDictation).toHaveBeenCalledTimes(1);
        expect(onSessionStart).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('listening');
        expect(screen.getByTestId('talk-button').getAttribute('aria-label')).toBe('Release to send');
    });

    it('streams interim words into the live text on top of the base', () => {
        renderButton('base text');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;

        act(() => handlers.onInterim!('hello'));

        expect(onLiveText).toHaveBeenLastCalledWith('base text hello');
    });

    it('keeps finalized words stable while interim churns', () => {
        renderButton('');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;

        act(() => {
            handlers.onFinal!('locked words');
            handlers.onInterim!('fuzzy tail');
        });
        expect(onLiveText).toHaveBeenLastCalledWith('locked words fuzzy tail');

        act(() => handlers.onInterim!('different tail'));
        expect(onLiveText).toHaveBeenLastCalledWith('locked words different tail');
    });

    it('releases on the second click: stops mic and reports auto-send armed', () => {
        vi.setSystemTime(1_000_000);
        renderButton('base');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;
        act(() => {
            handlers.onFinal!('spoken words');
            handlers.onInterim!('tail');
        });

        vi.setSystemTime(1_000_600); // release well past the jitter window
        fireEvent.click(screen.getByTestId('talk-button'));

        expect(voiceService.stopDictation).toHaveBeenCalled();
        expect(onRelease).toHaveBeenCalledWith({ text: 'base spoken words tail', autoSend: true });
        expect(isAutoSendArmed).toHaveBeenCalled();
        expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('idle');
    });

    it('treats a near-instant second click as jitter: cancel, no send, revert to base', () => {
        vi.setSystemTime(2_000_000);
        renderButton('original');
        fireEvent.click(screen.getByTestId('talk-button'));

        vi.setSystemTime(2_000_010); // 10ms later — jitter
        fireEvent.click(screen.getByTestId('talk-button'));

        expect(onRelease).not.toHaveBeenCalled();
        expect(onLiveText).toHaveBeenCalledWith('original'); // reverted draft
        expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('idle');
    });

    it('Esc while listening cancels the take and reverts to base', () => {
        renderButton('keep me');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;
        act(() => handlers.onInterim!('draft nonsense'));

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(voiceService.stopDictation).toHaveBeenCalled();
        expect(onLiveText).toHaveBeenLastCalledWith('keep me');
        expect(onRelease).not.toHaveBeenCalled();
        expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('idle');
    });

    it('reports a natural engine end (silence) without sending', () => {
        renderButton('typed first');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;
        act(() => handlers.onFinal!(' finished phrase'));

        act(() => handlers.onEnd!());

        expect(onNaturalEnd).toHaveBeenCalledWith('typed first finished phrase');
        expect(onRelease).not.toHaveBeenCalled();
        expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('idle');
    });

    it('surfaces mic errors, exits the session, and reverts the draft', () => {
        renderButton('safe');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;
        act(() => handlers.onInterim!('half said'));

        act(() => handlers.onError!({ error: 'not-allowed' }));

        expect(onMicError).toHaveBeenCalledWith({ error: 'not-allowed' });
        expect(onLiveText).toHaveBeenLastCalledWith('safe');
        expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('idle');
    });

    it('swallows late engine errors after release (Chrome aborts on stop)', () => {
        vi.setSystemTime(3_000_000);
        renderButton('');
        fireEvent.click(screen.getByTestId('talk-button'));
        const handlers = captured[0]!;
        act(() => handlers.onFinal!('my sent take'));

        vi.setSystemTime(3_000_600);
        fireEvent.click(screen.getByTestId('talk-button'));
        expect(onRelease).toHaveBeenCalledTimes(1);

        // The engine's late 'aborted' error arrives after the session ended.
        act(() => handlers.onError!('aborted'));

        expect(onMicError).not.toHaveBeenCalled();
        // The input must NOT be reverted — the take was already sent.
        expect(onLiveText).not.toHaveBeenCalledWith('');
    });

    it('shows the Stop face while the agent is busy and wires the existing stop behavior', () => {
        render(
            <TalkButton
                value=""
                isAgentBusy
                onStopAgent={onStopAgent}
                onLiveText={onLiveText}
                onRelease={onRelease}
                onNaturalEnd={onNaturalEnd}
                onMicError={onMicError}
                isAutoSendArmed={isAutoSendArmed}
            />
        );

        const stopBtn = screen.getByTestId('command-bar-stop-btn');
        expect(stopBtn.getAttribute('aria-label')).toBe('Stop agent');

        fireEvent.click(stopBtn);
        expect(onStopAgent).toHaveBeenCalledTimes(1);
    });

    it('stands down when another surface takes the shared mic (no cross-talk)', () => {
        const aLive = vi.fn();
        const bLive = vi.fn();
        const aRelease = vi.fn();
        const bRelease = vi.fn();
        render(
            <>
                <TalkButton
                    value="overlay draft"
                    onLiveText={aLive}
                    onRelease={aRelease}
                    onNaturalEnd={onNaturalEnd}
                    onMicError={onMicError}
                    isAutoSendArmed={isAutoSendArmed}
                />
                <TalkButton
                    value="panel text"
                    onLiveText={bLive}
                    onRelease={bRelease}
                    onNaturalEnd={onNaturalEnd}
                    onMicError={onMicError}
                    isAutoSendArmed={isAutoSendArmed}
                />
            </>
        );
        const [btnA, btnB] = screen.getAllByTestId('talk-button');

        // Overlay opens the talkback channel first.
        fireEvent.click(btnA);
        const handlersA = captured[0]!;
        act(() => handlersA.onInterim!(' streamed words'));

        // Docked panel takes over; the real VoiceService notifies A via
        // onSuperseded (proven in VoiceService.dictation.test.ts).
        fireEvent.click(btnB);
        act(() => handlersA.onSuperseded!());

        // A stood down quietly — no release, no revert, no toast.
        expect(btnA.getAttribute('data-face')).toBe('idle');
        expect(aRelease).not.toHaveBeenCalled();
        expect(onMicError).not.toHaveBeenCalled();

        // Speech flows only to the new owner — never into A's input.
        act(() => captured[1]!.onInterim!('hello from panel'));
        expect(bLive).toHaveBeenLastCalledWith('panel text hello from panel');
    });

    it('renders disabled without a click path when speech is unsupported', () => {
        vi.mocked(voiceService.isSupported).mockReturnValue(false);
        render(
            <TalkButton
                value=""
                disabled
                onLiveText={onLiveText}
                onRelease={onRelease}
                onNaturalEnd={onNaturalEnd}
                onMicError={onMicError}
                isAutoSendArmed={isAutoSendArmed}
            />
        );

        const btn = screen.getByTestId('talk-button');
        expect(btn).toBeDisabled();
        fireEvent.click(btn);
        expect(voiceService.startDictation).not.toHaveBeenCalled();
    });
});
