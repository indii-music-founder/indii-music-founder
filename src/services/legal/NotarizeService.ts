/**
 * Item 245: Notarize.com Integration Service
 *
 * Provides Remote Online Notarization (RON) for legal documents
 * that require notarized signatures (label deals, sync licenses,
 * publishing agreements, etc.).
 *
 * Setup: Apply for API access at https://developers.notarize.com
 * Env: VITE_NOTARIZE_API_KEY
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

const NOTARIZE_API = 'https://api.notarize.com/v1';

export class NotarizeService {
    private apiKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_NOTARIZE_API_KEY || '';
    }

    /**
     * Check if Notarize.com is configured.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Get authorization headers.
     */
    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Create a new notarization transaction.
     * This uploads the document and sets up signers.
     */
    async createTransaction(params: CreateTransactionParams): Promise<NotarizationTransaction> {
        if (!this.isConfigured()) {
            throw new Error('Notarize.com not configured. Set VITE_NOTARIZE_API_KEY in .env');
        }

        const body = {
            document: {
                name: params.documentName,
                ...(params.documentBase64 && { base64_content: params.documentBase64 }),
                ...(params.documentUrl && { url: params.documentUrl }),
            },
            signers: params.signers.map(s => ({
                first_name: s.firstName,
                last_name: s.lastName,
                email: s.email,
                phone: s.phone,
            })),
            settings: {
                require_id_verification: params.requireIdVerification ?? true,
                expiration_hours: params.expirationHours ?? 168, // 7 days default
            },
        };

        const response = await fetch(`${NOTARIZE_API}/transactions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Notarize create error: ${response.status} — ${error}`);
        }

        const data = await response.json();
        return {
            id: data.id,
            status: data.status,
            signers: params.signers,
            documentName: params.documentName,
            signerLink: data.signer_link,
            createdAt: data.created_at,
        };
    }

    /**
     * Get the status of a notarization transaction.
     */
    async getTransaction(transactionId: string): Promise<NotarizationTransaction> {
        if (!this.isConfigured()) {
            throw new Error('Notarize.com not configured');
        }

        const response = await fetch(`${NOTARIZE_API}/transactions/${transactionId}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Notarize status error: ${response.status}`);
        }

        const data = await response.json();
        return {
            id: data.id,
            status: data.status,
            signers: (data.signers || []).map((s: Record<string, string>) => ({
                firstName: s.first_name,
                lastName: s.last_name,
                email: s.email,
                phone: s.phone,
            })),
            documentName: data.document?.name || 'Unknown',
            signerLink: data.signer_link,
            createdAt: data.created_at,
            completedAt: data.completed_at,
            notarizedDocumentUrl: data.completed_document_url,
        };
    }

    /**
     * Cancel a pending notarization transaction.
     */
    async cancelTransaction(transactionId: string): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('Notarize.com not configured');
        }

        const response = await fetch(`${NOTARIZE_API}/transactions/${transactionId}/cancel`, {
            method: 'POST',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Notarize cancel error: ${response.status}`);
        }
    }

    /**
     * Download the notarized document.
     */
    async downloadNotarizedDocument(transactionId: string): Promise<Blob> {
        if (!this.isConfigured()) {
            throw new Error('Notarize.com not configured');
        }

        const transaction = await this.getTransaction(transactionId);

        if (transaction.status !== 'completed' || !transaction.notarizedDocumentUrl) {
            throw new Error('Document not yet notarized');
        }

        const response = await fetch(transaction.notarizedDocumentUrl, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
        });

        if (!response.ok) {
            throw new Error(`Download error: ${response.status}`);
        }

        return response.blob();
    }
}

export const notarizeService = new NotarizeService();
