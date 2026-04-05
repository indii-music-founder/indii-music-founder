import { IpcMainInvokeEvent, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

export function validateSender(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    if (!frame) {
        throw new Error("Security: Missing sender frame");
    }

    const url = frame.url;
    if (!url) {
        throw new Error("Security: Missing sender URL");
    }

    // 1. Allow Electron Production (File Protocol) - STRICT CHECK
    if (url.startsWith('file://')) {
        try {
            const filePath = fileURLToPath(url);
            const appPath = app.getAppPath();

            // Security: Ensure filePath is within appPath
            const rel = path.relative(appPath, filePath);

            // Check if contained:
            // 1. Not absolute (indicates different drive or outside on some systems)
            // 2. Does not start with '..' (indicates parent directory)
            // 3. Is not empty (unless we want to allow appPath itself, handled below)
            if (rel && !path.isAbsolute(rel) && !rel.startsWith('..')) {
                return;
            }

            // Allow exact match
            if (filePath === appPath) return;

            console.warn(`Security: Blocked unauthorized file URL: ${url}`);
        } catch (e) {
            console.error(`Security: Failed to validate file URL: ${url}`, e);
        }
        // Fall through to throw error if not returned
    }

    // 2. Allow Deep Links
    if (url.startsWith('indii-os:')) return;

    // 3. Allow Dev Server (Strict Origin Check)
    let devServerUrl = process.env.VITE_DEV_SERVER_URL;

    // Fallback for unpackaged dev mode (e.g. tests)
    if (!devServerUrl && !app.isPackaged) {
        devServerUrl = 'http://localhost:4242';
    }

    if (devServerUrl) {
        const normalizedDevUrl = devServerUrl.endsWith('/') ? devServerUrl : `${devServerUrl}/`;
        if (url === devServerUrl || url.startsWith(normalizedDevUrl)) {
            return;
        }
    }

    throw new Error(`Security: Unauthorized sender URL: ${url}`);
}
