import { IpcMainInvokeEvent, app } from 'electron';
import path from 'path';

export function validateSender(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    if (!frame) {
        throw new Error("Security: Missing sender frame");
    }

    const url = frame.url;
    if (!url) {
        throw new Error("Security: Missing sender URL");
    }

    // 1. Allow Electron Production (File Protocol)
    if (url.startsWith('file://')) return;

    // 2. Allow Deep Links
    if (url.startsWith('indii-os:')) return;

    // 3. Allow Dev Server (Strict Origin Check)
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        const normalizedDevUrl = devServerUrl.endsWith('/') ? devServerUrl : `${devServerUrl}/`;
        if (url === devServerUrl || url.startsWith(normalizedDevUrl)) {
            return;
        }
    }

    throw new Error(`Security: Unauthorized sender URL: ${url}`);
}
