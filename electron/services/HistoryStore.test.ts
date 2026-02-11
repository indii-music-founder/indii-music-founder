/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Hoist the temp directory so it's fresh for each file but stable within the file
const mocks = vi.hoisted(() => {
    const os = require('os');
    const path = require('path');
    const suffix = Math.random().toString(36).substring(7);
    return {
        tempDir: path.join(os.tmpdir(), `indii-keeper-test-${suffix}`)
    };
});

// Mock Electron
vi.doMock('electron', () => ({
    app: {
        getPath: vi.fn(() => mocks.tempDir)
    }
}));

// Mock electron-store
vi.doMock('electron-store', () => {
    const _path = require('node:path');
    const _fs = require('node:fs');

    return {
        default: class Store {
            data: any = { sessions: {} };
            path: string;

            constructor(options: any = {}) {
                const cwd = options.cwd || mocks.tempDir;
                const name = options.name || 'config';
                this.path = _path.join(cwd, `${name}.json`);

                if (_fs.existsSync(this.path)) {
                    try {
                        this.data = JSON.parse(_fs.readFileSync(this.path, 'utf-8'));
                    } catch (e) {
                        this.data = options.defaults || { sessions: {} };
                    }
                } else {
                    this.data = options.defaults || { sessions: {} };
                    this._save();
                }
            }

            get(key: string) {
                if (key.includes('.')) {
                    const parts = key.split('.');
                    let current = this.data;
                    for (const part of parts) {
                        if (current === undefined || current === null) return undefined;
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
                        if (current === undefined || current === null) return;
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

describe('📚 Keeper: Electron HistoryStore Persistence', () => {
    let historyStore: any;
    let HistoryStoreClass: any;
    let fs: any;
    let path: any;

    beforeAll(async () => {
        fs = await import('node:fs');
        path = await import('node:path');

        console.log(`[Keeper] Testing persistence in: ${mocks.tempDir}`);

        const module = await import('./HistoryStore');
        HistoryStoreClass = module.HistoryStore;
    });

    beforeEach(() => {
        historyStore = new HistoryStoreClass();
        historyStore.clearAll();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        if (fs.existsSync(mocks.tempDir)) {
            fs.rmSync(mocks.tempDir, { recursive: true, force: true });
        }
    });

    it('should save session data to disk', async () => {
        const sessionId = 'test-session-1';
        const data = { messages: [], step: 1 };

        historyStore.save(sessionId, data);

        expect(historyStore.get(sessionId)).toEqual(data);

        const expectedFile = path.join(mocks.tempDir, 'chat-history.json');
        expect(fs.existsSync(expectedFile)).toBe(true);

        const fileContent = fs.readFileSync(expectedFile, 'utf-8');
        const json = JSON.parse(fileContent);
        expect(json.sessions[sessionId]).toEqual(data);
    });

    it('should update existing session data correctly', async () => {
        const sessionId = 'test-session-update';
        historyStore.save(sessionId, { step: 1 });
        historyStore.save(sessionId, { step: 2 });

        expect(historyStore.get(sessionId).step).toBe(2);

        const expectedFile = path.join(mocks.tempDir, 'chat-history.json');
        const json = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
        expect(json.sessions[sessionId].step).toBe(2);
    });

    it('should permanently delete session data', async () => {
        const sessionId = 'test-session-delete';
        historyStore.save(sessionId, { data: 'secret' });

        historyStore.delete(sessionId);

        expect(historyStore.get(sessionId)).toBeNull();

        const expectedFile = path.join(mocks.tempDir, 'chat-history.json');
        const json = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
        expect(json.sessions[sessionId]).toBeUndefined();
    });

    it('should persist data across "Cold Boot"', async () => {
        const sessionId = 'cold-boot-1';
        const data = { msg: 'survives restart' };

        historyStore.save(sessionId, data);

        const secondHistoryStore = new HistoryStoreClass();
        expect(secondHistoryStore.get(sessionId)).toEqual(data);
    });

    it('should handle missing data gracefully', async () => {
        expect(historyStore.get('non-existent')).toBeNull();
    });

    it('should handle corrupted JSON gracefully', async () => {
        const expectedFile = path.join(mocks.tempDir, 'chat-history.json');
        historyStore.save('valid', { ok: true });

        fs.writeFileSync(expectedFile, '{{ invalid { json }');

        const storeAfterCorruption = new HistoryStoreClass();
        expect(storeAfterCorruption.get('valid')).toBeNull();

        storeAfterCorruption.save('new', { ok: true });
        expect(storeAfterCorruption.get('new').ok).toBe(true);
    });
});
