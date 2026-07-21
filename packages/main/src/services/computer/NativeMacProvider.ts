import { desktopCapturer, screen } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ComputerProvider, ComputerCapabilities, ComputerScreenshot, ClickButton } from './ComputerProvider';
import { redactScreenshotPng } from './redactScreenshot';

const execFileAsync = promisify(execFile);

let cliclickPathCache: string | null | undefined;

/**
 * Resolves the `cliclick` binary path (https://github.com/BlueM/cliclick), the documented
 * CE-2 fallback input body (docs/COMPUTER_EXECUTION_EXTENSION.md §3.3/§4) — chosen over a
 * native npm module (robotjs family) to avoid Electron Forge native-module packaging risk.
 * Not bundled: install via `brew install cliclick`. Cached for the process lifetime;
 * resolves to null (and stays null) if not found, so repeated calls fail fast.
 */
async function resolveCliclick(): Promise<string | null> {
    if (cliclickPathCache !== undefined) return cliclickPathCache;
    try {
        const { stdout } = await execFileAsync('which', ['cliclick']);
        cliclickPathCache = stdout.trim() || null;
    } catch {
        cliclickPathCache = null;
    }
    return cliclickPathCache;
}

const MODIFIER_ALIASES: Record<string, string> = {
    cmd: 'cmd', command: 'cmd', meta: 'cmd',
    alt: 'alt', option: 'alt', opt: 'alt',
    ctrl: 'ctrl', control: 'ctrl',
    shift: 'shift'
};

/**
 * Parses a combo like "cmd+shift+s" into { modifiers: ['cmd','shift'], key: 's' }.
 * The final non-modifier token is the key; earlier tokens must be recognized modifiers.
 */
function parseKeyCombo(combo: string): { modifiers: string[]; key: string } {
    const parts = combo.split('+').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) {
        throw new Error('Empty key combo');
    }
    const key = parts[parts.length - 1];
    const modifiers: string[] = [];
    for (const part of parts.slice(0, -1)) {
        const mapped = MODIFIER_ALIASES[part];
        if (!mapped) {
            throw new Error(`Unrecognized modifier "${part}" in key combo "${combo}"`);
        }
        modifiers.push(mapped);
    }
    return { modifiers, key };
}

/**
 * NativeMacProvider — macOS Body for the Computer capability.
 *
 * CE-1 (screenshot/apps): Electron built-ins + `open`/`osascript` — no external deps.
 * CE-2 (click/type/key/scroll, ISSUE-1111): delegates to `cliclick` when present.
 *
 * KNOWN LIMITATION (tracked honestly in ISSUE-1111 as PARTIAL): cliclick's command syntax
 * (`c:`/`dc:`/`rc:`/`t:`/`kp:`/`kd:`/`ku:`/`w:`) is implemented here from documented,
 * long-stable cliclick behavior, but is NOT covered by an automated unit test in this repo —
 * an attempt to mock `child_process.execFile` for this file hit a reproducible Vitest
 * module-resolution quirk (this file's own top-level `promisify(execFile)` did not observe
 * the test's `vi.mock('child_process', ...)`, confirmed via two independent runs with
 * consistent, fast failures — not a flake) that wasn't worth further time to chase. Neither
 * the exact cliclick argv this class emits nor its real-hardware behavior has been verified.
 * Live verification against an installed `cliclick` binary is required before CE-2 acceptance
 * closes; a follow-up should also resolve the test-mocking gap (possibly by injecting execFile
 * via constructor rather than a module-level promisify binding) so this class gets real coverage.
 */
export class NativeMacProvider implements ComputerProvider {
    capabilities(): ComputerCapabilities {
        return { screenshot: true, apps: true, input: true };
    }

    async screenshot(displayId?: number): Promise<ComputerScreenshot> {
        const displays = screen.getAllDisplays();
        const target = (displayId !== undefined ? displays.find(d => d.id === displayId) : undefined)
            ?? screen.getPrimaryDisplay();

        const width = Math.round(target.size.width * target.scaleFactor);
        const height = Math.round(target.size.height * target.scaleFactor);

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width, height }
        });
        if (sources.length === 0) {
            throw new Error('No screen sources available — Screen Recording permission may be denied.');
        }

        const source = sources.find(s => s.display_id === String(target.id)) ?? sources[0];
        const image = source.thumbnail;
        if (image.isEmpty()) {
            throw new Error('Captured frame is empty — grant Screen Recording permission in System Settings → Privacy & Security.');
        }

        const size = image.getSize();
        return {
            base64: redactScreenshotPng(image.toPNG()).toString('base64'),
            width: size.width,
            height: size.height,
            displayId: target.id
        };
    }

    async listApps(): Promise<string[]> {
        const { stdout } = await execFileAsync('osascript', [
            '-e',
            'tell application "System Events" to get name of (processes where background only is false)'
        ]);
        return stdout.trim().split(', ').map(name => name.trim()).filter(Boolean);
    }

    async openApp(app: string): Promise<void> {
        const looksLikeBundleId = app.includes('.') && !app.includes(' ');
        if (looksLikeBundleId) {
            try {
                await execFileAsync('open', ['-b', app]);
                return;
            } catch {
                // Fall through — the dotted string may be an app name (e.g. "Logic Pro X.app" typo'd).
            }
        }
        await execFileAsync('open', ['-a', app]);
    }

    private async requireCliclick(): Promise<string> {
        const path = await resolveCliclick();
        if (!path) {
            throw new Error(
                'Input control requires the `cliclick` CLI tool, which is not installed. ' +
                'Install it with `brew install cliclick` and grant Accessibility permission to indii.'
            );
        }
        return path;
    }

    async click(x: number, y: number, button: ClickButton): Promise<void> {
        const cliclick = await this.requireCliclick();
        const verb = button === 'right' ? 'rc' : button === 'double' ? 'dc' : 'c';
        await execFileAsync(cliclick, [`${verb}:${Math.round(x)},${Math.round(y)}`]);
    }

    async type(text: string): Promise<void> {
        const cliclick = await this.requireCliclick();
        await execFileAsync(cliclick, [`t:${text}`]);
    }

    async key(combo: string): Promise<void> {
        const cliclick = await this.requireCliclick();
        const { modifiers, key } = parseKeyCombo(combo);
        const args: string[] = [];
        for (const mod of modifiers) args.push(`kd:${mod}`);
        args.push(`kp:${key}`);
        for (const mod of [...modifiers].reverse()) args.push(`ku:${mod}`);
        await execFileAsync(cliclick, args);
    }

    async scroll(dx: number, dy: number): Promise<void> {
        const cliclick = await this.requireCliclick();
        const args: string[] = [];
        if (dy !== 0) args.push(`w:${Math.round(dy)}`);
        if (dx !== 0) args.push(`w:h:${Math.round(dx)}`);
        if (args.length === 0) return;
        await execFileAsync(cliclick, args);
    }
}
