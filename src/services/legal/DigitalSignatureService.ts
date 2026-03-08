import { logger } from '@/utils/logger';

/**
 * Item 241: Digital Signature Service
 *
 * Integrates with DocuSign eSignature REST API v2.1 for real envelope sending.
 * Falls back gracefully when credentials are not configured (dev/staging environments).
 *
 * Required env vars for production:
 *   VITE_DOCUSIGN_BASE_URL       - e.g. https://demo.docusign.net/restapi (sandbox) or https://na4.docusign.net/restapi (production)
 *   VITE_DOCUSIGN_ACCOUNT_ID     - DocuSign account ID
 *   VITE_DOCUSIGN_ACCESS_TOKEN   - OAuth2 access token (use server-side refresh in production)
 */

export interface Collaborator {
    name: string;
    email: string;
    role: "Producer" | "Songwriter" | "Feature" | "Publisher";
    splitPercentage: number;
}

export interface SignatureEnvelope {
    envelopeId: string;
    status: 'sent' | 'delivered' | 'signed' | 'declined' | 'pending_config';
    recipients: string[];
    sentAt: string;
    provider: 'docusign' | 'mock';
}

/**
 * DocuSign Envelope Creation Payload
 * Simplified shape — see https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopes/create/
 */
interface DocuSignEnvelopeRequest {
    emailSubject: string;
    recipients: {
        signers: Array<{
            email: string;
            name: string;
            recipientId: string;
            routingOrder: string;
        }>;
    };
    documents: Array<{
        documentBase64: string;
        name: string;
        fileExtension: string;
        documentId: string;
    }>;
    status: 'sent' | 'created';
}

interface DocuSignConfig {
    baseUrl: string;
    accountId: string;
    accessToken: string;
}

function getDocuSignConfig(): DocuSignConfig | null {
    const baseUrl = import.meta.env.VITE_DOCUSIGN_BASE_URL;
    const accountId = import.meta.env.VITE_DOCUSIGN_ACCOUNT_ID;
    const accessToken = import.meta.env.VITE_DOCUSIGN_ACCESS_TOKEN;

    if (!baseUrl || !accountId || !accessToken) {
        return null;
    }

    return { baseUrl, accountId, accessToken };
}

/**
 * Generate a simple text-based split sheet document.
 * In production, replace with a proper PDF generator (pdfkit/jspdf).
 */
function generateSplitSheetContent(trackName: string, collaborators: Collaborator[]): string {
    const header = `SPLIT SHEET AGREEMENT\n\nTrack: ${trackName}\nDate: ${new Date().toISOString().split('T')[0]}\n\n`;
    const splits = collaborators
        .map(c => `${c.name} (${c.role}): ${c.splitPercentage}% — ${c.email}`)
        .join('\n');
    const footer = `\n\nTotal: ${collaborators.reduce((s, c) => s + c.splitPercentage, 0)}%\n\nBy signing below, each party agrees to the split percentages listed above.`;

    return header + splits + footer;
}

export class DigitalSignatureService {
    /**
     * Sends a generated split sheet to collaborators for signature.
     *
     * If DocuSign credentials are configured, sends a real envelope via the API.
     * Otherwise, returns a mock envelope with status 'pending_config' and logs a warning.
     */
    async sendSplitSheetForSignature(trackName: string, collaborators: Collaborator[]): Promise<SignatureEnvelope> {
        // Validate math
        const totalSplit = collaborators.reduce((sum, c) => sum + c.splitPercentage, 0);
        if (Math.abs(totalSplit - 100) > 0.1) {
            throw new Error(`Splits must equal 100%. Current total: ${totalSplit}%`);
        }

        const config = getDocuSignConfig();

        if (!config) {
            logger.warn('[DigitalSignatureService] DocuSign credentials not configured. Returning mock envelope.');
            logger.warn('[DigitalSignatureService] Set VITE_DOCUSIGN_BASE_URL, VITE_DOCUSIGN_ACCOUNT_ID, and VITE_DOCUSIGN_ACCESS_TOKEN to enable real signing.');

            return {
                envelopeId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                status: 'pending_config',
                recipients: collaborators.map(c => c.email),
                sentAt: new Date().toISOString(),
                provider: 'mock',
            };
        }

        return this.sendViaDocuSign(config, trackName, collaborators);
    }

    /**
     * Send a real envelope via DocuSign eSignature REST API v2.1.
     */
    private async sendViaDocuSign(
        config: DocuSignConfig,
        trackName: string,
        collaborators: Collaborator[]
    ): Promise<SignatureEnvelope> {
        try {
            logger.info(`[DigitalSignatureService] Sending real DocuSign envelope for "${trackName}"...`);

            // Generate the split sheet content and base64-encode it
            const content = generateSplitSheetContent(trackName, collaborators);
            const contentBase64 = btoa(unescape(encodeURIComponent(content)));

            // Build DocuSign envelope payload
            const envelopePayload: DocuSignEnvelopeRequest = {
                emailSubject: `Split Sheet Agreement — "${trackName}" — Action Required`,
                recipients: {
                    signers: collaborators.map((c, i) => ({
                        email: c.email,
                        name: c.name,
                        recipientId: String(i + 1),
                        routingOrder: String(i + 1),
                    })),
                },
                documents: [
                    {
                        documentBase64: contentBase64,
                        name: `Split Sheet - ${trackName}.txt`,
                        fileExtension: 'txt',
                        documentId: '1',
                    },
                ],
                status: 'sent', // Send immediately
            };

            // POST to DocuSign Envelopes API
            const url = `${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(envelopePayload),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                logger.error(`[DigitalSignatureService] DocuSign API Error: ${response.status} ${errorBody}`);
                throw new Error(`DocuSign API returned ${response.status}: ${errorBody}`);
            }

            const result = await response.json();
            const envelopeId = result.envelopeId;

            logger.info(`[DigitalSignatureService] Envelope ${envelopeId} sent to: ${collaborators.map(c => c.email).join(', ')}`);

            return {
                envelopeId,
                status: 'sent',
                recipients: collaborators.map(c => c.email),
                sentAt: new Date().toISOString(),
                provider: 'docusign',
            };
        } catch (error: any) {
            logger.error('[DigitalSignatureService] Failed to send split sheet via DocuSign', error);
            throw new Error(`Failed to send split sheet: ${error.message}`);
        }
    }
}

export const digitalSignatureService = new DigitalSignatureService();