import { indiiRemoteService } from './services/IndiiRemoteService';

async function bootstrap() {
    const passcode = "872914"; // Generate a static passcode so I can send the user their login

    try {
        const url = await indiiRemoteService.start({
            port: 3333,
            password: passcode,
            // DO NOT provide ngrokToken so it doesn't kill the user's phone session
        });

        console.log(`[IndiiRemote Server Started] Connect mapping to port 3333. Passcode: ${passcode}`);

        // Keep process alive
        process.stdin.resume();

    } catch (e) {
        console.error("Failed to start daemon", e);
        process.exit(1);
    }
}

bootstrap();
