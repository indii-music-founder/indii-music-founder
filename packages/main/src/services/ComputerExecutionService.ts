import { systemPreferences } from 'electron';
import { ComputerProvider, ComputerScreenshot } from './computer/ComputerProvider';
import { NativeMacProvider } from './computer/NativeMacProvider';

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
 * ComputerExecutionService — main-process entry for the Computer capability (CE-1, ISSUE-1110).
 *
 * Owns platform detection, TCC permission preflight, and delegation to the active
 * ComputerProvider. Windows lands in CE-5 (ISSUE-1114) behind the same interface.
 */
export class ComputerExecutionService {
    private provider: ComputerProvider | null;

    constructor(provider?: ComputerProvider | null) {
        this.provider = provider !== undefined
            ? provider
            : (process.platform === 'darwin' ? new NativeMacProvider() : null);
    }

    isSupported(): boolean {
        return this.provider !== null;
    }

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
            guidance.push('Accessibility control (needed for input actions in CE-2) is not granted: System Settings → Privacy & Security → Accessibility.');
        }

        return { platform, supported: true, screenRecording, accessibility, guidance };
    }

    private requireProvider(): ComputerProvider {
        if (!this.provider) {
            throw new Error('Computer control is not supported on this platform (macOS-only in CE-1; Windows tracked as ISSUE-1114).');
        }
        return this.provider;
    }

    async screenshot(displayId?: number): Promise<ComputerScreenshot> {
        return this.requireProvider().screenshot(displayId);
    }

    async listApps(): Promise<string[]> {
        return this.requireProvider().listApps();
    }

    async openApp(app: string): Promise<void> {
        return this.requireProvider().openApp(app);
    }
}

export const computerExecutionService = new ComputerExecutionService();
