
// @vitest-environment node
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

describe('📚 Keeper: Electron HistoryStore Persistence', () => {
    let historyStore: any;
    let HistoryStoreClass: any;
    let fs: any;
    let path: any;
    let MOCK_TEMP_DIR: string;

    beforeAll(async () => {
        // Load dependencies dynamically to avoid hoisting conflicts
        fs = await import('fs');
        path = await import('path');
        const os = await import('os');

        MOCK_TEMP_DIR = path.join(os.tmpdir(), 'indii-keeper-test-persistence');
        console.log(`[Keeper] Testing persistence in: ${MOCK_TEMP_DIR}`);

        // Setup mock environment BEFORE importing the module under test

        // Mock Electron
        vi.doMock('electron', () => {
            const _os = require('os');
            const _path = require('path');
            const _tempDir = _path.join(_os.tmpdir(), 'indii-keeper-test-persistence');
            return {
                app: {
                    getPath: vi.fn(() => _tempDir)
                }
            };
        });

        // Mock electron-store
        vi.doMock('electron-store', () => {
            const _path = require('path');
            const _fs = require('fs');
            const _os = require('os');
            const _tempDir = _path.join(_os.tmpdir(), 'indii-keeper-test-persistence');

            return {
                default: class Store {
                    data: any = {};
                    path: string;

                    constructor(options: any) {
                        const cwd = options.cwd || _tempDir;
                        const name = options.name || 'config';
                        this.path = _path.join(cwd, `${name}.json`);

                        if (_fs.existsSync(this.path)) {
                            try {
                                this.data = JSON.parse(_fs.readFileSync(this.path, 'utf-8'));
                            } catch (e) {
                                this.data = options.defaults || {};
                            }
                        } else {
                            this.data = options.defaults || {};
                            this._save();
                        }
                    }

                    get(key: string) {
                        if (key.includes('.')) {
                            const parts = key.split('.');
                            let current = this.data;
                            for (const part of parts) {
                                if (current === undefined) return undefined;
                                current = current[part];
                            }
                            return current;
                        }
                        return this.data[key];
                    }

                    set(key: string, value: any) {
                        if (key.includes('.')) {
                            const parts = key.split('.');
                            const last = parts.pop()!;
                            let current = this.data;
                            for (const part of parts) {
                                if (!current[part]) current[part] = {};
                                current = current[part];
                            }
                            current[last] = value;
                        } else {
                            this.data[key] = value;
                        }
                        this._save();
                    }

                    delete(key: string) {
                        if (key.includes('.')) {
                            const parts = key.split('.');
                            const last = parts.pop()!;
                            let current = this.data;
                            for (const part of parts) {
                                if (current === undefined) return;
                                current = current[part];
                            }
                            if (current) delete current[last];
                        } else {
                            delete this.data[key];
                        }
                        this._save();
                    }

                    clear() {
                        this.data = { sessions: {} };
                        this._save();
                    }

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

        // Import module under test
        const module = await import('./HistoryStore');
        historyStore = module.historyStore;
        HistoryStoreClass = module.HistoryStore;

        // Ensure temp dir exists (redundant but safe)
        if (!fs.existsSync(MOCK_TEMP_DIR)) {
            fs.mkdirSync(MOCK_TEMP_DIR, { recursive: true });
        }
    });

    afterAll(() => {
        // Cleanup
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

    beforeEach(() => {
        if (historyStore) historyStore.clearAll();
    });

    it('should save session data to disk', () => {
        const sessionId = 'session-keeper-1';
        const data = {
            id: sessionId,
            messages: [{ role: 'user', content: 'Remember me' }],
            timestamp: Date.now()
        };

        // Act
        historyStore.save(sessionId, data);

        // Assert 1: Retrieval works
        const retrieved = historyStore.get(sessionId);
        expect(retrieved).toEqual(data);

        // Assert 2: File System Check (The "Keeper" Philosophy)
        const expectedFile = path.join(MOCK_TEMP_DIR, 'chat-history.json');
        expect(fs.existsSync(expectedFile)).toBe(true);

        const fileContent = fs.readFileSync(expectedFile, 'utf-8');
        const json = JSON.parse(fileContent);

        expect(json.sessions[sessionId]).toEqual(data);
    });

    it('should update existing session data correctly', () => {
        const sessionId = 'session-keeper-2';
        const initialData = { id: sessionId, step: 1 };

        historyStore.save(sessionId, initialData);

        const updateData = { step: 2, note: 'updated' };
        historyStore.save(sessionId, updateData);

        const result = historyStore.get(sessionId);
        expect(result).toEqual({ ...initialData, ...updateData });

        // Verify on disk
        const expectedFile = path.join(MOCK_TEMP_DIR, 'chat-history.json');
        const json = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
        expect(json.sessions[sessionId].step).toBe(2);
    });

    it('should permanently delete session data ("Privacy Scrub")', () => {
        const sessionId = 'session-to-forget';
        historyStore.save(sessionId, { secret: 'Illuminati' });

        expect(historyStore.get(sessionId)).toBeTruthy();

        // Act: Delete
        historyStore.delete(sessionId);

        // Assert: Gone from memory (HistoryStore returns null for missing sessions)
        expect(historyStore.get(sessionId)).toBeNull();

        // Assert: Gone from disk
        const expectedFile = path.join(MOCK_TEMP_DIR, 'chat-history.json');
        const json = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
        expect(json.sessions[sessionId]).toBeUndefined();
    });

    it('should persist data across "Cold Boot" (store re-instantiation)', () => {
        const sessionId = 'session-cold-boot';
        const data = { id: sessionId, important: 'Must persist' };

        // 1. Create a FRESH instance (simulating first run)
        const store1 = new HistoryStoreClass();
        store1.save(sessionId, data);

        // Verify it was written to disk
        const expectedFile = path.join(MOCK_TEMP_DIR, 'chat-history.json');
        const json1 = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
        expect(json1.sessions[sessionId]).toEqual(data);

        // 2. Create ANOTHER FRESH instance (simulating restart)
        // It should read from the same file because we mocked path/electron to point to MOCK_TEMP_DIR
        const store2 = new HistoryStoreClass();

        // Assert: It loads the data from disk
        const retrieved = store2.get(sessionId);
        expect(retrieved).toEqual(data);
    });
});
