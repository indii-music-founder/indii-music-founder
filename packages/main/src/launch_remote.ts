import { indiiRemoteService } from './services/IndiiRemoteService';
import crypto from 'crypto';

async function bootstrap() {
    // Generate a cryptographically random 6-digit passcode per session
    const passcode = crypto.randomInt(100000, 999999).toString();

    try {
        const _url = await indiiRemoteService.start({
            port: 3333,
            password: passcode,
            // Local-only mode: no Ngrok tunnel — avoids clobbering the user's phone session
        });

        // Passcode is displayed in the desktop UI, not logged for security

        // Keep process alive
        process.stdin.resume();

    } catch (_e) {
        console.error('[launch_remote] Failed to bootstrap remote service:', _e);
        process.exit(1);
    }
}

bootstrap();
