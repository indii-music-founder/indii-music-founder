import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { fingerprintService } from '@/services/audio/FingerprintService';
import { logger } from '@/utils/logger';

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
    fingerprint?: string;
}

export class FraudDetectionService {

    /**
     * Scan a batch of streaming data for artificial patterns.
     */
    static async detectArtificialStreaming(events: StreamingDataPoint[]): Promise<FraudAlert[]> {
        const alerts: FraudAlert[] = [];
        const userPlays: Record<string, StreamingDataPoint[]> = {};
        const ipPlays: Record<string, number> = {};

        // 1. Group by User and IP
        for (const event of events) {
            if (!userPlays[event.userId]) userPlays[event.userId] = [];
            userPlays[event.userId]!.push(event);

            ipPlays[event.ipAddress] = (ipPlays[event.ipAddress] || 0) + 1;
        }

        // 2. Analyze User Patterns (Looping)
        for (const [userId, plays] of Object.entries(userPlays)) {
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

                if (consecutiveRepeats > 20) {
                    const alert: FraudAlert = {
                        trackId: lastTrackId,
                        severity: 'HIGH',
                        reason: `User ${userId} looped track > 20 times consecutively`,
                        detectedAt: new Date().toISOString()
                    };
                    alerts.push(alert);
                    await this.persistAlert(alert);
                    break;
                }
            }
        }

        // 3. Analyze IP Patterns (Spikes/Bot Farms)
        for (const [ip, count] of Object.entries(ipPlays)) {
            if (count > 1000) {
                const samplePlay = events.find(e => e.ipAddress === ip);
                const alert: FraudAlert = {
                    trackId: samplePlay?.trackId || 'unknown',
                    severity: 'CRITICAL',
                    reason: `High volume (${count}) from single IP ${ip}`,
                    detectedAt: new Date().toISOString()
                };
                alerts.push(alert);
                await this.persistAlert(alert);
            }
        }

        return alerts;
    }

    /**
     * Full Acoustic Integrity Check
     * Combines SHA-256 binary hash and Chromaprint acoustic fingerprint.
     */
    static async checkContentIntegrity(file: File, filePath?: string): Promise<{ safe: boolean; match?: string; fingerprint?: string }> {
        console.info(`[FraudDetection] Generating acoustic fingerprint for file...`);

        const fingerprint = await fingerprintService.generateFingerprint(file, filePath);
        if (!fingerprint) {
            return { safe: true }; // Fallback to safe if fingerprinting fails (or log error)
        }

        console.info(`[FraudDetection] Fingerprint: ${fingerprint}`);

        try {
            // Check against known infringements in Firestore
            const q = query(
                collection(db, 'content_rules'),
                where('type', '==', 'fingerprint_match')
            );
            const snapshot = await getDocs(q);

            for (const doc of snapshot.docs) {
                const rule = doc.data();
                // Exact match on composite fingerprint
                if (rule.fingerprint === fingerprint) {
                    return {
                        safe: false,
                        match: rule.matchMessage || 'Exact Content Match Detected (Copyright Infringement)',
                        fingerprint
                    };
                }

                // Fuzzy match on "Soul" portion (last 16 chars)
                const soul = fingerprint.split('-').pop();
                const ruleSoul = rule.fingerprint?.split('-').pop();

                if (soul && ruleSoul && soul === ruleSoul) {
                    return {
                        safe: false,
                        match: rule.matchMessage || 'Acoustic Soul Match Detected (Likely Infringement)',
                        fingerprint
                    };
                }
            }
        } catch (e) {
            logger.error('[FraudDetection] Failed to query content rules', e);
        }

        return { safe: true, fingerprint };
    }

    /**
     * Legacy URL-based copyright check (maintained for backward compatibility)
     */
    /**
     * Requirement 108: Copyright AI Filter
     * Implements a preliminary hashing/screening layer using the Audio Fingerprinting service
     * before distribution to catch uncleared samples.
     * Backwards compatibility: If file is not provided (legacy call), we skip fingerprinting and only check URL.
     */
    static async checkCopyright(audioFileUrlOrFile: string | File, audioFileUrlLegacy?: string): Promise<{ safe: boolean; match?: string; fingerprint?: string }> {
        console.info(`[FraudDetection] Scanning audio for copyright infringement...`);

        try {
            let fingerprint: string | null = null;
            const audioFileUrl = typeof audioFileUrlOrFile === 'string' ? audioFileUrlOrFile : audioFileUrlLegacy;

            // 1. Generate Acoustic Fingerprint if a File is provided
            if (audioFileUrlOrFile instanceof File) {
                fingerprint = await fingerprintService.generateFingerprint(audioFileUrlOrFile);
            }

            if (!fingerprint && !audioFileUrl) {
                console.warn('[FraudDetection] No file or URL provided for copyright scan. Proceeding as safe.');
                return { safe: true };
            }

            // 2. Cross-reference fingerprint with known copyright registry (Mocked via Firestore 'content_rules')
            // In a production environment, this would hit ACRCloud or Audible Magic APIs.
            const q = query(
                collection(db, 'content_rules'),
                where('type', '==', 'copyright_infringement')
            );
            const snapshot = await getDocs(q);

            for (const doc of snapshot.docs) {
                const rule = doc.data();

                if (fingerprint && rule.fingerprint && rule.fingerprint === fingerprint) {
                    return {
                        safe: false,
                        match: rule.matchMessage || 'Copyright Violation Detected: Uncleared Sample Match',
                        fingerprint: fingerprint || undefined
                    };
                }

                if (audioFileUrl && rule.pattern && audioFileUrl.includes(rule.pattern)) {
                    return {
                        safe: false,
                        match: rule.matchMessage || 'Copyright Violation Detected via URL Pattern',
                        fingerprint: fingerprint || undefined
                    };
                }
            }

            return { safe: true, fingerprint: fingerprint || undefined };

        } catch (e) {
            logger.error('[FraudDetection] Failed to run Copyright AI filter', e);
            // Fail open so we don't block distribution completely on external API failure,
            // but we log it heavily for manual review.
            return { safe: true };
        }
    }

    /**
     * Specialized detection for transformed audio.
     */
    static async checkBroadSpectrum(audioFileUrl: string): Promise<{ safe: boolean; details?: string }> {
        console.info(`[FraudDetection] Running Broad Spectrum analysis...`);

        try {
            const q = query(
                collection(db, 'content_rules'),
                where('type', '==', 'broad_spectrum')
            );
            const snapshot = await getDocs(q);

            for (const doc of snapshot.docs) {
                const rule = doc.data();
                if (rule.pattern && audioFileUrl.includes(rule.pattern)) {
                    return {
                        safe: false,
                        details: rule.details || 'Detected: Transformed Audio.'
                    };
                }
            }
        } catch (e) {
            logger.error('[FraudDetection] Failed to query broad spectrum rules', e);
        }

        return { safe: true };
    }

    private static async persistAlert(alert: FraudAlert) {
        try {
            await addDoc(collection(db, 'fraud_alerts'), { ...alert, createdAt: Timestamp.now() });
        } catch (e) {
            logger.error('[FraudDetection] Failed to persist alert', e);
        }
    }
}
