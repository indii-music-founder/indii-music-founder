import { IpcMainInvokeEvent } from 'electron';

export function validateSender(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    if (!frame) {
         throw new Error("Security: Missing sender frame");
    }

    const url = frame.url;

    // 1. Allow Electron Production (File Protocol)
    if (url.startsWith('file://')) return;

    // 2. Allow Deep Links
    if (url.startsWith('indii-os:')) return;

    // 3. Allow Dev Server (Strict Origin Check)
    if (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) {
        return;
    }

    // 4. Reject everything else (including arbitrary https://)
    throw new Error(`Security: Unauthorized sender URL: ${url}`);
}
