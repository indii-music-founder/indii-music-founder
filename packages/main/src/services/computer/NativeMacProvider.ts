import { desktopCapturer, screen } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ComputerProvider, ComputerCapabilities, ComputerScreenshot } from './ComputerProvider';

const execFileAsync = promisify(execFile);

/**
 * NativeMacProvider — macOS Body for the Computer capability (CE-1, ISSUE-1110).
 *
 * Uses only Electron built-ins and OS binaries (desktopCapturer, osascript, open) —
 * no native npm modules. Input control arrives in CE-2 via a dedicated input provider.
 *
 * macOS TCC note: without the Screen Recording permission, desktopCapturer succeeds
 * but returns blank frames. Callers must preflight via computer:check-permissions.
 */
export class NativeMacProvider implements ComputerProvider {
    capabilities(): ComputerCapabilities {
        return { screenshot: true, apps: true, input: false };
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
            base64: image.toPNG().toString('base64'),
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
        // Bundle ids (com.apple.Safari) use -b; display names (Safari) use -a.
        // Try the bundle-id route first for dotted, space-free identifiers, then fall back.
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
}
