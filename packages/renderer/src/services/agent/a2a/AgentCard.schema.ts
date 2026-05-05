import { z } from 'zod';

export const CapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchemaRef: z.string(),
  outputSchemaRef: z.string(),
  streaming: z.boolean(),
});

export const AgentCardSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  agentId: z.string(),
  displayName: z.string(),
  description: z.string(),
  capabilities: z.array(CapabilitySchema),
  inputSchemas: z.record(z.any()),
  outputSchemas: z.record(z.any()),
  costModel: z.object({
    perTokenInUsd: z.number(),
    perTokenOutUsd: z.number(),
    perInvocationUsd: z.number().optional(),
  }),
  riskTier: z.enum(['read', 'write', 'destructive']),
  publicKeyJwk: z.any().optional(),
  sla: z.object({
    modeSync: z.object({
      p50Ms: z.number(),
      p99Ms: z.number(),
    }),
    modeStream: z.object({
      firstByteMs: z.number(),
    }),
  }),
});

export type Capability = z.infer<typeof CapabilitySchema>;
export type AgentCard = z.infer<typeof AgentCardSchema>;
