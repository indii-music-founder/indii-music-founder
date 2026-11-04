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

        const hasCopyrightLine = (year: number | undefined, text: string | undefined): boolean =>
            Number.isInteger(year) && year! >= 1900 && year! <= new Date().getUTCFullYear() + 1 &&
            typeof text === 'string' && text.trim().length > 0;
        const isValidIsrc = (isrc: string | undefined): boolean =>
            typeof isrc === 'string' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc.trim().toUpperCase());
        const trackIsrcs = metadata.tracks?.length
            ? metadata.tracks.map(track => track.isrc)
            : [metadata.isrc];

        const payload: DDEXPreFlightPayload = {
            releaseId,
            dspTarget,
            cLinePresent: hasCopyrightLine(metadata.cLineYear, metadata.cLineText),
            pLinePresent: hasCopyrightLine(metadata.pLineYear, metadata.pLineText),
            territoriesDeclared: metadata.territories ?? [],
            isrcsMapped: trackIsrcs.every(isValidIsrc),
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
