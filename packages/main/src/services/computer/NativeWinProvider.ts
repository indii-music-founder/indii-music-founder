import { desktopCapturer, screen } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ComputerProvider, ComputerCapabilities, ComputerScreenshot, ClickButton } from './ComputerProvider';
import { redactScreenshotPng } from './redactScreenshot';

const execFileAsync = promisify(execFile);

const MODIFIER_ALIASES: Record<string, string> = {
    cmd: '^', command: '^', meta: '^', ctrl: '^', control: '^', // Windows has no Cmd key; map to Ctrl (SendKeys ^)
    alt: '%', option: '%', opt: '%',
    shift: '+',
};

// SendKeys reserves + ^ % ~ ( ) { } [ ] — a bare key must be wrapped in braces if it collides.
const SENDKEYS_SPECIAL = new Set(['+', '^', '%', '~', '(', ')', '{', '}', '[', ']']);

function toSendKeysToken(key: string): string {
    if (SENDKEYS_SPECIAL.has(key)) return `{${key}}`;
    const NAMED: Record<string, string> = {
        return: '{ENTER}', enter: '{ENTER}', escape: '{ESC}', esc: '{ESC}',
        tab: '{TAB}', space: ' ', backspace: '{BACKSPACE}', delete: '{DELETE}',
        'arrow-up': '{UP}', 'arrow-down': '{DOWN}', 'arrow-left': '{LEFT}', 'arrow-right': '{RIGHT}',
        home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}',
    };
    return NAMED[key] ?? key;
}

function parseKeyCombo(combo: string): { modifiers: string[]; key: string } {
    const parts = combo.split('+').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) throw new Error('Empty key combo');
    const key = parts[parts.length - 1];
    const modifiers: string[] = [];
    for (const part of parts.slice(0, -1)) {
        const mapped = MODIFIER_ALIASES[part];
        if (!mapped) throw new Error(`Unrecognized modifier "${part}" in key combo "${combo}"`);
        modifiers.push(mapped);
    }
    return { modifiers, key };
}

async function runPowerShell(script: string): Promise<string> {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    return stdout;
}

/**
 * NativeWinProvider — Windows Body for the Computer capability (CE-5, ISSUE-1114).
 *
 * screenshot() reuses the identical Electron desktopCapturer/screen API used by
 * NativeMacProvider — that part is genuinely cross-platform, not Windows-specific code.
 * Everything else shells out to PowerShell (bundled with Windows, no external install
 * required, unlike the mac path's optional cliclick dependency).
 *
 * KNOWN LIMITATION (same honesty posture as NativeMacProvider, tracked in ISSUE-1114):
 * this class has NOT been exercised against real Windows hardware or a real Electron
 * process on Windows — this environment has no Windows machine to test against. The
 * SendKeys token mapping and mouse_event P/Invoke are implemented from documented,
 * long-stable .NET/Win32 APIs, but the exact PowerShell invocations are unverified live.
 * Live verification on real Windows hardware is required before this closes.
 */
export class NativeWinProvider implements ComputerProvider {
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
            throw new Error('No screen sources available.');
        }

        const source = sources.find(s => s.display_id === String(target.id)) ?? sources[0];
        const image = source.thumbnail;
        if (image.isEmpty()) {
            throw new Error('Captured frame is empty.');
        }

        const size = image.getSize();
        const redacted = redactScreenshotPng(image.toPNG());
        return {
            base64: redacted.toString('base64'),
            width: size.width,
            height: size.height,
            displayId: target.id
        };
    }

    async listApps(): Promise<string[]> {
        const stdout = await runPowerShell(
            "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty ProcessName -Unique"
        );
        return stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }

    async openApp(app: string): Promise<void> {
        // cmd.exe's `start` builtin resolves both a bare exe name on PATH and a full path/URI.
        // The empty "" first argument is the required window-title placeholder for `start`.
        await execFileAsync('cmd.exe', ['/c', 'start', '""', app]);
    }

    async click(x: number, y: number, button: ClickButton): Promise<void> {
        const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class MouseSim {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int flags, int dx, int dy, int data, int extraInfo);
}'
${button === 'right'
    ? '[MouseSim]::mouse_event(0x0008, 0, 0, 0, 0); [MouseSim]::mouse_event(0x0010, 0, 0, 0, 0)'
    : button === 'double'
        ? '[MouseSim]::mouse_event(0x0002, 0, 0, 0, 0); [MouseSim]::mouse_event(0x0004, 0, 0, 0, 0); [MouseSim]::mouse_event(0x0002, 0, 0, 0, 0); [MouseSim]::mouse_event(0x0004, 0, 0, 0, 0)'
        : '[MouseSim]::mouse_event(0x0002, 0, 0, 0, 0); [MouseSim]::mouse_event(0x0004, 0, 0, 0, 0)'}
`;
        await runPowerShell(script);
    }

    async type(text: string): Promise<void> {
        // SendKeys.SendWait escapes its own special characters via braces; a literal
        // single-quote in the PowerShell string must be doubled to avoid breaking out.
        const escaped = text.replace(/'/g, "''").replace(/([+^%~(){}[\]])/g, '{$1}');
        const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
        await runPowerShell(script);
    }

    async key(combo: string): Promise<void> {
        const { modifiers, key } = parseKeyCombo(combo);
        const sendKeysCombo = modifiers.join('') + toSendKeysToken(key);
        const escaped = sendKeysCombo.replace(/'/g, "''");
        const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
        await runPowerShell(script);
    }

    async scroll(dx: number, dy: number): Promise<void> {
        if (dx === 0 && dy === 0) return;
        const script = `
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WheelSim {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int flags, int dx, int dy, int data, int extraInfo);
}'
${dy !== 0 ? `[WheelSim]::mouse_event(0x0800, 0, 0, ${Math.round(dy * -120)}, 0)` : ''}
${dx !== 0 ? `[WheelSim]::mouse_event(0x1000, 0, 0, ${Math.round(dx * 120)}, 0)` : ''}
`;
        await runPowerShell(script);
    }
}
