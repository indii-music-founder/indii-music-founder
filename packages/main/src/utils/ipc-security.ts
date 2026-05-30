import log from 'electron-log';
import { IpcMainInvokeEvent, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

function safeFileURLToPath(urlStr: string): string {
    if (typeof fileURLToPath === 'function') {
        return fileURLToPath(urlStr);
    }
    // Fallback for test environments where fileURLToPath import is mocked or missing
    if (urlStr.startsWith('file://')) {
        let p = urlStr.substring(7);
        // Remove localhost if present
        if (p.startsWith('localhost')) {
            p = p.substring(9);
        }
        // Decode URI components
        p = decodeURIComponent(p);
        // Convert Windows path if needed
        if (/^\/[A-Za-z]:/.test(p)) {
            p = p.substring(1);
        }
        return p;
    }
    return urlStr;
}

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
            const filePath = safeFileURLToPath(url);
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

            log.warn(`Security: Blocked unauthorized file URL: ${url}`);
        } catch (e) {
            log.error(`Security: Failed to validate file URL: ${url}`, e);
        }
        // Fall through to throw error if not returned
    }

    // 2. Allow Deep Links
    if (url.startsWith('indii:')) return;

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
