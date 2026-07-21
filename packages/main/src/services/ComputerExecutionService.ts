import { systemPreferences } from 'electron';
import { ComputerProvider, ComputerScreenshot, ClickButton } from './computer/ComputerProvider';
import { NativeMacProvider } from './computer/NativeMacProvider';
import { computerAllowlistStore } from './computer/ComputerAllowlistStore';

export type PermissionState = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' | 'unsupported';

export interface ComputerPermissionStatus {
    platform: NodeJS.Platform;
    /** Whether this platform has a Computer provider at all (CE-1: macOS only). */
    supported: boolean;
    screenRecording: PermissionState;
    accessibility: PermissionState;
    /** Actionable, human-readable steps for any non-granted permission. */
    guidance: string[];
}

/**
 * ComputerExecutionService — main-process entry for the Computer capability.
 *
 * Owns platform detection, TCC permission preflight, the kill switch (ISSUE-1111 CE-2),
 * the app allowlist, and delegation to the active ComputerProvider. Windows lands in
 * CE-5 (ISSUE-1114) behind the same interface.
 *
 * Kill switch: every input-control method (click/type/key/scroll) checks the abort flag
 * BEFORE executing, per docs/COMPUTER_EXECUTION_EXTENSION.md §5.3. The flag is set by
 * either the renderer (IPC `computer:abort`) or a global hotkey registered in main.ts —
 * both routes exist so the user can always reclaim the machine even if the renderer
 * process is unresponsive.
 */
export class ComputerExecutionService {
    private provider: ComputerProvider | null;
    private aborted = false;

    constructor(provider?: ComputerProvider | null) {
        this.provider = provider !== undefined
            ? provider
            : (process.platform === 'darwin' ? new NativeMacProvider() : null);
    }

    isSupported(): boolean {
        return this.provider !== null;
    }

    // --- Kill switch -------------------------------------------------------

    abort(): void {
        this.aborted = true;
    }

    resetAbort(): void {
        this.aborted = false;
    }

    isAborted(): boolean {
        return this.aborted;
    }

    private checkNotAborted(): void {
        if (this.aborted) {
            throw new Error('Computer control was aborted (kill switch active). Call computer:reset-abort to resume.');
        }
    }

    // --- Permissions ---------------------------------------------------------

    getPermissionStatus(): ComputerPermissionStatus {
        const platform = process.platform;
        if (platform !== 'darwin' || !this.provider) {
            return {
                platform,
                supported: false,
                screenRecording: 'unsupported',
                accessibility: 'unsupported',
                guidance: [`Computer control is macOS-only in this build. Windows support is tracked as ISSUE-1114 (CE-5).`]
            };
        }

        const screenRecording = (systemPreferences.getMediaAccessStatus?.('screen') ?? 'unknown') as PermissionState;
        const accessibility: PermissionState = systemPreferences.isTrustedAccessibilityClient?.(false)
            ? 'granted'
            : 'denied';

        const guidance: string[] = [];
        if (screenRecording !== 'granted') {
            guidance.push('Grant Screen Recording to indii in System Settings → Privacy & Security → Screen & System Audio Recording, then restart the app.');
        }
        if (accessibility !== 'granted') {
            guidance.push('Grant Accessibility to indii in System Settings → Privacy & Security → Accessibility (required for click/type/key/scroll).');
        }

        return { platform, supported: true, screenRecording, accessibility, guidance };
    }

    private requireProvider(): ComputerProvider {
        if (!this.provider) {
            throw new Error('Computer control is not supported on this platform (macOS-only in CE-1/CE-2; Windows tracked as ISSUE-1114).');
        }
        return this.provider;
    }

    // --- Read path (CE-1) -----------------------------------------------------

    async screenshot(displayId?: number): Promise<ComputerScreenshot> {
        return this.requireProvider().screenshot(displayId);
    }

    async listApps(): Promise<string[]> {
        return this.requireProvider().listApps();
    }

    async openApp(app: string): Promise<void> {
        if (!computerAllowlistStore.isAllowed(app)) {
            throw new Error(
                `App "${app}" is not on the computer-control allowlist. ` +
                `Add it via the allowlist store before it can be launched by an agent.`
            );
        }
        return this.requireProvider().openApp(app);
    }

    // --- Input control (CE-2, ISSUE-1111) --------------------------------------

    async click(x: number, y: number, button: ClickButton): Promise<void> {
        this.checkNotAborted();
        return this.requireProvider().click(x, y, button);
    }

    async type(text: string): Promise<void> {
        this.checkNotAborted();
        return this.requireProvider().type(text);
    }

    async key(combo: string): Promise<void> {
        this.checkNotAborted();
        return this.requireProvider().key(combo);
    }

    async scroll(dx: number, dy: number): Promise<void> {
        this.checkNotAborted();
        return this.requireProvider().scroll(dx, dy);
    }
}

export const computerExecutionService = new ComputerExecutionService();
