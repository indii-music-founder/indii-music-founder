import Store from 'electron-store';
import { app } from 'electron';
import log from 'electron-log';

/**
 * ComputerAllowlistStore — main-process app allowlist for computer_open_app (ISSUE-1111 CE-2).
 *
 * Fail-closed by default: an empty allowlist means NO app may be launched by an agent.
 * This is a deliberate security posture (docs/COMPUTER_EXECUTION_EXTENSION.md §5.4 — "app
 * allowlist enforced in the main process, not the renderer") and matches the fail-closed
 * convention used elsewhere in this codebase (BROWSER_DESKTOP_ONLY, Web3Tools). There is no
 * renderer-facing management UI yet; the list is edited via this store's persisted JSON
 * (`computer-allowlist.json` in userData) until a settings surface is built.
 *
 * Matching is case-insensitive and accepts either a bundle id (com.apple.Safari) or the
 * app display name (Safari) — whichever form the entry and the request use, they must match.
 */
interface AllowlistSchema {
    apps: string[];
}

export class ComputerAllowlistStore {
    private _store: Store<AllowlistSchema> | undefined;

    private get store(): Store<AllowlistSchema> {
        if (!this._store) {
            this._store = new Store<AllowlistSchema>({
                name: 'computer-allowlist',
                cwd: app.getPath('userData'),
                defaults: { apps: [] }
            });
            log.info('[ComputerAllowlistStore] Initialized at:', (this._store as unknown as { path: string }).path);
        }
        return this._store;
    }

    getAll(): string[] {
        // @ts-expect-error — electron-store's type defs don't surface Conf's inherited get/set
        return this.store.get('apps', []);
    }

    isAllowed(app: string): boolean {
        const needle = app.trim().toLowerCase();
        return this.getAll().some(entry => entry.trim().toLowerCase() === needle);
    }

    add(app: string): void {
        const trimmed = app.trim();
        if (!trimmed) return;
        const current = this.getAll();
        if (!current.some(e => e.toLowerCase() === trimmed.toLowerCase())) {
            // @ts-expect-error — electron-store's type defs don't surface Conf's inherited get/set
            this.store.set('apps', [...current, trimmed]);
        }
    }

    remove(app: string): void {
        const needle = app.trim().toLowerCase();
        // @ts-expect-error — electron-store's type defs don't surface Conf's inherited get/set
        this.store.set('apps', this.getAll().filter(e => e.toLowerCase() !== needle));
    }
}

export const computerAllowlistStore = new ComputerAllowlistStore();
