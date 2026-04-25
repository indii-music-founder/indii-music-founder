/**
 * OpenAPI Schema Generator
 *
 * Generates OpenAPI 3.1.0 specification for the IndiiOS Analytics API
 * Includes all REST endpoints, request/response schemas, and authentication
 */

interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  schema: Record<string, unknown>;
}

interface OpenAPIResponse {
  description: string;
  content?: {
    'application/json': {
      schema: Record<string, unknown>;
    };
  };
}

interface OpenAPIOperation {
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: Record<string, unknown>;
      };
    };
  };
  responses: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
}

interface OpenAPIPath {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
}

/**
 * Generate complete OpenAPI specification
 */
export function generateOpenAPISpec(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'IndiiOS Analytics & Distribution API',
      description: 'REST API for the IndiiOS platform providing analytics, distribution, and account management',
      version: '1.0.0',
      contact: {
        name: 'IndiiOS Support',
        email: 'support@indiios.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://indiios.com/license',
      },
    },
    servers: [
      {
        url: 'https://api.indiios.com',
        description: 'Production',
      },
      {
        url: 'https://staging-api.indiios.com',
        description: 'Staging',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token',
        },
      },
      schemas: {
        Track: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique track identifier' },
            title: { type: 'string', description: 'Track title' },
            genre: { type: 'string', description: 'Music genre' },
            duration: { type: 'number', description: 'Duration in seconds' },
            isrc: { type: 'string', description: 'ISRC code' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'title'],
        },
        Distribution: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Distribution ID' },
            status: {
              type: 'string',
              enum: ['draft', 'processing', 'submitted', 'failed'],
            },
            distributors: { type: 'array', items: { type: 'string' } },
            trackIds: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            submittedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'status'],
        },
        AnalyticsEvent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            eventType: { type: 'string' },
            userId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            data: { type: 'object', additionalProperties: true },
          },
          required: ['eventType', 'userId', 'timestamp'],
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'number' },
                requestId: { type: 'string' },
                version: { type: 'string' },
              },
            },
          },
          required: ['success', 'meta'],
        },
      },
    },
    paths: {
      '/api/tracks': {
        get: {
          summary: 'List user tracks',
          operationId: 'listTracks',
          tags: ['Tracks'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 50 },
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 0 },
            },
          ],
          responses: {
            '200': {
              description: 'List of tracks',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/Track' } },
                    },
                  },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
        post: {
          summary: 'Create new track',
          operationId: 'createTrack',
          tags: ['Tracks'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    genre: { type: 'string' },
                    duration: { type: 'number' },
                  },
                  required: ['title'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Track created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Track' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/api/tracks/{trackId}': {
        get: {
          summary: 'Get track details',
          operationId: 'getTrack',
          tags: ['Tracks'],
          parameters: [
            {
              name: 'trackId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Track details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Track' },
                },
              },
            },
            '404': {
              description: 'Track not found',
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
        put: {
          summary: 'Update track',
          operationId: 'updateTrack',
          tags: ['Tracks'],
          parameters: [
            {
              name: 'trackId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Track updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Track' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
        delete: {
          summary: 'Delete track',
          operationId: 'deleteTrack',
          tags: ['Tracks'],
          parameters: [
            {
              name: 'trackId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '204': {
              description: 'Track deleted',
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/api/distributions': {
        post: {
          summary: 'Create distribution',
          operationId: 'createDistribution',
          tags: ['Distributions'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    trackIds: { type: 'array', items: { type: 'string' } },
                    distributors: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['trackIds', 'distributors'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Distribution created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Distribution' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/api/distributions/{distributionId}': {
        get: {
          summary: 'Get distribution details',
          operationId: 'getDistribution',
          tags: ['Distributions'],
          parameters: [
            {
              name: 'distributionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Distribution details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Distribution' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/api/distributions/{distributionId}/submit': {
        post: {
          summary: 'Submit distribution',
          operationId: 'submitDistribution',
          tags: ['Distributions'],
          parameters: [
            {
              name: 'distributionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Distribution submitted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Distribution' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/api/analytics/events': {
        get: {
          summary: 'Query analytics events',
          operationId: 'queryAnalytics',
          tags: ['Analytics'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 100 },
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 0 },
            },
          ],
          responses: {
            '200': {
              description: 'Events list',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AnalyticsEvent' },
                  },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/api/profile': {
        get: {
          summary: 'Get user profile',
          operationId: 'getProfile',
          tags: ['Account'],
          responses: {
            '200': {
              description: 'User profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        } as OpenAPIOperation,
      } as OpenAPIPath,
      '/health': {
        get: {
          summary: 'Health check',
          operationId: 'health',
          tags: ['System'],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      version: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        } as OpenAPIOperation,
      } as OpenAPIPath,
    },
    tags: [
      { name: 'Tracks', description: 'Music track management' },
      { name: 'Distributions', description: 'Distribution pipeline' },
      { name: 'Analytics', description: 'Analytics and events' },
      { name: 'Account', description: 'User account management' },
      { name: 'System', description: 'System endpoints' },
    ],
  };
}

/**
 * Write OpenAPI spec to file
 */
export async function writeOpenAPISpec(filePath: string): Promise<void> {
  const spec = generateOpenAPISpec();
  const fs = await import('fs').then(m => m.promises);
  await fs.writeFile(filePath, JSON.stringify(spec, null, 2));
  console.log(`[OpenAPI] Spec written to ${filePath}`);
}

/**
 * CLI: Generate and write spec
 */
if (require.main === module) {
  const outputPath = process.env.OUTPUT_PATH || 'openapi.json';
  writeOpenAPISpec(outputPath).catch(err => {
    console.error('[OpenAPI] Generation failed:', err);
    process.exit(1);
  });
}
