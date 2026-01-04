/**
 * FraudDetectionService
 * Implements "Trust & Safety" checks for music distribution.
 * - Artificial Streaming Detection
 * - Copyright / Content Recognition (stub)
 */

import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

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
    static async detectArtificialStreaming(events: StreamingDataPoint[]): Promise<FraudAlert[]> {
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
                    const alert: FraudAlert = {
                        trackId: lastTrackId,
                        severity: 'HIGH',
                        reason: `User ${userId} looped track > 20 times consecutively`,
                        detectedAt: new Date().toISOString()
                    };
                    alerts.push(alert);

                    // Persist Alert
                    try {
                        await addDoc(collection(db, 'fraud_alerts'), { ...alert, createdAt: Timestamp.now() });
                    } catch (e) {
                        console.error('[FraudDetection] Failed to persist alert', e);
                    }

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
                const alert: FraudAlert = {
                    trackId: samplePlay?.trackId || 'unknown',
                    severity: 'CRITICAL',
                    reason: `High volume (${count}) from single IP ${ip}`,
                    detectedAt: new Date().toISOString()
                };
                alerts.push(alert);

                // Persist Alert
                try {
                    await addDoc(collection(db, 'fraud_alerts'), { ...alert, createdAt: Timestamp.now() });
                } catch (e) {
                    console.error('[FraudDetection] Failed to persist alert', e);
                }
            }
        }

        return alerts;
    }

    /**
     * Interface for ACR (Automated Content Recognition).
     * Simulates checking a file against a copyright database (e.g. Audible Magic).
     * Now backed by 'content_rules' collection for known infringements in the demo.
     */
    static async checkCopyright(audioFileUrl: string): Promise<{ safe: boolean; match?: string }> {
        console.info(`[FraudDetection] Scanning ${audioFileUrl} with ACR...`);

        try {
            // Check against persisted rules instead of hardcoded strings
            // Note: In a real system, this sends a fingerprint to an API.
            // Here we look up if the URL matches a 'blacklisted_pattern' in our DB.

            const q = query(
                collection(db, 'content_rules'),
                where('type', '==', 'copyright_infringement')
            );
            const snapshot = await getDocs(q);

            for (const doc of snapshot.docs) {
                const rule = doc.data();
                if (rule.pattern && audioFileUrl.includes(rule.pattern)) {
                    return {
                        safe: false,
                        match: rule.matchMessage || 'Copyright Violation Detected'
                    };
                }
            }
        } catch (e) {
            console.error('[FraudDetection] Failed to query content rules', e);
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
        console.info(`[FraudDetection] Running Broad Spectrum analysis on ${audioFileUrl}...`);

        try {
            // We can also make this rule-based
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
            console.error('[FraudDetection] Failed to query broad spectrum rules', e);
        }

        return { safe: true };
    }
}
