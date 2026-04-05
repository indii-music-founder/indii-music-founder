/**
 * Item 242: PandaDoc Document Automation Service
 *
 * Provides contract generation, e-signature, and document
 * management for music industry agreements (label deals,
 * sync licenses, publishing splits, etc.).
 *
 * SECURITY: All API calls are proxied through Cloud Functions.
 * The PandaDoc API key never touches the client bundle.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/services/firebase';

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

const FUNCTIONS_REGION = 'us-west1';

export class PandaDocService {
    private functions = getFunctions(app, FUNCTIONS_REGION);

    /**
     * Check if PandaDoc is configured.
     * With the Cloud Function proxy, this always returns true —
     * the key is managed server-side. If the key is missing,
     * the Cloud Function will throw at call time.
     */
    isConfigured(): boolean {
        return true;
    }

    /**
     * List available document templates.
     */
    async listTemplates(): Promise<DocumentTemplate[]> {
        const callable = httpsCallable<void, DocumentTemplate[]>(
            this.functions,
            'pandadocListTemplates'
        );
        const result = await callable();
        return result.data;
    }

    /**
     * Create a new document from a template.
     * Used for generating label deals, sync licenses, etc.
     */
    async createDocument(params: CreateDocumentParams): Promise<Document> {
        const callable = httpsCallable<CreateDocumentParams, Document>(
            this.functions,
            'pandadocCreateDocument'
        );
        const result = await callable(params);
        return result.data;
    }

    /**
     * Send a document for e-signature.
     */
    async sendDocument(documentId: string, message?: string, subject?: string): Promise<void> {
        const callable = httpsCallable<{ documentId: string; message?: string; subject?: string }, { success: boolean }>(
            this.functions,
            'pandadocSendDocument'
        );
        await callable({ documentId, message, subject });
    }

    /**
     * Get the current status of a document.
     */
    async getDocumentStatus(documentId: string): Promise<Document> {
        const callable = httpsCallable<{ documentId: string }, Document>(
            this.functions,
            'pandadocGetDocumentStatus'
        );
        const result = await callable({ documentId });
        return result.data;
    }

    /**
     * Generate a shareable signing link for a recipient.
     */
    async getSigningLink(documentId: string, recipientId: string): Promise<DocumentLink> {
        const callable = httpsCallable<{ documentId: string; recipientId: string }, DocumentLink>(
            this.functions,
            'pandadocGetSigningLink'
        );
        const result = await callable({ documentId, recipientId });
        return result.data;
    }
}

export const pandaDocService = new PandaDocService();
