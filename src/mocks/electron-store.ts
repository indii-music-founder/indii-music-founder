/**
 * Mock for electron-store to allow browser builds (Vite) to pass.
 * This stores data in memory or localStorage if available.
 */
export default class Store<T = any> {
    private data: any = {};
    private name: string;

    constructor(options?: { name?: string; defaults?: any; cwd?: string }) {
        this.name = options?.name || 'config';
        this.data = options?.defaults || {};

        // Attempt to load from localStorage if available
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const stored = window.localStorage.getItem(this.name);
                if (stored) {
                    this.data = { ...this.data, ...JSON.parse(stored) };
                }
            } catch (e) {
                console.warn('[ElectronStore Mock] Failed to load from localStorage', e);
            }
        }
    }

    get(key: string): any {
        return this.data[key];
    }

    set(key: string, value: any): void {
        this.data[key] = value;
        this.persist();
    }

    clear(): void {
        this.data = {};
        this.persist();
    }

    // Helper to save to localStorage
    private persist() {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(this.name, JSON.stringify(this.data));
            } catch (e) {
                console.warn('[ElectronStore Mock] Failed to save to localStorage', e);
            }
        }
    }
}
