/**
 * DDEXPreFlightService — Fast-Path Pre-Flight DDEX Validation & Anomaly Detection
 *
 * Inspects release metadata against DSP delivery profiles (Spotify, Apple Music, TIDAL)
 * before triggering expensive XML compilation or distribution dispatch.
 */

import {
    judgeDDEXPreFlight,
    type DDEXPreFlightPayload,
    type DDEXPreFlightResult,
    type DSPDeliveryTarget,
} from '@/config/typesafeJudgments';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { logger } from '@/utils/logger';

export class DDEXPreFlightService {
    /**
     * Validate an in-flight release for a target DSP using Jev pre-flight judgment
     */
    static async validateReleaseForDSP(
        releaseId: string,
        dspTarget: DSPDeliveryTarget,
        metadata: Partial<ExtendedGoldenMetadata>
    ): Promise<DDEXPreFlightResult> {
        logger.info(`[DDEXPreFlightService] Running pre-flight evaluation for ${releaseId} -> ${dspTarget}`);

        const payload: DDEXPreFlightPayload = {
            releaseId,
            dspTarget,
            cLinePresent: Boolean(metadata.labelName || metadata.publisher),
            pLinePresent: Boolean(metadata.labelName || metadata.artistName),
            territoriesDeclared: metadata.territories || ['Worldwide'],
            isrcsMapped: Boolean(metadata.isrc && metadata.isrc.trim().length === 12),
            iswcMapped: Boolean(metadata.iswc && metadata.iswc.trim().length > 0),
            parentalAdvisoryDeclared: typeof metadata.explicit === 'boolean',
        };

        return judgeDDEXPreFlight(payload);
    }

    /**
     * Batch pre-flight validate across multiple DSPs in parallel (<100ms)
     */
    static async validateReleaseMultiDSP(
        releaseId: string,
        dspTargets: DSPDeliveryTarget[],
        metadata: Partial<ExtendedGoldenMetadata>
    ): Promise<Record<DSPDeliveryTarget, DDEXPreFlightResult>> {
        const results = await Promise.all(
            dspTargets.map((dsp) => this.validateReleaseForDSP(releaseId, dsp, metadata))
        );

        const map: Partial<Record<DSPDeliveryTarget, DDEXPreFlightResult>> = {};
        results.forEach((res) => {
            map[res.dspTarget] = res;
        });

        return map as Record<DSPDeliveryTarget, DDEXPreFlightResult>;
    }
}
