import { IpcMainInvokeEvent } from 'electron';

export function validateSender(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    if (!frame) {
         throw new Error("Security: Missing sender frame");
    }

    // Ensure the request comes from a trusted protocol (http/https for dev, file/indii-os for prod)
    // We do not allow 'about:blank' or 'data:' or 'blob:' as origins for IPC calls if possible
    const url = frame.url;
    try {
        const parsed = new URL(url);
        // We permit http/https (Dev Server), file (Production), and indii-os (Deep Links)
        const allowedProtocols = ['http:', 'https:', 'file:', 'indii-os:'];
        if (!allowedProtocols.includes(parsed.protocol)) {
             throw new Error(`Security: Unauthorized sender protocol: ${parsed.protocol}`);
        }
    } catch (e: any) {
        if (e.message.includes('Unauthorized sender protocol')) {
             throw e;
        }
        throw new Error(`Security: Invalid sender URL: ${url}`);
    }
}
