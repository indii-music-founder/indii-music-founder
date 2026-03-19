import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// AnalysisTools Implementation
// ============================================================================

export const AnalysisTools = {
    analyze_contract: wrapTool('analyze_contract', async (args: { file_data: string, mime_type: string }) => {
        const { functions } = await import('@/services/firebase');
        const { httpsCallable } = await import('firebase/functions');
        const analyzeContract = httpsCallable<
            { fileData: string; mimeType: string },
            { score?: number, summary?: string, risks?: string[] }
        >(functions, 'analyzeContract');

        const result = await analyzeContract({ fileData: args.file_data, mimeType: args.mime_type });
        const data = result.data;

        const risks = data.risks ?? [];
        return toolSuccess(data, `Contract Analysis:\nScore: ${data.score ?? 'N/A'}\nSummary: ${data.summary ?? 'N/A'}\nRisks:\n- ${risks.join('\n- ')}`);
    }),

    sync_dsp_stats: wrapTool('sync_dsp_stats', async (args: { dsp: 'Spotify' | 'Apple'; artistId: string }) => {
        const platformKey = args.dsp === 'Spotify' ? 'spotify' : 'apple_music';

        // 1. Try reading cached stats from Firestore (written by SocialPlatformService.syncSpotifyStats)
        try {
            const { db, auth } = await import('@/services/firebase');
            const { doc, getDoc } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (uid) {
                const cacheRef = doc(db, 'users', uid, 'platformStats', platformKey);
                const snap = await getDoc(cacheRef);

                if (snap.exists()) {
                    const cached = snap.data();
                    const ageMs = Date.now() - (cached.fetchedAt || 0);
                    // Serve cache if fresher than 6 hours
                    if (ageMs < 6 * 60 * 60 * 1000) {
                        return toolSuccess({
                            dsp: args.dsp,
                            artistId: args.artistId,
                            timestamp: new Date(cached.fetchedAt).toISOString(),
                            stats: cached,
                            source: 'cache'
                        }, `${args.dsp} stats loaded from cache (${Math.round(ageMs / 60000)} min old). Followers: ${cached.followers?.toLocaleString() ?? 'N/A'}.`);
                    }
                }

                // 2. Cache miss or stale — attempt live sync for Spotify
                if (args.dsp === 'Spotify') {
                    const { syncSpotifyStats } = await import('@/services/social/SocialPlatformService');
                    const live = await syncSpotifyStats(uid, args.artistId);
                    if (live.followers !== undefined) {
                        return toolSuccess({
                            dsp: args.dsp,
                            artistId: args.artistId,
                            timestamp: new Date(live.fetchedAt).toISOString(),
                            stats: live,
                            source: 'live'
                        }, `${args.dsp} stats synced live. Followers: ${live.followers?.toLocaleString() ?? 'N/A'}.`);
                    }
                }
            }
        } catch (err) {
            // Fall through to not-connected error
        }

        // 3. Token not connected or sync failed — return actionable error, not fake numbers
        return toolError(
            `${args.dsp} is not connected. Connect via Settings → Social Platforms to enable live stat sync.`,
            'DSP_NOT_CONNECTED'
        );
    }),

    detect_streaming_anomalies: wrapTool('detect_streaming_anomalies', async (args: { trackId: string; currentStreams: number; averageStreams: number }) => {
        // Mock Anomaly Detection (Item 157)
        const spikePercentage = ((args.currentStreams - args.averageStreams) / args.averageStreams) * 100;

        let anomalyType = 'None';
        let severity = 'Low';
        let message = `No significant anomalies detected for track ${args.trackId}.`;

        if (spikePercentage >= 500) {
            anomalyType = 'Sudden Viral Spike (Possible Botting)';
            severity = 'Critical';
            message = `URGENT: Track ${args.trackId} has experienced a ${spikePercentage.toFixed(0)}% spike in streams. This may indicate a viral TikTok trend or botting activity.`;
        } else if (spikePercentage >= 200) {
            anomalyType = 'High Activity Increase';
            severity = 'Medium';
            message = `Track ${args.trackId} has seen a ${spikePercentage.toFixed(0)}% increase in streams.`;
        }

        return toolSuccess({
            trackId: args.trackId,
            currentStreams: args.currentStreams,
            averageStreams: args.averageStreams,
            spikePercentage: Number(spikePercentage.toFixed(2)),
            anomalyType,
            severity
        }, message);
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    analyze_contract,
    sync_dsp_stats,
    detect_streaming_anomalies
} = AnalysisTools;
