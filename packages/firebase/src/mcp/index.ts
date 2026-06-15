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
                name: 'format_dsp_metadata',
                description: 'Format digital service provider metadata based on strict release requirements.',
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
                        duration: { type: 'string', description: 'Optional ISO 8601 duration string (e.g., PT3M30S)' },
                        releaseDate: { type: 'string', description: 'Optional release date in YYYY-MM-DD format' },
                    },
                    required: ['releaseTitle', 'artists', 'genre', 'upc', 'isrc'],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'format_dsp_metadata') {
        const args = request.params.arguments as unknown as {
            releaseTitle: string;
            artists: string[];
            genre: string;
            isrc: string;
            upc: string;
            duration?: string;
            releaseDate?: string;
        };

        if (!args.upc || !/^\d{12,13}$/.test(args.upc)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing UPC. Must be a 12 or 13 digit number.');
        }

        if (!args.isrc || !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(args.isrc)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid or missing ISRC. Must be a standard 12-character alphanumeric code.');
        }

        const upcVal = args.upc;
        const isrcVal = args.isrc;
        const durationVal = args.duration || 'PT3M30S';
        const messageId = `indii-msg-${Date.now()}`;
        const releaseDateVal = args.releaseDate || new Date().toISOString().split('T')[0];
        
        const ddexXml = `<?xml version="1.0" encoding="utf-8"?>
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/411">
  <MessageHeader>
    <MessageThreadId>${messageId}</MessageThreadId>
    <MessageId>${messageId}</MessageId>
    <MessageSender>
      <PartyId>PADPIDA2014120901U</PartyId>
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
        <ISRC>${isrcVal}</ISRC>
      </SoundRecordingId>
      <ReferenceTitle>
        <TitleText>${args.releaseTitle}</TitleText>
      </ReferenceTitle>
      <Duration>${durationVal}</Duration>
    </SoundRecording>
  </ResourceList>
  <ReleaseList>
    <Release>
      <ReleaseId>
        <ICPN IsEan="false">${upcVal}</ICPN>
      </ReleaseId>
      <ReferenceTitle>
        <TitleText>${args.releaseTitle}</TitleText>
      </ReferenceTitle>
      <ReleaseResourceReferenceList>
        <ReleaseResourceReference>A1</ReleaseResourceReference>
      </ReleaseResourceReferenceList>
      <ReleaseType>Album</ReleaseType>
      <ReleaseDetailsByTerritory>
        <TerritoryCode>Worldwide</TerritoryCode>
        <DisplayArtist>
          <PartyName>
            <FullName>${args.artists.join(', ')}</FullName>
          </PartyName>
          <ArtistRole>MainArtist</ArtistRole>
        </DisplayArtist>
        <Title>
          <TitleText>${args.releaseTitle}</TitleText>
        </Title>
        <Genre>
          <GenreText>${args.genre}</GenreText>
        </Genre>
        <OriginalReleaseDate>${releaseDateVal}</OriginalReleaseDate>
      </ReleaseDetailsByTerritory>
    </Release>
  </ReleaseList>
</ern:NewReleaseMessage>`;

        return {
            content: [{
                type: 'text',
                text: ddexXml
            }]
        };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

export const mcpEndpoint = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK })
    .https.onRequest(app);
export const expressApp = app;
