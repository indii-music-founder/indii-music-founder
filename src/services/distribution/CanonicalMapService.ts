
import { ExtendedGoldenMetadata } from '../metadata/types';

/**
 * CanonicalMapService
 *
 * Enforces the 2026 Supply Chain "Canonical Map" hierarchy:
 * ISWC (Composition) -> ISRC (Recording) -> UPC (Product)
 *
 * Ensures "Black Box" prevention by linking composition rights before release.
 */

export class CanonicalMapService {

    /**
     * Validate the Identifier Hierarchy for a Release.
     * @returns { valid: boolean, error?: string }
     */
    static validateHierarchy(metadata: ExtendedGoldenMetadata): { valid: boolean; error?: string } {
        // 1. UPC Check (Top Level)
        if (!metadata.upc && !metadata.catalogNumber) {
            return { valid: false, error: 'Missing UPC/GTIN for Release Container.' };
        }

        // 2. ISRC Check (Track Level)
        // If it's a single, the metadata itself has the ISRC. If album, check tracks.
        const tracks = (metadata.tracks && metadata.tracks.length > 0) ? metadata.tracks : [metadata];

        for (const track of tracks) {
            if (!track.isrc) {
                return { valid: false, error: `Missing ISRC for track "${track.trackTitle}".` };
            }

            // 3. ISWC Check (Composition Level)
            // In 2026, linking ISWC is critical/mandatory for "Preferred" status.
            if (!track.iswc) {
                // We permit it if explicitly flagged as "CompositionPending" or similar,
                // but strictly speaking for this validation it's a failure of the Canonical Map.
                return { valid: false, error: `Canonical Map Breach: Missing ISWC for ISRC ${track.isrc}. Composition rights unlinked.` };
            }
        }

        return { valid: true };
    }

    /**
     * Register the Linkage.
     * In a real system, this would write to a graph database or the Blockchain Ledger.
     */
    static registerMap(metadata: ExtendedGoldenMetadata): void {
        const tracks = (metadata.tracks && metadata.tracks.length > 0) ? metadata.tracks : [metadata];

        tracks.forEach(track => {
            console.debug(`[CanonicalMap] Linked: ISWC[${track.iswc}] -> ISRC[${track.isrc}] -> UPC[${metadata.upc}]`);
        });
    }
}
