/**
 * Item 242: PandaDoc Document Automation Service
 *
 * Provides contract generation, e-signature, and document
 * management for music industry agreements (label deals,
 * sync licenses, publishing splits, etc.).
 *
 * Setup: Get a free sandbox API key from https://developers.pandadoc.com
 * Env: VITE_PANDADOC_API_KEY
 * Free tier: Unlimited sandbox API calls
 */

export interface DocumentTemplate {
    id: string;
    name: string;
    dateCreated: string;
    version: string;
}

export interface DocumentRecipient {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    signingOrder?: number;
}

export interface CreateDocumentParams {
    name: string;
    templateId?: string;
    recipients: DocumentRecipient[];
    tokens?: Record<string, string>;
    metadata?: Record<string, string>;
    tags?: string[];
}

export interface Document {
    id: string;
    name: string;
    status: 'draft' | 'sent' | 'viewed' | 'completed' | 'voided' | 'declined';
    dateCreated: string;
    dateModified: string;
    expirationDate?: string;
    recipients: DocumentRecipient[];
}

export interface DocumentLink {
    id: string;
    url: string;
    expiresAt: string;
}

const PANDADOC_API = 'https://api.pandadoc.com/public/v1';

export class PandaDocService {
    private apiKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_PANDADOC_API_KEY || '';
    }

    /**
     * Check if PandaDoc is configured.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Get authorization headers.
     */
    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `API-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * List available document templates.
     */
    async listTemplates(): Promise<DocumentTemplate[]> {
        if (!this.isConfigured()) {
            throw new Error('PandaDoc not configured. Set VITE_PANDADOC_API_KEY in .env');
        }

        const response = await fetch(`${PANDADOC_API}/templates`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`PandaDoc templates error: ${response.status}`);
        }

        const data = await response.json();
        return (data.results || []).map((t: Record<string, unknown>) => ({
            id: t.id as string,
            name: t.name as string,
            dateCreated: t.date_created as string,
            version: t.version as string || '1',
        }));
    }

    /**
     * Create a new document from a template.
     * Used for generating label deals, sync licenses, etc.
     */
    async createDocument(params: CreateDocumentParams): Promise<Document> {
        if (!this.isConfigured()) {
            throw new Error('PandaDoc not configured');
        }

        const body = {
            name: params.name,
            template_uuid: params.templateId,
            recipients: params.recipients.map(r => ({
                email: r.email,
                first_name: r.firstName,
                last_name: r.lastName,
                role: r.role,
                signing_order: r.signingOrder,
            })),
            tokens: params.tokens ? Object.entries(params.tokens).map(([k, v]) => ({
                name: k,
                value: v,
            })) : [],
            metadata: params.metadata,
            tags: params.tags,
        };

        const response = await fetch(`${PANDADOC_API}/documents`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PandaDoc create error: ${response.status} — ${error}`);
        }

        const doc = await response.json();
        return {
            id: doc.id,
            name: doc.name,
            status: doc.status,
            dateCreated: doc.date_created,
            dateModified: doc.date_modified,
            recipients: params.recipients,
        };
    }

    /**
     * Send a document for e-signature.
     */
    async sendDocument(documentId: string, message?: string, subject?: string): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('PandaDoc not configured');
        }

        const response = await fetch(`${PANDADOC_API}/documents/${documentId}/send`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                message: message || 'Please review and sign',
                subject: subject || 'Document ready for signature',
                silent: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`PandaDoc send error: ${response.status}`);
        }
    }

    /**
     * Get the current status of a document.
     */
    async getDocumentStatus(documentId: string): Promise<Document> {
        if (!this.isConfigured()) {
            throw new Error('PandaDoc not configured');
        }

        const response = await fetch(`${PANDADOC_API}/documents/${documentId}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`PandaDoc status error: ${response.status}`);
        }

        const doc = await response.json();
        return {
            id: doc.id,
            name: doc.name,
            status: doc.status,
            dateCreated: doc.date_created,
            dateModified: doc.date_modified,
            expirationDate: doc.expiration_date,
            recipients: (doc.recipients || []).map((r: Record<string, unknown>) => ({
                email: r.email as string,
                firstName: r.first_name as string,
                lastName: r.last_name as string,
                role: r.role as string,
            })),
        };
    }

    /**
     * Generate a shareable signing link for a recipient.
     */
    async getSigningLink(documentId: string, recipientId: string): Promise<DocumentLink> {
        if (!this.isConfigured()) {
            throw new Error('PandaDoc not configured');
        }

        const response = await fetch(
            `${PANDADOC_API}/documents/${documentId}/session`,
            {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ recipient: recipientId }),
            }
        );

        if (!response.ok) {
            throw new Error(`PandaDoc session error: ${response.status}`);
        }

        const data = await response.json();
        return {
            id: data.id,
            url: data.url || `https://app.pandadoc.com/s/${data.id}`,
            expiresAt: data.expires_at,
        };
    }
}

export const pandaDocService = new PandaDocService();
