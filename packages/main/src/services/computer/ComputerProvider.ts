/**
 * ComputerProvider — the swappable "Body" of the Computer Execution capability.
 *
 * CE-1 (ISSUE-1110): read path (screenshot, app list/open).
 * CE-2 (ISSUE-1111): input control (click/type/key/scroll). See docs/COMPUTER_EXECUTION_EXTENSION.md §3.3.
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
    /** OS-level input control — true once the provider has a working click/type backend. */
    input: boolean;
}

export type ClickButton = 'left' | 'right' | 'double';

export interface ComputerProvider {
    capabilities(): ComputerCapabilities;
    screenshot(displayId?: number): Promise<ComputerScreenshot>;
    /** Names of running, user-facing (non-background) applications. */
    listApps(): Promise<string[]>;
    /** Launch an application by bundle id (com.apple.Safari) or display name (Safari). */
    openApp(app: string): Promise<void>;

    /** Move the mouse to (x, y) and click. */
    click(x: number, y: number, button: ClickButton): Promise<void>;
    /** Type literal text at the current focus. */
    type(text: string): Promise<void>;
    /** Press a key combo, e.g. "return", "escape", "cmd+c". */
    key(combo: string): Promise<void>;
    /** Scroll the wheel by (dx, dy) pixels/units at the current pointer position. */
    scroll(dx: number, dy: number): Promise<void>;
}
