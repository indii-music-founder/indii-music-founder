import { systemPreferences } from 'electron';
import { ComputerProvider, ComputerScreenshot, ClickButton } from './computer/ComputerProvider';
import { NativeMacProvider } from './computer/NativeMacProvider';
import { NativeWinProvider } from './computer/NativeWinProvider';
import { computerAllowlistStore } from './computer/ComputerAllowlistStore';

export type PermissionState = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' | 'unsupported';

export interface ComputerPermissionStatus {
    platform: NodeJS.Platform;
    /** Whether this platform has a Computer provider at all. */
    supported: boolean;
    screenRecording: PermissionState;
    accessibility: PermissionState;
    /** Actionable, human-readable steps for any non-granted permission. */
    guidance: string[];
}

export interface ComputerSessionGrant {
    sessionId: string;
    grantedAt: number;
    expiresAt: number;
}

const DEFAULT_GRANT_TTL_MS = 15 * 60 * 1000; // 15 minutes — one drive session's worth of leeway

/**
 * ComputerExecutionService — main-process entry for the Computer capability.
 *
 * Owns platform detection, TCC permission preflight, the kill switch (ISSUE-1111 CE-2),
 * the app allowlist, session-scoped approval grants (ISSUE-1114 CE-5), and delegation to
 * the active ComputerProvider (macOS via NativeMacProvider, Windows via NativeWinProvider).
 *
 * Kill switch: every input-control method (click/type/key/scroll) checks the abort flag
 * BEFORE executing, per docs/COMPUTER_EXECUTION_EXTENSION.md §5.3. The flag is set by
 * either the renderer (IPC `computer:abort`) or a global hotkey registered in main.ts —
 * both routes exist so the user can always reclaim the machine even if the renderer
 * process is unresponsive.
 *
 * Session grants: a real, tested primitive (create/check/revoke/expire) for "approve once
 * per drive session instead of per action" — the UX relaxation ISSUE-1114 asks for. It is
 * NOT wired into any enforcement point here: real per-action approval enforcement doesn't
 * exist yet anywhere in the tool-dispatch path (see ISSUE-1116, logged separately). Wiring
 * a Computer-only enforcement check here would create a second, inconsistent approval
 * system alongside whatever ISSUE-1116 eventually builds platform-wide — so this class
 * exposes the grant primitive for that future wiring to consume, and stops there.
 */
export class ComputerExecutionService {
    private provider: ComputerProvider | null;
    private aborted = false;
    private grants = new Map<string, ComputerSessionGrant>();

    constructor(provider?: ComputerProvider | null) {
        this.provider = provider !== undefined
            ? provider
            : ComputerExecutionService.defaultProviderForPlatform();
    }

    private static defaultProviderForPlatform(): ComputerProvider | null {
        if (process.platform === 'darwin') return new NativeMacProvider();
        if (process.platform === 'win32') return new NativeWinProvider();
        return null;
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

    // --- Session-scoped approval grants (CE-5, ISSUE-1114) ------------------------

    grantSession(sessionId: string, ttlMs = DEFAULT_GRANT_TTL_MS): ComputerSessionGrant {
        const now = Date.now();
        const grant: ComputerSessionGrant = { sessionId, grantedAt: now, expiresAt: now + ttlMs };
        this.grants.set(sessionId, grant);
        return grant;
    }

    revokeGrant(sessionId: string): void {
        this.grants.delete(sessionId);
    }

    hasActiveGrant(sessionId: string, now = Date.now()): boolean {
        const grant = this.grants.get(sessionId);
        if (!grant) return false;
        if (grant.expiresAt <= now) {
            this.grants.delete(sessionId);
            return false;
        }
        return true;
    }

    getGrant(sessionId: string): ComputerSessionGrant | undefined {
        return this.hasActiveGrant(sessionId) ? this.grants.get(sessionId) : undefined;
    }

    // --- Permissions ---------------------------------------------------------

    getPermissionStatus(): ComputerPermissionStatus {
        const platform = process.platform;
        if (!this.provider) {
            return {
                platform,
                supported: false,
                screenRecording: 'unsupported',
                accessibility: 'unsupported',
                guidance: [`Computer control has no provider for platform "${platform}" in this build.`]
            };
        }

        if (platform === 'win32') {
            // Windows has no TCC-style screen/accessibility permission model to preflight —
            // PowerShell/SendKeys/mouse_event run under the same process privileges as indii.
            return { platform, supported: true, screenRecording: 'granted', accessibility: 'granted', guidance: [] };
        }

        if (platform !== 'darwin') {
            return {
                platform,
                supported: false,
                screenRecording: 'unsupported',
                accessibility: 'unsupported',
                guidance: ['Computer control supports macOS and Windows only in this build.']
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
            throw new Error(`Computer control is not supported on this platform ("${process.platform}"). Supported: macOS, Windows.`);
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
