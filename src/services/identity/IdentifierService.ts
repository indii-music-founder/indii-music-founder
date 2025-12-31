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

    /**
     * Generate a valid ISRC.
     * Format: CC-XXX-YY-NNNNN
     * @param year 2-digit year (e.g., 24 for 2024)
     * @param sequence Unique 5-digit number for the year
     * @param countryCode 2-character country code (default: US)
     * @param registrantCode 3-character registrant code
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
     * Generate a valid UPC (GTIN-12).
     * Format: 11 digits + 1 check digit.
     * @param prefix Company Prefix + Item Reference (11 digits total)
     */
    static generateUPC(payload: string): string {
        if (!/^\d{11}$/.test(payload)) {
            throw new Error('UPC payload must be exactly 11 digits');
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
     * Multiply digits by 3 or 1 alternating, sum, mod 10.
     */
    private static calculateGTINCheckDigit(payload: string): number {
        // Pad to 11 digits if necessary (though generateUPC enforces 11)
        const digits = payload.split('').map(Number);

        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            // GTIN-12 positions are 1-based index from left.
            // Odd positions (1, 3, 5...) are multiplied by 3.
            // Even positions (2, 4, 6...) are multiplied by 1.
            // Wait, for GTIN-12 (UPC-A):
            // The standard says: start from right (excluding check digit).
            // Position 1 (rightmost of payload) * 3
            // Position 2 * 1
            // ...
            // Let's stick to the standard algorithm:
            // "Sum the odd positions (1, 3, 5, 7, 9, 11) and multiply by 3"
            // "Sum the even positions (2, 4, 6, 8, 10)"
            // "Add results"
            // "Nearest multiple of 10 minus result"

            if ((i + 1) % 2 !== 0) { // Odd position (1st, 3rd...)
                sum += digits[i] * 3;
            } else { // Even position
                sum += digits[i] * 1;
            }
        }

        const nearestTen = Math.ceil(sum / 10) * 10;
        return nearestTen - sum;
    }
}
