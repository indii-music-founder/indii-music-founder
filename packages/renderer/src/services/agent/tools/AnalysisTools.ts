import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';

// ============================================================================
// AnalysisTools Implementation
// ============================================================================

export const AnalysisTools = {
    analyze_contract: wrapTool('analyze_contract', async (args: { file_data: string, mime_type: string }) => {
        const { creatorProtectionHarnessService } = await importWithRetry(() => import('@/services/creator-protection'));
        const { functions } = await importWithRetry(() => import('@/services/firebase'));
        const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));
        const analyzeContract = httpsCallable<
            { fileData: string; mimeType: string },
            { score?: number, summary?: string, risks?: string[] }
        >(functions, 'analyzeContract');

        const result = await analyzeContract({ fileData: args.file_data, mimeType: args.mime_type });
        const data = result.data;
        const aiClauseReview = creatorProtectionHarnessService.reviewAIVoiceLikenessClause(args.file_data);

        const risks = [...(data.risks ?? []), ...aiClauseReview.flags];
        return toolSuccess({ ...data, risks, aiClauseReview }, `Contract Analysis:\nScore: ${data.score ?? 'N/A'}\nSummary: ${data.summary ?? 'N/A'}\nRisks:\n- ${risks.join('\n- ')}`);
    }),

    sync_dsp_stats: wrapTool('sync_dsp_stats', async (args: { dsp: 'Spotify' | 'Apple'; artistId: string }) => {
        if (args.dsp === 'Apple') {
            return toolError(
                'Apple Music live analytics is not integrated. No connection or fresh metrics can be verified.',
                'DSP_INTEGRATION_UNAVAILABLE',
            );
        }

        try {
            const { auth } = await importWithRetry(() => import('@/services/firebase'));
            const uid = auth.currentUser?.uid;
            if (!uid) return toolError('User is not authenticated.', 'UNAUTHENTICATED');

            const { syncSpotifyStats } = await importWithRetry(() => import('@/services/social/SocialPlatformService'));
            const result = await syncSpotifyStats(uid, args.artistId);
            if (result.liveSyncOk) {
                return toolSuccess({
                    dsp: args.dsp,
                    artistId: args.artistId,
                    timestamp: new Date(result.fetchedAt).toISOString(),
                    stats: result,
                    source: 'live',
                }, `${args.dsp} stats synced live. Followers: ${result.followers?.toLocaleString('en-US') ?? 'N/A'}.`);
            }
            if (result.authorized && result.cacheOnly) {
                return toolSuccess({
                    dsp: args.dsp,
                    artistId: args.artistId,
                    timestamp: new Date(result.fetchedAt).toISOString(),
                    stats: result,
                    source: 'cache_only',
                }, `${args.dsp} authorization exists, but live sync failed. Showing cached metrics from ${new Date(result.fetchedAt).toISOString()}; they are not current.`);
            }
        } catch (_err: unknown) {
            // Fall through to an actionable, non-fabricated connection error.
        }

        return toolError(
            `${args.dsp} is not connected. Connect via Settings → Social Platforms to enable live stat sync.`,
            'DSP_NOT_CONNECTED'
        );
    }),

    detect_streaming_anomalies: wrapTool('detect_streaming_anomalies', async (args: { trackId: string; currentStreams: number; averageStreams: number }) => {
        if (args.averageStreams <= 0) {
            return toolError('Average stream count must be greater than zero for anomaly detection.', 'INVALID_BASELINE');
        }

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
