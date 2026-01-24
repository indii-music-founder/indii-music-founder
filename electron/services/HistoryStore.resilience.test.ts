
// @vitest-environment node
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

describe('📚 Keeper: Electron HistoryStore Resilience', () => {
    let historyStore: any;
    let fs: any;
    let path: any;
    let MOCK_TEMP_DIR: string;

    beforeAll(async () => {
        // Load dependencies dynamically
        fs = await import('fs');
        path = await import('path');
        const os = await import('os');

        // Use a unique temp dir for this resilience test
        MOCK_TEMP_DIR = path.join(os.tmpdir(), 'indii-keeper-test-resilience');
        console.log(`[Keeper] Testing resilience in: ${MOCK_TEMP_DIR}`);

        // 1. Ensure clean slate
        if (fs.existsSync(MOCK_TEMP_DIR)) {
            fs.rmSync(MOCK_TEMP_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(MOCK_TEMP_DIR, { recursive: true });

        // 2. CORRUPTION INJECTION: Write invalid JSON file
        const corruptedFile = path.join(MOCK_TEMP_DIR, 'chat-history.json');
        const corruptedData = '{"sessions": { "incomplete... GARBAGE DATA';
        fs.writeFileSync(corruptedFile, corruptedData, 'utf-8');
        console.log('[Keeper] Injected corrupted JSON file.');

        // 3. Setup Mocks (mirroring the corruption environment)

        // Mock Electron
        vi.doMock('electron', () => {
            const _os = require('os');
            const _path = require('path');
            const _tempDir = _path.join(_os.tmpdir(), 'indii-keeper-test-resilience');
            return {
                app: {
                    getPath: vi.fn(() => _tempDir)
                }
            };
        });

        // Mock electron-store with the logic that SHOULD handle corruption
        vi.doMock('electron-store', () => {
            const _path = require('path');
            const _fs = require('fs');
            const _os = require('os');
            const _tempDir = _path.join(_os.tmpdir(), 'indii-keeper-test-resilience');

            return {
                default: class Store {
                    data: any = {};
                    path: string;

                    constructor(options: any) {
                        const cwd = options.cwd || _tempDir;
                        const name = options.name || 'config';
                        this.path = _path.join(cwd, `${name}.json`);

                        // This is the CRITICAL logic we are testing (simulation of electron-store behavior)
                        if (_fs.existsSync(this.path)) {
                            try {
                                const fileContent = _fs.readFileSync(this.path, 'utf-8');
                                this.data = JSON.parse(fileContent);
                            } catch (e) {
                                console.warn('[MockStore] JSON Parse Error detected (simulating recovery):', e);
                                // Default behavior of electron-store is to reset if clearInvalidConfig is true (default)
                                this.data = options.defaults || {};
                            }
                        } else {
                            this.data = options.defaults || {};
                            this._save();
                        }
                    }

                    get(key: string) {
                         if (key.includes('.')) {
                            // Simplified deep get for test
                            return undefined;
                         }
                         return this.data[key];
                    }

                    set(key: string, value: any) {
                        // Simplified set
                        this.data[key] = value; // Naive for test
                         if (key.includes('.')) {
                             // Handle sessions.ID
                             const parts = key.split('.');
                             if (parts[0] === 'sessions' && parts[1]) {
                                 if (!this.data.sessions) this.data.sessions = {};
                                 this.data.sessions[parts[1]] = value;
                             }
                         }
                        this._save();
                    }

                    delete(key: string) { delete this.data[key]; this._save(); }

                    clear() { this.data = { sessions: {} }; this._save(); }

                    _save() {
                        const dir = _path.dirname(this.path);
                        if (!_fs.existsSync(dir)) {
                            _fs.mkdirSync(dir, { recursive: true });
                        }
                        _fs.writeFileSync(this.path, JSON.stringify(this.data, null, 4));
                    }
                }
            };
        });

        // 4. Import module under test (Triggering initialization)
        try {
            const module = await import('./HistoryStore');
            historyStore = module.historyStore;
        } catch (e) {
            console.error('[Keeper] HistoryStore crashed during import:', e);
            throw e;
        }
    });

    afterAll(() => {
        if (fs && fs.existsSync(MOCK_TEMP_DIR)) {
            try {
                fs.rmSync(MOCK_TEMP_DIR, { recursive: true, force: true });
            } catch (e) {
                console.error('Cleanup failed', e);
            }
        }
        vi.doUnmock('electron');
        vi.doUnmock('electron-store');
    });

    it('should initialize without error despite corrupted file', () => {
        expect(historyStore).toBeDefined();
    });

    it('should have reset to default empty state', () => {
        // Since the file was garbage, it should have fallen back to defaults
        const sessions = historyStore.getAll();
        expect(sessions).toEqual([]);
    });

    it('should successfully save new data, overwriting corruption', () => {
        const sessionId = 'session-recovery-1';
        const data = { id: sessionId, text: 'I survived.' };

        // Act
        historyStore.save(sessionId, data);

        // Assert Memory
        const retrieved = historyStore.get(sessionId);
        expect(retrieved).toEqual(data);

        // Assert Disk (File should be valid JSON now)
        const expectedFile = path.join(MOCK_TEMP_DIR, 'chat-history.json');
        const content = fs.readFileSync(expectedFile, 'utf-8');

        let json;
        try {
            json = JSON.parse(content);
        } catch (e) {
            throw new Error('File on disk is still invalid JSON!');
        }

        expect(json.sessions[sessionId]).toEqual(data);
    });
});
