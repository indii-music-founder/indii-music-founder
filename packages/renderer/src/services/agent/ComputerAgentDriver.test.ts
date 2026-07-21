import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    generateContent: vi.fn(),
    parseJSON: vi.fn(),
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: mocks.generateContent,
        parseJSON: mocks.parseJSON,
    },
    getResponseText: (response: unknown) => (response as { text?: string })?.text ?? ''
}));

import { ComputerAgentDriver } from './ComputerAgentDriver';

function granted() {
    return {
        success: true,
        data: { platform: 'darwin', supported: true, screenRecording: 'granted', accessibility: 'granted', guidance: [] as string[] }
    };
}

function shot(n = 1) {
    return { success: true, data: { base64: `frame-${n}`, width: 100, height: 100, displayId: 1 } };
}

describe('ComputerAgentDriver (CE-3, ISSUE-1112)', () => {
    let driver: ComputerAgentDriver;
    let computerApi: {
        checkPermissions: ReturnType<typeof vi.fn>;
        screenshot: ReturnType<typeof vi.fn>;
        getAbortState: ReturnType<typeof vi.fn>;
        click: ReturnType<typeof vi.fn>;
        type: ReturnType<typeof vi.fn>;
        key: ReturnType<typeof vi.fn>;
        scroll: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        driver = new ComputerAgentDriver();
        computerApi = {
            checkPermissions: vi.fn().mockResolvedValue(granted()),
            screenshot: vi.fn().mockResolvedValue(shot()),
            getAbortState: vi.fn().mockResolvedValue({ success: true, data: { aborted: false } }),
            click: vi.fn().mockResolvedValue({ success: true }),
            type: vi.fn().mockResolvedValue({ success: true }),
            key: vi.fn().mockResolvedValue({ success: true }),
            scroll: vi.fn().mockResolvedValue({ success: true }),
        };
         
        (window as any).electronAPI = { computer: computerApi };
    });

    it('fails fast without calling the model when the Computer API is unavailable', async () => {
         
        (window as any).electronAPI = undefined;
        await expect(driver.drive('do something')).rejects.toThrow(/Electron Computer API not available/);
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it('fails preflight without calling the model when permissions are not granted', async () => {
        computerApi.checkPermissions.mockResolvedValue({
            success: true,
            data: { platform: 'darwin', supported: true, screenRecording: 'denied', accessibility: 'granted', guidance: ['Grant Screen Recording...'] }
        });
        const result = await driver.drive('do something');
        expect(result.success).toBe(false);
        expect(result.steps).toBe(0);
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it('fails preflight without calling the model when the platform is unsupported', async () => {
        computerApi.checkPermissions.mockResolvedValue({
            success: true,
            data: { platform: 'win32', supported: false, screenRecording: 'unsupported', accessibility: 'unsupported', guidance: ['ISSUE-1114'] }
        });
        const result = await driver.drive('do something');
        expect(result.success).toBe(false);
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it('stops immediately when the kill switch is already active before the first step', async () => {
        computerApi.getAbortState.mockResolvedValue({ success: true, data: { aborted: true } });
        const result = await driver.drive('do something');
        expect(result.success).toBe(false);
        expect(result.steps).toBe(1);
        expect(mocks.generateContent).not.toHaveBeenCalled();
        expect(computerApi.click).not.toHaveBeenCalled();
    });

    it('completes on a single-step finish plan and never calls an input primitive', async () => {
        mocks.generateContent.mockResolvedValue({ text: '{}' });
        mocks.parseJSON.mockReturnValue({ thought: 'done', action: 'finish' });

        const result = await driver.drive('take a screenshot and confirm it worked', 5);

        expect(result.success).toBe(true);
        expect(result.steps).toBe(1);
        expect(computerApi.click).not.toHaveBeenCalled();
        expect(computerApi.type).not.toHaveBeenCalled();
    });

    it('stops on a fail plan without touching input primitives', async () => {
        mocks.generateContent.mockResolvedValue({ text: '{}' });
        mocks.parseJSON.mockReturnValue({ thought: 'refusing', action: 'fail', params: { reason: 'credential field detected' } });

        const result = await driver.drive('log into the bank site', 5);

        expect(result.success).toBe(false);
        expect(result.logs.some(l => /credential field detected/.test(l))).toBe(true);
        expect(computerApi.click).not.toHaveBeenCalled();
        expect(computerApi.type).not.toHaveBeenCalled();
    });

    it('dispatches a click action then re-screenshots before the next step', async () => {
        mocks.generateContent
            .mockResolvedValueOnce({ text: '{}' })
            .mockResolvedValueOnce({ text: '{}' });
        mocks.parseJSON
            .mockReturnValueOnce({ thought: 'click button', action: 'click', params: { x: 42, y: 84, button: 'left' } })
            .mockReturnValueOnce({ thought: 'done', action: 'finish' });

        const result = await driver.drive('click the button then finish', 5);

        expect(result.success).toBe(true);
        expect(computerApi.click).toHaveBeenCalledWith(42, 84, 'left');
        expect(computerApi.screenshot).toHaveBeenCalledTimes(2); // initial + post-click
        expect(result.steps).toBe(2);
    });

    it('checks the kill switch again immediately before dispatch, after the (slow) reasoning call', async () => {
        let abortCallCount = 0;
        computerApi.getAbortState.mockImplementation(() => {
            abortCallCount++;
            // First check (top of loop) says not aborted; second check (pre-dispatch) says aborted.
            return Promise.resolve({ success: true, data: { aborted: abortCallCount >= 2 } });
        });
        mocks.generateContent.mockResolvedValue({ text: '{}' });
        mocks.parseJSON.mockReturnValue({ thought: 'click button', action: 'click', params: { x: 1, y: 1 } });

        const result = await driver.drive('click something', 5);

        expect(result.success).toBe(false);
        expect(computerApi.click).not.toHaveBeenCalled();
    });

    it('respects maxSteps and stops without infinite-looping on a model that never finishes', async () => {
        mocks.generateContent.mockResolvedValue({ text: '{}' });
        mocks.parseJSON.mockReturnValue({ thought: 'scrolling forever', action: 'scroll', params: { dx: 0, dy: 10 } });

        const result = await driver.drive('scroll to find something', 3);

        expect(result.success).toBe(false);
        expect(result.steps).toBe(3);
        expect(computerApi.scroll).toHaveBeenCalledTimes(3);
    });

    it('hashScreenshot returns a stable, distinct SHA-256 hex digest per input', async () => {
        const h1 = await driver.hashScreenshot('frame-a');
        const h2 = await driver.hashScreenshot('frame-a');
        const h3 = await driver.hashScreenshot('frame-b');
        expect(h1).toBe(h2);
        expect(h1).not.toBe(h3);
        expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });
});
