import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: vi.fn(() => '/mock/user-data') }
}));

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('electron-store', () => ({
    default: class MockStore {
        store: Record<string, unknown>;
        path = '/mock/computer-allowlist.json';
        constructor(opts: { defaults: Record<string, unknown> }) {
            this.store = { ...opts.defaults };
        }
        get(key: string, fallback: unknown) { return this.store[key] ?? fallback; }
        set(key: string, val: unknown) { this.store[key] = val; }
    }
}));

import { ComputerAllowlistStore } from './ComputerAllowlistStore';

describe('ComputerAllowlistStore (fail-closed by default)', () => {
    let store: ComputerAllowlistStore;

    beforeEach(() => {
        store = new ComputerAllowlistStore();
    });

    it('denies every app when the list is empty (fail-closed default)', () => {
        expect(store.getAll()).toEqual([]);
        expect(store.isAllowed('Safari')).toBe(false);
        expect(store.isAllowed('com.apple.Safari')).toBe(false);
    });

    it('allows an app once added, case-insensitively', () => {
        store.add('Safari');
        expect(store.isAllowed('Safari')).toBe(true);
        expect(store.isAllowed('safari')).toBe(true);
        expect(store.isAllowed('SAFARI')).toBe(true);
        expect(store.isAllowed('Chrome')).toBe(false);
    });

    it('does not add duplicate entries', () => {
        store.add('Safari');
        store.add('safari');
        expect(store.getAll()).toEqual(['Safari']);
    });

    it('removes an app case-insensitively', () => {
        store.add('Safari');
        store.remove('SAFARI');
        expect(store.isAllowed('Safari')).toBe(false);
        expect(store.getAll()).toEqual([]);
    });

    it('ignores blank adds', () => {
        store.add('   ');
        expect(store.getAll()).toEqual([]);
    });
});
