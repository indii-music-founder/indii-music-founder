import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElectronPlatformAdapter, platformBridge } from './PlatformBridgeService';

describe('PlatformBridgeService', () => {
    const mockSelectDirectory = vi.fn();
    const mockSelectFile = vi.fn();
    const mockCompilePreview = vi.fn();
    const mockRender = vi.fn();
    const mockSaveHistory = vi.fn();
    const mockDeleteHistory = vi.fn();
    const mockGetPlatform = vi.fn();
    const mockGetAppVersion = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when running in Electron desktop environment', () => {
        beforeEach(() => {
            vi.stubGlobal('window', {
                electronAPI: {
                    getPlatform: mockGetPlatform.mockResolvedValue('darwin'),
                    getAppVersion: mockGetAppVersion.mockResolvedValue('1.80.1'),
                    selectDirectory: mockSelectDirectory.mockResolvedValue('/Users/artist/Music'),
                    selectFile: mockSelectFile.mockResolvedValue('/Users/artist/master.wav'),
                    video: {
                        compilePreview: mockCompilePreview.mockResolvedValue('<html>preview</html>'),
                        render: mockRender.mockResolvedValue('/path/to/rendered.mp4'),
                    },
                    agent: {
                        saveHistory: mockSaveHistory.mockResolvedValue(undefined),
                        deleteHistory: mockDeleteHistory.mockResolvedValue(undefined),
                    },
                },
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('reports electron capabilities accurately', () => {
            const bridge = new ElectronPlatformAdapter();
            const caps = bridge.getCapabilities();

            expect(caps.isElectron).toBe(true);
            expect(caps.canSelectDirectory).toBe(true);
            expect(caps.canSelectFile).toBe(true);
            expect(caps.canCompileVideoPreview).toBe(true);
            expect(caps.canRenderVideoLocally).toBe(true);
            expect(caps.canPersistLocalHistory).toBe(true);
            expect(bridge.isElectron()).toBe(true);
        });

        it('delegates selectDirectory to electronAPI', async () => {
            const bridge = new ElectronPlatformAdapter();
            const result = await bridge.selectDirectory({ title: 'Select Exports' });

            expect(mockSelectDirectory).toHaveBeenCalledWith({ title: 'Select Exports' });
            expect(result).toBe('/Users/artist/Music');
        });

        it('delegates compileVideoPreview to electronAPI', async () => {
            const bridge = new ElectronPlatformAdapter();
            const dummyProject = { clips: [], tracks: [] } as any;
            const result = await bridge.compileVideoPreview(dummyProject);

            expect(mockCompilePreview).toHaveBeenCalledWith(dummyProject);
            expect(result).toBe('<html>preview</html>');
        });

        it('delegates saveHistory and deleteHistory to electronAPI', async () => {
            const bridge = new ElectronPlatformAdapter();
            await bridge.saveHistory('session-1', { messages: [] });
            expect(mockSaveHistory).toHaveBeenCalledWith('session-1', { messages: [] });

            await bridge.deleteHistory('session-1');
            expect(mockDeleteHistory).toHaveBeenCalledWith('session-1');
        });
    });

    describe('when running in Web browser environment', () => {
        beforeEach(() => {
            vi.stubGlobal('window', {});
            // Mock localStorage
            const storage = new Map<string, string>();
            vi.stubGlobal('localStorage', {
                getItem: (k: string) => storage.get(k) ?? null,
                setItem: (k: string, v: string) => storage.set(k, v),
                removeItem: (k: string) => storage.delete(k),
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('reports web capabilities accurately', () => {
            const bridge = new ElectronPlatformAdapter();
            const caps = bridge.getCapabilities();

            expect(caps.isElectron).toBe(false);
            expect(caps.canSelectDirectory).toBe(false);
            // The pure-TS compiler runs in the browser: live compiled preview
            // is no longer desktop-only.
            expect(caps.canCompileVideoPreview).toBe(true);
            expect(caps.canRenderVideoLocally).toBe(false);
            expect(bridge.isElectron()).toBe(false);
        });

        it('compiles the live preview locally with the shared pure compiler', async () => {
            // jsdom lacks URL.createObjectURL; stub the blob factory path.
            const createObjectURL = vi.fn(() => 'blob:web-preview-timeline');
            (URL as unknown as { createObjectURL?: unknown }).createObjectURL = createObjectURL;

            try {
                const bridge = new ElectronPlatformAdapter();
                const project = {
                    id: 'web-cap',
                    name: 'Web capability',
                    fps: 30,
                    width: 320,
                    height: 180,
                    durationInFrames: 30,
                    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
                    clips: [{
                        id: 'c1', type: 'video', src: 'input.mp4', name: 'src',
                        startFrame: 0, durationInFrames: 30, trackId: 't1',
                        sourceInUs: 0, sourceOutUs: 1_000_000,
                    }],
                };
                const html = await bridge.compileVideoPreview(project);

                expect(mockCompilePreview).not.toHaveBeenCalled();
                expect(html).toContain('<script src="/gsap.min.js"></script>');
                expect(html).toContain('<script src="/hyperframe.runtime.iife.js"></script>');
                expect(html).toContain('<script src="blob:web-preview-timeline"></script>');
                expect(html).not.toContain('<script src="./gsap.min.js"></script>');
            } finally {
                delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
            }
        });

        it('throws descriptive error on selectDirectory without crashing', async () => {
            const bridge = new ElectronPlatformAdapter();
            await expect(bridge.selectDirectory()).rejects.toThrow('desktop application');
        });

        it('falls back to localStorage for history persistence without throwing', async () => {
            const bridge = new ElectronPlatformAdapter();
            await bridge.saveHistory('session-web', { title: 'Web Chat' });
            expect(localStorage.getItem('indii_session_history_session-web')).toBe(JSON.stringify({ title: 'Web Chat' }));

            await bridge.deleteHistory('session-web');
            expect(localStorage.getItem('indii_session_history_session-web')).toBeNull();
        });

        it('exports a default singleton platformBridge instance', () => {
            expect(platformBridge).toBeInstanceOf(ElectronPlatformAdapter);
        });
    });
});
