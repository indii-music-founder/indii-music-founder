import * as functions from "firebase-functions/v1";
import * as express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';

const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true' || process.env.NODE_ENV === 'production';

const app = express.default();
app.use(cors({ origin: true }));

const server = new Server(
    {
        name: 'indii-remote-mcp-server',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Map to hold active SSE transports
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
    console.log(`[MCP Server] New SSE connection request`);

    // In production this endpoint URL should match what Cloud Run exposes.
    const messageUrl = `${req.baseUrl || ''}/message`;

    const transport = new SSEServerTransport(messageUrl, res);

    // The SDK generates its own UUID sessionId
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    console.log(`[MCP Server] SSE connection established: ${sessionId}`);

    // Cleanup on disconnect
    res.on('close', () => {
        console.log(`[MCP Server] SSE connection closed: ${sessionId}`);
        transports.delete(sessionId);
    });

    await server.connect(transport);
});

app.post('/message', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
        console.warn(`[MCP Server] Message received for unknown session: ${sessionId}`);
        res.status(404).send('Session not found');
        return;
    }

    await transport.handlePostMessage(req, res);
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
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
            },
        ],
    };
});

/** Escape a value for safe interpolation into XML content (ISSUE-861). */
function escapeXmlMcp(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'draft_dsp_metadata_xml') {
        const args = request.params.arguments as unknown as {
            releaseTitle: string;
            artists: string[];
            genre: string;
            isrc: string;
            upc: string;
            duration?: string;
            releaseDate?: string;
            mode?: 'draft' | 'delivery';
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

        // ISSUE-861: delivery mode requires REAL values — no guessed date/duration
        // can go out as delivery-ready metadata.
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

        const ddexXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- DRAFT ONLY — not XSD/profile validated, no recipient/asset/deal blocks. deliveryReady=${deliveryReady} -->
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/43">
  <MessageHeader>
    <MessageThreadId>${escapeXmlMcp(messageId)}</MessageThreadId>
    <MessageId>${escapeXmlMcp(messageId)}</MessageId>
    <MessageSender>
      <PartyId>${escapeXmlMcp(senderPartyId)}</PartyId>
      <PartyName>
        <FullName>Indii Music</FullName>
      </PartyName>
    </MessageSender>
    <MessageCreatedDateTime>${new Date().toISOString()}</MessageCreatedDateTime>
  </MessageHeader>
  <ResourceList>
    <SoundRecording>
      <ResourceReference>A1</ResourceReference>
      <Type>Audio</Type>
      <SoundRecordingId>
        <ISRC>${escapeXmlMcp(isrcVal)}</ISRC>
      </SoundRecordingId>
      <ReferenceTitle>
        <TitleText>${escapeXmlMcp(args.releaseTitle)}</TitleText>
      </ReferenceTitle>
      <Duration>${escapeXmlMcp(durationVal)}</Duration>
    </SoundRecording>
  </ResourceList>
  <ReleaseList>
    <Release>
      <ReleaseId>
        <ICPN IsEan="false">${escapeXmlMcp(upcVal)}</ICPN>
      </ReleaseId>
      <ReferenceTitle>
        <TitleText>${escapeXmlMcp(args.releaseTitle)}</TitleText>
      </ReferenceTitle>
      <ReleaseResourceReferenceList>
        <ReleaseResourceReference>A1</ReleaseResourceReference>
      </ReleaseResourceReferenceList>
      <ReleaseType>Album</ReleaseType>
      <ReleaseDetailsByTerritory>
        <TerritoryCode>Worldwide</TerritoryCode>
        <DisplayArtist>
          <PartyName>
            <FullName>${escapeXmlMcp(args.artists.join(', '))}</FullName>
          </PartyName>
          <ArtistRole>MainArtist</ArtistRole>
        </DisplayArtist>
        <Title>
          <TitleText>${escapeXmlMcp(args.releaseTitle)}</TitleText>
        </Title>
        <Genre>
          <GenreText>${escapeXmlMcp(args.genre)}</GenreText>
        </Genre>
        <OriginalReleaseDate>${escapeXmlMcp(releaseDateVal)}</OriginalReleaseDate>
      </ReleaseDetailsByTerritory>
    </Release>
  </ReleaseList>
</ern:NewReleaseMessage>`;

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

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

export const mcpEndpoint = functions
    .runWith({ enforceAppCheck: false })
    .https.onRequest(app);
export const expressApp = app;
