import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';
import { ddexBuilder, type IngestionNotificationMessage } from '@indii/shared';

export const draftDspMetadata: IndiiMcpTool = {
    name: 'draft_dsp_metadata_xml',
    description: 'Draft an ERN XML fragment from release metadata. NOT delivery-ready output — no XSD/profile validation, recipient, asset, or deal blocks are included. Use mode:"delivery" to require real duration/releaseDate instead of drafted defaults.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseTitle: { type: 'string', description: 'The title of the release' },
            artists: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of primary artists',
            },
            genre: { type: 'string' },
            isrc: { type: 'string', description: 'Sound recording ISRC (12 characters)' },
            upc: { type: 'string', description: 'Universal Product Code (12 or 13 digits)' },
            duration: { type: 'string', description: 'ISO 8601 duration string (e.g., PT3M30S). Required when mode is "delivery".' },
            releaseDate: { type: 'string', description: 'Release date in YYYY-MM-DD format. Required when mode is "delivery".' },
            mode: {
                type: 'string',
                enum: ['draft', 'delivery'],
                description: 'draft (default): missing duration/releaseDate are defaulted and flagged deliveryReady:false. delivery: missing duration/releaseDate are a hard error.',
            },
        },
        required: ['releaseTitle', 'artists', 'genre', 'upc', 'isrc'],
    },
    handler: async (rawArgs: Record<string, unknown>, context: McpContext) => {

        const targetUserId = typeof rawArgs.userId === 'string'
            ? rawArgs.userId
            : typeof rawArgs.artistId === 'string'
                ? rawArgs.artistId
                : typeof rawArgs.ownerId === 'string'
                    ? rawArgs.ownerId
                    : context.user.uid;
        try {
            verifyOwnership(context, targetUserId);
        } catch (e: unknown) {
            return {
                isError: true,
                content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }]
            };
        }

        const args = rawArgs as {
            releaseTitle: string;
            artists: string[];
            genre: string;
            isrc: string;
            upc: string;
            duration?: string;
            releaseDate?: string;
            mode?: string;
        };
        if (!args.upc || !/^\d{12,13}$/.test(args.upc)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing UPC. Must be a 12 or 13 digit number.');
        }

        if (!args.isrc || !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(args.isrc)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing ISRC. Must be a standard 12-character alphanumeric code.');
        }

        if (!Array.isArray(args.artists) || args.artists.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, 'At least one artist is required.');
        }

        const mode = args.mode === 'delivery' ? 'delivery' : 'draft';

        if (mode === 'delivery' && (!args.duration || !args.releaseDate)) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'mode:"delivery" requires both duration and releaseDate — no defaults are allowed for delivery-ready output.'
            );
        }

        const senderPartyId = (process.env.DDEX_SENDER_PARTY_ID || '').trim();
        if (!senderPartyId) {
            throw new McpError(
                ErrorCode.InternalError,
                'DDEX_SENDER_PARTY_ID is not configured with the registered sender DPID. Cannot draft ERN metadata.'
            );
        }

        const defaultedFields: string[] = [];
        if (!args.duration) defaultedFields.push('duration');
        if (!args.releaseDate) defaultedFields.push('releaseDate');

        const upcVal = args.upc;
        const isrcVal = args.isrc;
        const durationVal = args.duration || 'PT3M30S';
        const messageId = `indii-msg-${Date.now()}`;
        const releaseDateVal = args.releaseDate || new Date().toISOString().split('T')[0];
        const deliveryReady = mode === 'delivery' && defaultedFields.length === 0;

        const ernMessage: IngestionNotificationMessage = {
            action: 'NewRelease',
            messageSchemaVersionId: '4.3',
            messageHeader: {
                messageThreadId: messageId,
                messageId: messageId,
                messageSender: {
                    systemIdentifier: senderPartyId,
                    entityName: 'Indii Music',
                },
                messageRecipient: {
                    systemIdentifier: 'PADPIDA_RECIPIENT_DRAFT',
                    entityName: 'Draft Recipient',
                },
                messageCreatedDateTime: new Date().toISOString(),
                messageControlType: deliveryReady ? 'LiveMessage' : 'TestMessage',
            },
            resourceList: [
                {
                    resourceType: 'SoundRecording',
                    resourceReference: 'A1',
                    resourceId: { isrc: isrcVal },
                    resourceTitle: { titleText: args.releaseTitle },
                    duration: durationVal,
                    displayArtistName: args.artists.join(', '),
                    contributors: args.artists.map(artist => ({
                        name: artist,
                        role: 'MainArtist'
                    }))
                }
            ],
            releaseList: [
                {
                    releaseReference: 'R1',
                    releaseId: { icpn: upcVal },
                    releaseTitle: { titleText: args.releaseTitle },
                    displayArtistName: args.artists.join(', '),
                    contributors: args.artists.map(artist => ({
                        name: artist,
                        role: 'MainArtist'
                    })),
                    parentalWarningType: 'NotExplicit',
                    labelName: 'Indii Music',
                    genre: { genre: args.genre },
                    releaseType: 'Album',
                    releaseResourceReferenceList: ['A1'],
                    originalReleaseDate: releaseDateVal,
                }
            ],
            dealList: [
                {
                    dealReference: 'D1',
                    dealTerms: {
                        commercialModelType: 'PayAsYouGoModel',
                        usage: [{ useType: 'OnDemandStream' }],
                        territoryCode: ['Worldwide'],
                        validityPeriod: {
                            startDate: releaseDateVal,
                            endDate: '2099-12-31'
                        }
                    }
                }
            ]
        };

        const ddexXml = ddexBuilder.buildIngestionNotification(ernMessage);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ mode, deliveryReady, defaultedFields }, null, 2),
                },
                {
                    type: 'text',
                    text: ddexXml,
                },
            ],
        };
    }
};
