
export interface StreamingDataPoint {
    trackId: string;
    userId: string;
    timestamp: number;
    durationPlayed: number;
    ipAddress: string;
    userAgent: string;
}

export interface FraudAlert {
    trackId: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    detectedAt: string;
}

export class FraudDetectionService {

    /**
     * Scan a batch of streaming data for artificial patterns.
     * Checks for:
     * 1. Looping (Repeated plays of same track by same user < 35s or exact duration match)
     * 2. Spikes (Sudden volume from single IP)
     */
    static detectArtificialStreaming(events: StreamingDataPoint[]): FraudAlert[] {
        const alerts: FraudAlert[] = [];
        const userPlays: Record<string, StreamingDataPoint[]> = {};
        const ipPlays: Record<string, number> = {};

        // 1. Group by User and IP
        for (const event of events) {
            if (!userPlays[event.userId]) userPlays[event.userId] = [];
            userPlays[event.userId].push(event);

            ipPlays[event.ipAddress] = (ipPlays[event.ipAddress] || 0) + 1;
        }

        // 2. Analyze User Patterns (Looping)
        for (const [userId, plays] of Object.entries(userPlays)) {
            // Sort by time
            plays.sort((a, b) => a.timestamp - b.timestamp);

            let consecutiveRepeats = 0;
            let lastTrackId = '';

            for (const play of plays) {
                if (play.trackId === lastTrackId) {
                    consecutiveRepeats++;
                } else {
                    consecutiveRepeats = 0;
                    lastTrackId = play.trackId;
                }

                // Threshold: 20 repeats of same song in a row is suspicious
                if (consecutiveRepeats > 20) {
                    alerts.push({
                        trackId: lastTrackId,
                        severity: 'HIGH',
                        reason: `User ${userId} looped track > 20 times consecutively`,
                        detectedAt: new Date().toISOString()
                    });
                    break; // Flag once per user per batch
                }
            }
        }

        // 3. Analyze IP Patterns (Spikes/Bot Farms)
        // Threshold: > 1000 plays from single IP in this batch
        for (const [ip, count] of Object.entries(ipPlays)) {
            if (count > 1000) {
                // Find associated tracks (just picking first one for the alert)
                const samplePlay = events.find(e => e.ipAddress === ip);
                alerts.push({
                    trackId: samplePlay?.trackId || 'unknown',
                    severity: 'CRITICAL',
                    reason: `High volume (${count}) from single IP ${ip}`,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        return alerts;
    }

    /**
     * Interface for ACR (Automated Content Recognition).
     * Simulates checking a file against a copyright database (e.g. Audible Magic).
     */
    static async checkCopyright(audioFileUrl: string): Promise<{ safe: boolean; match?: string }> {
        // Mock implementation
        // In real life, this would call an external API

        console.log(`[FraudDetection] Scanning ${audioFileUrl} with ACR...`);

        // Simulate finding a "copyrighted" file if URL contains 'copyright'
        if (audioFileUrl.includes('copyright_infringement')) {
            return {
                safe: false,
                match: 'Detected: "Shake It Off" by Taylor Swift'
            };
        }

        return { safe: true };
    }

    /**
     * Broad Spectrum ACR Stub
     * Specialized detection for "transformed" audio (sped up/slowed down).
     *
     * Technical Functionality:
     * - Identifies extreme manipulations (tempo/pitch shifts > 20%)
     * - Detects "nightcore" or "chopped and screwed" styles
     */
    static async checkBroadSpectrum(audioFileUrl: string): Promise<{ safe: boolean; details?: string }> {
        console.log(`[FraudDetection] Running Broad Spectrum analysis on ${audioFileUrl}...`);

        // Mock heuristics based on filename keywords for the purpose of this roadmap verification
        const lowerUrl = audioFileUrl.toLowerCase();

        if (lowerUrl.includes('sped_up') || lowerUrl.includes('nightcore')) {
             return {
                 safe: false,
                 details: 'Detected: Pitch/Tempo shift (+25%) matching known copyright.'
             };
        }

        if (lowerUrl.includes('slowed') || lowerUrl.includes('chopped')) {
            return {
                safe: false,
                details: 'Detected: Pitch/Tempo shift (-20%) matching known copyright.'
            };
        }

        return { safe: true };
    }
}
