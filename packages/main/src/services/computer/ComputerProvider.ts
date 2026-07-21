/**
 * ComputerProvider — the swappable "Body" of the Computer Execution capability.
 *
 * CE-1 (ISSUE-1110) scope: read path only (screenshot, app list/open).
 * CE-2 (ISSUE-1111) extends this interface with input control (click/type/key/scroll)
 * behind the kill switch and app allowlist. See docs/COMPUTER_EXECUTION_EXTENSION.md §3.3.
 */

export interface ComputerScreenshot {
    /** PNG image data, base64-encoded. */
    base64: string;
    width: number;
    height: number;
    displayId: number;
}

export interface ComputerCapabilities {
    screenshot: boolean;
    apps: boolean;
    /** OS-level input control — false until CE-2 lands. */
    input: boolean;
}

export interface ComputerProvider {
    capabilities(): ComputerCapabilities;
    screenshot(displayId?: number): Promise<ComputerScreenshot>;
    /** Names of running, user-facing (non-background) applications. */
    listApps(): Promise<string[]>;
    /** Launch an application by bundle id (com.apple.Safari) or display name (Safari). */
    openApp(app: string): Promise<void>;
}
