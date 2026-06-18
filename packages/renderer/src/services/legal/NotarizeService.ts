/**
 * Item 245: Notarize.com Integration Service
 *
 * Provides Remote Online Notarization (RON) for legal documents
 * that require notarized signatures (label deals, sync licenses,
 * publishing agreements, etc.).
 *
 * Browser-side Notarize API tokens are disabled. This service must use a
 * secured Firebase backend before it can create notarization transactions.
 *
 * Workflow:
 *   1. Create a notarization transaction with document + signer info
 *   2. Share the transaction link with the signer
 *   3. Signer meets with a live notary via video call
 *   4. Document is notarized and sealed
 *   5. Download the notarized document
 */

export interface Signer {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
}

export interface NotarizationTransaction {
    id: string;
    status: 'created' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
    signers: Signer[];
    documentName: string;
    signerLink?: string;
    createdAt: string;
    completedAt?: string;
    notarizedDocumentUrl?: string;
}

export interface CreateTransactionParams {
    documentName: string;
    documentBase64?: string;
    documentUrl?: string;
    signers: Signer[];
    requireIdVerification?: boolean;
    expirationHours?: number;
}

export class NotarizeService {
    /**
     * Check if Notarize.com is configured.
     */
    isConfigured(): boolean {
        return false;
    }

    /**
     * Create a new notarization transaction.
     * This uploads the document and sets up signers.
     */
    async createTransaction(params: CreateTransactionParams): Promise<NotarizationTransaction> {
        void params;
        throw new Error('Notarize.com access is backend-only. Configure a secured Firebase notarization gateway before creating transactions.');
    }

    /**
     * Get the status of a notarization transaction.
     */
    async getTransaction(transactionId: string): Promise<NotarizationTransaction> {
        void transactionId;
        throw new Error('Notarize.com access is backend-only. Configure a secured Firebase notarization gateway before reading transactions.');
    }

    /**
     * Cancel a pending notarization transaction.
     */
    async cancelTransaction(transactionId: string): Promise<void> {
        void transactionId;
        throw new Error('Notarize.com access is backend-only. Configure a secured Firebase notarization gateway before cancelling transactions.');
    }

    /**
     * Download the notarized document.
     */
    async downloadNotarizedDocument(transactionId: string): Promise<Blob> {
        void transactionId;
        throw new Error('Notarize.com document downloads are backend-only. Configure a secured Firebase notarization gateway before downloading documents.');
    }
}

export const notarizeService = new NotarizeService();
