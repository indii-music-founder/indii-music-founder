import { auth, functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * IdentifierService
 * Responsible for issuing and validating unique industry identifiers.
 * - ISRC (International Standard Recording Code)
 * - UPC (Universal Product Code / GTIN-12)
 * - ISWC (International Standard Musical Work Code) - Validation only
 *
 * ISSUE-781: Issuance is backend-only. This client previously generated
 * checksum-valid ISRCs locally using 'QY1' — an IFPI documentation EXAMPLE
 * registrant code, not one allocated to this company — which could collide
 * with a real registrant and misattribute recordings. Real codes now come
 * exclusively from the backend `assignDistributionIdentifier` pool
 * (pre-provisioned, verified prefixes — see distributionRecords.ts). If the
 * pool is exhausted or unconfigured, issuance fails closed with
 * IDENTIFIER_SETUP_REQUIRED rather than fabricating a code.
 */

export class IdentifierService {
    /**
     * Issue the next available ISRC from the backend-owned, pre-provisioned pool.
     * Throws IDENTIFIER_SETUP_REQUIRED if no verified pool/prefix is configured.
     */
    static async nextISRC(): Promise<string> {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            throw new Error('IDENTIFIER_SETUP_REQUIRED: You must be signed in to issue an ISRC.');
        }
        try {
            const assign = httpsCallable<{ type: 'isrc'; assignedTo: string }, { isrc: string }>(functions, 'assignDistributionIdentifier');
            const result = await assign({ type: 'isrc', assignedTo: uid });
            return result.data.isrc;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`IDENTIFIER_SETUP_REQUIRED: No verified ISRC pool is available (${message}).`);
        }
    }

    /**
     * Issue the next available UPC from the backend-owned, pre-provisioned pool.
     * Throws IDENTIFIER_SETUP_REQUIRED if no verified pool/prefix is configured.
     */
    static async nextUPC(): Promise<string> {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            throw new Error('IDENTIFIER_SETUP_REQUIRED: You must be signed in to issue a UPC.');
        }
        try {
            const assign = httpsCallable<{ type: 'upc'; assignedTo: string }, { upc: string }>(functions, 'assignDistributionIdentifier');
            const result = await assign({ type: 'upc', assignedTo: uid });
            return result.data.upc;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`IDENTIFIER_SETUP_REQUIRED: No verified UPC pool is available (${message}).`);
        }
    }

    /**
     * Validate an ISRC.
     * Rule: 12 alphanumeric characters.
     */
    static validateISRC(isrc: string): boolean {
        // Basic regex: 2 char country, 3 char registrant, 2 char year, 5 digit serial
        const regex = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/;
        return regex.test(isrc);
    }

    /**
     * Validate a UPC.
     * Checks length (12) and checksum.
     */
    static validateUPC(upc: string): boolean {
        if (!/^\d{12}$/.test(upc)) return false;

        const payload = upc.slice(0, 11);
        const check = parseInt(upc.slice(11), 10);
        return this.calculateGTINCheckDigit(payload) === check;
    }

    /**
     * Validate an ISWC.
     * Format: T-000.000.000-C, allowing compact separators from upstream systems.
     */
    static validateISWC(iswc: string): boolean {
        return /^T[- ]?\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d$/.test(iswc.trim().toUpperCase());
    }

    /**
     * Calculate GTIN Check Digit (Luhn-like).
     */
    private static calculateGTINCheckDigit(payload: string): number {
        const digits = payload.split('').map(Number);

        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            // For GTIN-12: The 1st digit (index 0) is considered "odd" in the 1-based indexing for the algorithm
            // (Position 1, 3, 5, 7, 9, 11)
            if ((i + 1) % 2 !== 0) {
                sum += digits[i]! * 3;
            } else {
                sum += digits[i]! * 1;
            }
        }

        const remainder = sum % 10;
        return remainder === 0 ? 0 : 10 - remainder;
    }
}
