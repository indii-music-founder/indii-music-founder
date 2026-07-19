import { logger } from '@/utils/logger';
import { PandaDocService } from './PandaDocService';

/**
 * Item 241: Digital Signature Service
 *
 * Integrates with backend-routed signature providers.
 * Browser-side DocuSign OAuth tokens are disabled; use a Firebase callable
 * gateway for any provider that requires private credentials.
 */

export interface Collaborator {
    name: string;
    email: string;
    role: "Producer" | "Songwriter" | "Feature" | "Publisher";
    splitPercentage: number;
}

export interface SignatureEnvelope {
    envelopeId: string;
    status: 'sent' | 'delivered' | 'signed' | 'declined';
    recipients: string[];
    sentAt: string;
    provider: 'docusign' | 'pandadoc';
}

export class DigitalSignatureService {
    /**
     * Sends a generated split sheet to collaborators for signature.
     *
     * Sends a real envelope through the configured provider.
     * Missing credentials are treated as blocking configuration errors.
     */
    /**
     * Item 242: Route based on user preference (stored in localStorage).
     * Default is 'docusign'. Set to 'pandadoc' in settings to route through PandaDoc.
     */
    static getPreferredProvider(): 'docusign' | 'pandadoc' {
        const stored = localStorage.getItem('indii_signing_provider');
        return stored === 'pandadoc' ? 'pandadoc' : 'docusign';
    }

    static setPreferredProvider(provider: 'docusign' | 'pandadoc'): void {
        localStorage.setItem('indii_signing_provider', provider);
    }

    async sendSplitSheetForSignature(trackName: string, collaborators: Collaborator[]): Promise<SignatureEnvelope> {
        // Validate math
        const totalSplit = collaborators.reduce((sum, c) => sum + c.splitPercentage, 0);
        if (Math.abs(totalSplit - 100) > 0.1) {
            throw new Error(`Splits must equal 100%. Current total: ${totalSplit}%`);
        }

        // Item 242: Route to preferred provider
        const preferredProvider = DigitalSignatureService.getPreferredProvider();
        if (preferredProvider === 'pandadoc') {
            return this.sendViaPandaDoc(trackName, collaborators);
        }

        return this.sendViaDocuSign(trackName, collaborators);
    }

    /**
     * Item 242: Send via PandaDoc (fallback provider preferred by some music attorneys).
     * Uses PandaDocService which proxies through a Cloud Function to keep the API key server-side.
     */
    private async sendViaPandaDoc(trackName: string, collaborators: Collaborator[]): Promise<SignatureEnvelope> {
        logger.info(`[DigitalSignatureService] Routing to PandaDoc for "${trackName}"...`);

        const pandaDoc = new PandaDocService();
        const doc = await pandaDoc.createDocument({
            name: `Split Sheet - ${trackName}`,
            recipients: collaborators.map((c, i) => ({
                email: c.email,
                firstName: c.name.split(' ')[0] || c.name,
                lastName: c.name.split(' ').slice(1).join(' ') || '',
                role: 'signer',
                signingOrder: i + 1,
            })),
            tokens: {
                trackName,
                totalSplits: String(collaborators.length),
                collaboratorList: collaborators.map(c => `${c.name} (${c.role}): ${c.splitPercentage}%`).join('\n'),
            },
            metadata: { source: 'indii', type: 'split_sheet' },
        });

        await pandaDoc.sendDocument(doc.id, `Please review and sign the split sheet for "${trackName}".`);

        return {
            envelopeId: doc.id,
            status: 'sent',
            recipients: collaborators.map(c => c.email),
            sentAt: new Date().toISOString(),
            provider: 'pandadoc',
        };
    }

    /**
     * DocuSign requires private OAuth credentials and must be proxied by
     * Firebase before it can be used from the renderer.
     */
    private async sendViaDocuSign(
        trackName: string,
        collaborators: Collaborator[]
    ): Promise<SignatureEnvelope> {
        void trackName;
        void collaborators;
        throw new Error('DocuSign is backend-only and no secured Firebase DocuSign gateway is configured. Select PandaDoc or add a backend DocuSign function.');
    }
}

export const digitalSignatureService = new DigitalSignatureService();
