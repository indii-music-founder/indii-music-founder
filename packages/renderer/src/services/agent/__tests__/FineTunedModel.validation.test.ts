/**
 * FineTunedModel.validation.test.ts
 *
 * Validates the fine-tuned model registry integrity:
 *   - Endpoint format validation (3 tests)
 *   - Agent coverage (1 test)
 *   - Feature flag toggle behavior (2 tests)
 *   - No stale endpoints (1 test)
 *   - Training job tracking (3 tests)
 *   - Registry completeness cross-reference (5 tests)
 *
 * Total: 15 test cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    DIRECT_FINE_TUNED_MODEL_REGISTRY,
    FINE_TUNED_MODEL_ALIASES,
    FINE_TUNED_MODEL_REGISTRY,
    getFineTunedModel,
} from '../fine-tuned-models';
import { VALID_AGENT_IDS, type ValidAgentId } from '../types';
import { SPOKE_AGENT_IDS } from './AgentStressTest.harness';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false,
        VITE_FUNCTIONS_URL: 'https://example.com/functions',
        VITE_USE_FINE_TUNED_AGENTS: 'true',
        DEV: true,
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    remoteConfig: { getValue: vi.fn(), getAll: vi.fn() },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() },
}));

// ============================================================================
// Constants
// ============================================================================

/** Expected Vertex Autonomous endpoint format */
const ENDPOINT_FORMAT = /^projects\/\d+\/locations\/[a-z0-9-]+\/endpoints\/\d+$/;

/** Expected GCP project number (from the existing registry) */
const EXPECTED_PROJECT_NUMBER = '223837784072';

// ============================================================================
// Test Suite
// ============================================================================

describe('🔬 Fine-Tuned Model Registry Validation (15 tests)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Endpoint Format Validation ──────────────────────────────────────

    describe('Endpoint Format Validation (3 tests)', () => {
        it('all non-undefined entries should match Vertex Autonomous endpoint format', () => {
            const entries = Object.entries(FINE_TUNED_MODEL_REGISTRY);

            entries.forEach(([_agentId, endpoint]) => {
                if (endpoint !== undefined) {
                    expect(endpoint).toMatch(ENDPOINT_FORMAT);
                }
            });
        });

        it('endpoints should contain valid GCP project number', () => {
            const entries = Object.entries(FINE_TUNED_MODEL_REGISTRY);

            entries.forEach(([_agentId, endpoint]) => {
                if (endpoint !== undefined) {
                    // Extract project number from endpoint
                    const match = endpoint.match(/^projects\/(\d+)\//);
                    expect(match).not.toBeNull();
                    if (match && match[1]) {
                        expect(match[1].length).toBeGreaterThanOrEqual(10);
                    }
                }
            });
        });

        it('endpoints should contain valid location (us-central1)', () => {
            const entries = Object.entries(FINE_TUNED_MODEL_REGISTRY);

            entries.forEach(([_agentId, endpoint]) => {
                if (endpoint !== undefined) {
                    const match = endpoint.match(/\/locations\/([a-z0-9-]+)\//);
                    expect(match).not.toBeNull();
                    // Location should be a valid GCP region
                    expect(match![1]).toMatch(/^[a-z]+-[a-z]+\d?(-[a-z]+\d?)?$/);
                }
            });
        });
    });

    // ─── Agent Coverage ──────────────────────────────────────────────────

    describe('Agent Coverage (1 test)', () => {
        it('all agents in VALID_AGENT_IDS should have a registry entry with an endpoint', () => {
            const registryKeys = new Set(Object.keys(FINE_TUNED_MODEL_REGISTRY));

            VALID_AGENT_IDS.forEach(agentId => {
                expect(
                    registryKeys.has(agentId),
                    `Agent "${agentId}" missing from FINE_TUNED_MODEL_REGISTRY`
                ).toBe(true);
                expect(
                    FINE_TUNED_MODEL_REGISTRY[agentId],
                    `Agent "${agentId}" must resolve to a fine-tuned endpoint`
                ).toMatch(ENDPOINT_FORMAT);
            });
        });
    });

    // ─── Feature Flag Toggle ─────────────────────────────────────────────

    describe('Feature Flag Toggle Behavior (2 tests)', () => {
        it('getFineTunedModel returns endpoint when feature flag is on', () => {
            // getFineTunedModel should return the endpoint for agents with live models
            const liveAgents = Object.entries(FINE_TUNED_MODEL_REGISTRY)
                .filter(([_id, endpoint]) => endpoint !== undefined);

            if (liveAgents.length > 0) {
                const firstAgent = liveAgents[0];
                if (firstAgent) {
                    const [agentId] = firstAgent;
                    const model = getFineTunedModel(agentId as ValidAgentId);
                    expect(model).toMatch(ENDPOINT_FORMAT);
                }
            }
        });

        it('getFineTunedModel exists and is callable', () => {
            expect(typeof getFineTunedModel).toBe('function');

            // Should not throw for any valid agent ID
            VALID_AGENT_IDS.forEach(agentId => {
                expect(() => getFineTunedModel(agentId)).not.toThrow();
            });

            // Invalid IDs should fail loudly instead of silently using a base model.
            expect(() => getFineTunedModel('nonexistent-agent' as ValidAgentId)).toThrow();
        });
    });

    // ─── No Stale Endpoints ──────────────────────────────────────────────

    describe('No Stale Endpoints (1 test)', () => {
        it('all endpoints should reference the same GCP project', () => {
            const entries = Object.entries(FINE_TUNED_MODEL_REGISTRY);
            const projectNumbers = new Set<string>();

            entries.forEach(([_agentId, endpoint]) => {
                if (endpoint !== undefined && typeof endpoint === 'string') {
                    const match = endpoint.match(/^projects\/(\d+)\//);
                    if (match && match[1]) {
                        projectNumbers.add(match[1]);
                    }
                }
            });

            // All endpoints should reference the same project
            // (prevents accidental cross-project stale endpoints)
            expect(projectNumbers.size).toBeLessThanOrEqual(1);

            if (projectNumbers.size === 1) {
                expect(projectNumbers.has(EXPECTED_PROJECT_NUMBER)).toBe(true);
            }
        });
    });

    // ─── Training Job Tracking ───────────────────────────────────────────

    describe('Training Job Tracking (3 tests)', () => {
        it('no valid agent should have an undefined endpoint', () => {
            const undefinedAgents = Object.entries(FINE_TUNED_MODEL_REGISTRY)
                .filter(([_id, endpoint]) => !endpoint)
                .map(([id]) => id);

            expect(undefinedAgents).toEqual([]);
        });

        it('count of resolved endpoints should cover every valid agent', () => {
            const liveCount = Object.values(FINE_TUNED_MODEL_REGISTRY)
                .filter(Boolean)
                .length;

            expect(liveCount).toBe(VALID_AGENT_IDS.length);
        });

        it('direct endpoint IDs should be unique; alias duplicates must be explicit', () => {
            const endpoints = Object.values(DIRECT_FINE_TUNED_MODEL_REGISTRY);

            expect(new Set(endpoints).size).toBe(endpoints.length);

            Object.entries(FINE_TUNED_MODEL_ALIASES).forEach(([agentId, targetId]) => {
                expect(VALID_AGENT_IDS).toContain(agentId as ValidAgentId);
                expect(VALID_AGENT_IDS).toContain(targetId);
                expect(DIRECT_FINE_TUNED_MODEL_REGISTRY[targetId as keyof typeof DIRECT_FINE_TUNED_MODEL_REGISTRY])
                    .toBeDefined();
            });
        });
    });

    // ─── Registry Completeness Cross-Reference ──────────────────────────

    describe('Registry Completeness Cross-Reference (5 tests)', () => {
        it('registry should contain exactly the expected agent count', () => {
            const registryKeys = Object.keys(FINE_TUNED_MODEL_REGISTRY);
            // Should match the number of unique agents (heads + workers + legacy aliases like creative-director, road-manager)
            // Bound bumped 2026-05-06 when Legal workers (legal.contracts, legal.compliance) were added.
            expect(registryKeys.length).toBe(VALID_AGENT_IDS.length);
        });

        it('no endpoint should be empty string', () => {
            Object.entries(FINE_TUNED_MODEL_REGISTRY).forEach(([_agentId, endpoint]) => {
                expect(endpoint.length).toBeGreaterThan(0);
                expect(endpoint.trim()).toBe(endpoint);
            });
        });

        it('key specialist agents should have live endpoints', () => {
            const criticalAgents = ['finance', 'legal', 'distribution', 'marketing', 'brand', 'generalist'];

            criticalAgents.forEach(agentId => {
                const endpoint = FINE_TUNED_MODEL_REGISTRY[agentId as keyof typeof FINE_TUNED_MODEL_REGISTRY];
                expect(
                    endpoint !== undefined,
                    `Critical agent "${agentId}" should have a live fine-tuned endpoint`
                ).toBe(true);
            });
        });

        it('registry keys should not contain any unknown agent IDs', () => {
            const registryKeys = Object.keys(FINE_TUNED_MODEL_REGISTRY);
            const allKnownIds = [...VALID_AGENT_IDS];

            registryKeys.forEach(key => {
                expect(
                    allKnownIds.includes(key as unknown as typeof allKnownIds[number]),
                    `Unknown agent ID "${key}" found in registry`
                ).toBe(true);
            });
        });

        it('all spoke agents in ALL_AGENT_IDS should be in registry or have alias', () => {
            SPOKE_AGENT_IDS.forEach(agentId => {
                const hasEntry = agentId in FINE_TUNED_MODEL_REGISTRY;
                expect(
                    hasEntry,
                    `Spoke agent "${agentId}" should have a registry entry`
                ).toBe(true);
            });
        });
    });
});
