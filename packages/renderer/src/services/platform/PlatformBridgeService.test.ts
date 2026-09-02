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
            expect(caps.canCompileVideoPreview).toBe(false);
            expect(caps.canRenderVideoLocally).toBe(false);
            expect(bridge.isElectron()).toBe(false);
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
