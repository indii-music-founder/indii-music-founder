import { env } from '@/config/env';

export class EndpointService {
    private projectId: string;
    private region: string;

    constructor() {
        this.projectId = env.projectId || '';
        this.region = env.functionsRegion || 'us-central1';
    }

    /**
     * returns the full URL for a given function name, 
     * handling Emulator (DEV) vs. Production URL construction automatically.
     */
    getFunctionUrl(functionName: string): string {
        const useEmulator = env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
        if (env.DEV && useEmulator) {
            return `http://127.0.0.1:5001/${this.projectId}/${this.region}/${functionName}`;
        }

        // Production URL
        return `https://${this.region}-${this.projectId}.cloudfunctions.net/${functionName}`;
    }
}

export const endpointService = new EndpointService();
