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
    const senderUrl = frame.url;
    if (!senderUrl) throw new Error("Unauthorized IPC Sender: No URL");

    // 1. Allow Production Scheme (file://)
    if (senderUrl.startsWith('file://')) return;

    // 2. Allow Deep Links (indii-os://) - though these usually come from OS, not frames
    if (senderUrl.startsWith('indii-os://')) return;

    // 3. Allow Development Server (if defined)
    // We check strict ORIGIN equality to prevent prefix attacks (e.g. localhost.evil.com)
    if (process.env.VITE_DEV_SERVER_URL) {
        if (senderUrl.startsWith(process.env.VITE_DEV_SERVER_URL)) {
             // If VITE_DEV_SERVER_URL ends with a slash or we add one, we are safer.
             // Or better: parse both and compare origins.
             // However, senderUrl might be a full path (http://localhost:4242/foo).
             // process.env.VITE_DEV_SERVER_URL is usually 'http://localhost:4242'.

             // Vulnerability: 'http://localhost:4242.evil.com/foo' startsWith 'http://localhost:4242' IF the env var doesn't have a trailing slash.

             let devUrl = process.env.VITE_DEV_SERVER_URL;
             if (!devUrl.endsWith('/')) {
                 devUrl += '/';
             }

             // If senderUrl matches exactly (root) or starts with devUrl/ (subpath)
             if (senderUrl === process.env.VITE_DEV_SERVER_URL || senderUrl.startsWith(devUrl)) {
                 return;
             }
        }
    }

    // 4. Explicitly block everything else
    console.error(`[Security] Blocked unauthorized IPC sender: ${senderUrl}`);
    throw new Error(`Security: Unauthorized sender URL: ${senderUrl}`);
}
