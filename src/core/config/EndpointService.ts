import { env } from '@/config/env';

export class EndpointService {
    private projectId: string;
    private region: string;

    constructor() {
        this.projectId = env.projectId || '';
        this.region = env.location || 'us-central1';
    }

    /**
     * returns the full URL for a given function name, 
     * handling Emulator (DEV) vs. Production URL construction automatically.
     */
    getFunctionUrl(functionName: string): string {
        // Match firebase.ts configuration - default to production
        // If we want to use emulators, we should uncomment this AND the block in firebase.ts
        // if (env.DEV) {
        //     return `http://127.0.0.1:5001/${this.projectId}/${this.region}/${functionName}`;
        // }

        // Production URL
        return `https://${this.region}-${this.projectId}.cloudfunctions.net/${functionName}`;
    }
}

export const endpointService = new EndpointService();
