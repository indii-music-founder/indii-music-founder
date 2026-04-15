import { db } from '@/services/firebase';
import { doc, runTransaction } from 'firebase/firestore';

/**
 * IdentifierService
 * Responsible for generating and validating unique industry identifiers.
 * - ISRC (International Standard Recording Code)
 * - UPC (Universal Product Code / GTIN-12)
 * - ISWC (International Standard Musical Work Code) - Validation only
 */

export class IdentifierService {
    // Configuration for internal generation
    // In a real system, this would be dynamic per user or org
    private static readonly DEFAULT_COUNTRY_CODE = 'US';
    private static readonly DEFAULT_REGISTRANT_CODE = 'QY1'; // Example Registrant
    private static readonly DEFAULT_ISRC_START_YEAR = 26;
    private static readonly DEFAULT_ISRC_SEQUENCE_START = 100;
    private static readonly DEFAULT_UPC_SEQUENCE_START = 10000000000;


    /**
     * Fetch and increment the next sequence number from Firestore.
     * Uses a transaction to ensure atomicity and uniqueness.
     */
    private static async getNextSequence(type: 'isrc' | 'upc', year?: number): Promise<number> {
        const seqDocRef = doc(db, 'system_sequences', 'identifiers');

        return await runTransaction(db, async (transaction) => {
            const seqDoc = await transaction.get(seqDocRef);

            if (!seqDoc.exists()) {
                // Initialize if not exists
                const initialData = {
                    isrc: { lastYear: year || IdentifierService.DEFAULT_ISRC_START_YEAR, sequence: IdentifierService.DEFAULT_ISRC_SEQUENCE_START }, // Start at 100 for padding
                    upc: { sequence: IdentifierService.DEFAULT_UPC_SEQUENCE_START } // 11 digits start
                };
                transaction.set(seqDocRef, initialData);
                return type === 'isrc' ? initialData.isrc.sequence : initialData.upc.sequence;
            }

            const data = seqDoc.data();

            if (type === 'isrc') {
                const isrcData = data.isrc || { lastYear: year || IdentifierService.DEFAULT_ISRC_START_YEAR, sequence: IdentifierService.DEFAULT_ISRC_SEQUENCE_START };
                let currentSeq = isrcData.sequence + 1;
                let lastYear = isrcData.lastYear;

                // Reset sequence if year has advanced
                if (year && year > lastYear) {
                    currentSeq = 1;
                    lastYear = year;
                }

                transaction.update(seqDocRef, {
                    'isrc.sequence': currentSeq,
                    'isrc.lastYear': lastYear
                });
                return currentSeq;
            } else {
                const upcData = data.upc || { sequence: IdentifierService.DEFAULT_UPC_SEQUENCE_START };
                const currentSeq = upcData.sequence + 1;
                transaction.update(seqDocRef, { 'upc.sequence': currentSeq });
                return currentSeq;
            }
        });
    }

    /**
     * Generate the next available ISRC automatically.
     */
    static async nextISRC(countryCode?: string, registrantCode?: string): Promise<string> {
        const currentYear = new Date().getFullYear() % 100;
        const sequence = await this.getNextSequence('isrc', currentYear);
        return this.generateISRC(currentYear, sequence, countryCode, registrantCode);
    }

    /**
     * Generate the next available UPC automatically.
     */
    static async nextUPC(): Promise<string> {
        const sequence = await this.getNextSequence('upc');
        return this.generateUPC(sequence.toString());
    }

    /**
     * Format a valid ISRC string.
     * Format: CC-XXX-YY-NNNNN
     */
    static generateISRC(
        year: number,
        sequence: number,
        countryCode: string = this.DEFAULT_COUNTRY_CODE,
        registrantCode: string = this.DEFAULT_REGISTRANT_CODE
    ): string {
        const yy = year.toString().padStart(2, '0').slice(-2);
        const nnnnn = sequence.toString().padStart(5, '0');
        return `${countryCode}${registrantCode}${yy}${nnnnn}`;
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
     * Format a valid UPC (GTIN-12) from an 11-digit payload.
     */
    static generateUPC(payload: string): string {
        if (!/^\d{11}$/.test(payload)) {
            // If it's shorter, pad it; but we expect 11 digits from the sequence
            payload = payload.padStart(11, '0');
        }
        const checkDigit = this.calculateGTINCheckDigit(payload);
        return `${payload}${checkDigit}`;
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
