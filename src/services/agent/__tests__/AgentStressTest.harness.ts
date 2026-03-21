/**
 * AgentStressTest.harness.ts
 *
 * Shared test infrastructure for the agent stress test suite.
 * Provides mock factories, grading rubric, and domain keyword maps
 * so individual test files don't duplicate 100+ lines of boilerplate.
 */

import { vi } from 'vitest';

// ============================================================================
// Agent Domain Knowledge Map
// ============================================================================

/**
 * Maps each agent to its core domain keywords (used for routing & competency tests).
 * Derived from the SPECIALIST ROUTING TABLE in GeneralistAgent.ts.
 */
export const AGENT_DOMAIN_KEYWORDS: Record<string, string[]> = {
    finance: ['royalties', 'recoupment', 'advance', 'budget', 'expense', 'invoice', 'tax', 'revenue', 'earnings', 'profit', 'waterfall'],
    legal: ['contract', 'agreement', 'terms', 'copyright', 'trademark', 'clearance', 'sample', 'legal', 'rights', 'dispute', 'NDA'],
    distribution: ['DSP', 'distributor', 'DDEX', 'ISRC', 'UPC', 'Spotify', 'Apple Music', 'release metadata', 'SFTP'],
    marketing: ['campaign', 'marketing plan', 'release strategy', 'playlist pitch', 'advertising', 'audience', 'pre-save', 'funnel'],
    brand: ['logo', 'colors', 'fonts', 'visual identity', 'brand guidelines', 'brand kit', 'show bible', 'identity integrity'],
    video: ['music video', 'visual story', 'storyboard', 'VFX', 'motion', 'animation', 'video production', 'Veo'],
    music: ['BPM', 'key', 'tempo', 'audio analysis', 'mix', 'master', 'stem', 'arrangement', 'sound design', 'LUFS'],
    social: ['social media', 'caption', 'TikTok', 'Instagram', 'Twitter', 'content calendar', 'community', 'engagement'],
    publicist: ['press release', 'media coverage', 'PR', 'interview', 'crisis', 'journalist', 'EPK', 'blog'],
    licensing: ['sync deal', 'licensing fee', 'usage rights', 'film/TV placement', 'commercial license'],
    publishing: ['PRO registration', 'publishing deal', 'mechanical royalties', 'catalog management', 'ASCAP', 'BMI'],
    road: ['tour', 'itinerary', 'venue', 'travel', 'logistics', 'rider', 'stage plot', 'advancing'],
    merchandise: ['merch', 'merchandise', 't-shirt', 'print-on-demand', 'POD', 'product design', 'store'],
    screenwriter: ['script', 'screenplay', 'story', 'dialogue', 'narrative', 'character', 'plot'],
    director: ['album art', 'cover design', 'artwork', 'image generation', 'creative assets', 'visual architect'],
    security: ['security audit', 'vulnerability', 'access control', 'credentials', 'compliance', 'firewall'],
    devops: ['deployment', 'CI/CD', 'infrastructure', 'hosting', 'Firebase', 'cloud', 'pipeline', 'Kubernetes'],
    producer: ['call sheet', 'script breakdown', 'crew', 'shoot', 'location', 'production schedule', 'permit'],
    curriculum: ['learning path', 'tutorial', 'education', 'course', 'quiz', 'lesson', 'music business basics'],
    generalist: ['help me', 'what can you do', 'album rollout', 'multiple things', 'general question'],
};

/**
 * Tool authorization matrix — which agents can call which tools.
 * Derived from TOOL_AUTHORIZATION.md.
 */
export const TOOL_AUTHORIZATION: Record<string, string[]> = {
    generalist: ['delegate_task', 'request_approval', 'save_memory', 'recall_memories', 'search_knowledge', 'verify_output', 'generate_image', 'generate_video', 'batch_edit_images', 'generate_audio', 'generate_social_post', 'create_project', 'list_projects', 'list_files'],
    finance: ['search_knowledge', 'verify_output', 'analyze_budget', 'calculate_royalty_waterfall', 'audit_metadata', 'analyze_receipt', 'generate_split_sheet', 'credential_vault', 'list_projects'],
    legal: ['search_knowledge', 'verify_output', 'analyze_contract', 'generate_split_sheet', 'sample_clearance', 'copyright_registration', 'list_projects'],
    distribution: ['search_knowledge', 'verify_output', 'issue_ddex_package', 'assign_isrc', 'validate_audio_quality', 'sftp_upload', 'audit_metadata', 'list_files', 'credential_vault', 'list_projects'],
    marketing: ['search_knowledge', 'verify_output', 'generate_image', 'generate_video', 'generate_social_post', 'generate_press_release', 'pitch_playlist', 'schedule_social_post', 'list_projects'],
    brand: ['search_knowledge', 'verify_output', 'generate_image', 'batch_edit_images', 'list_files', 'list_projects'],
    video: ['search_knowledge', 'verify_output', 'generate_image', 'generate_video', 'batch_edit_images', 'analyze_audio', 'list_files', 'list_projects'],
    music: ['search_knowledge', 'verify_output', 'generate_audio', 'analyze_audio', 'detect_bpm_key', 'loudness_normalize', 'validate_audio_quality', 'pitch_playlist', 'list_files', 'list_projects'],
    social: ['search_knowledge', 'verify_output', 'generate_image', 'generate_video', 'generate_social_post', 'schedule_social_post', 'credential_vault', 'list_projects'],
    publicist: ['search_knowledge', 'verify_output', 'generate_image', 'generate_social_post', 'generate_press_release', 'credential_vault', 'list_projects'],
    licensing: ['search_knowledge', 'verify_output', 'analyze_contract', 'generate_split_sheet', 'sample_clearance', 'copyright_registration', 'assign_isrc', 'audit_metadata', 'analyze_audio', 'list_projects'],
    publishing: ['search_knowledge', 'verify_output', 'analyze_contract', 'generate_split_sheet', 'copyright_registration', 'calculate_royalty_waterfall', 'audit_metadata', 'assign_isrc', 'list_projects'],
    road: ['search_knowledge', 'verify_output', 'analyze_budget', 'analyze_receipt', 'credential_vault', 'list_projects'],
    merchandise: ['search_knowledge', 'verify_output', 'generate_image', 'batch_edit_images', 'generate_social_post', 'analyze_budget', 'list_projects'],
    director: ['search_knowledge', 'verify_output', 'generate_image', 'generate_video', 'batch_edit_images', 'list_files', 'list_projects'],
    producer: ['search_knowledge', 'verify_output', 'generate_audio', 'analyze_audio', 'detect_bpm_key', 'loudness_normalize', 'validate_audio_quality', 'generate_split_sheet', 'list_files', 'list_projects'],
    security: ['search_knowledge', 'verify_output', 'vulnerability_scan', 'credential_vault'],
    devops: ['search_knowledge', 'verify_output', 'vulnerability_scan', 'deploy_service', 'credential_vault'],
    screenwriter: ['search_knowledge', 'verify_output', 'list_projects'],
    curriculum: ['search_knowledge', 'verify_output', 'save_memory', 'recall_memories', 'list_projects'],
};

/**
 * Hub-only tools that no specialist may invoke.
 */
export const HUB_ONLY_TOOLS = ['delegate_task', 'request_approval'];

/**
 * All valid agent IDs — mirrors VALID_AGENT_IDS from types.ts.
 */
export const ALL_AGENT_IDS = [
    'marketing', 'legal', 'finance', 'producer', 'director', 'screenwriter',
    'video', 'social', 'publicist', 'road', 'publishing', 'licensing',
    'brand', 'devops', 'security', 'merchandise', 'distribution', 'music',
    'curriculum', 'keeper', 'generalist'
] as const;

/**
 * Specialist (spoke) agents — all except generalist.
 */
export const SPOKE_AGENT_IDS = ALL_AGENT_IDS.filter(id => id !== 'generalist' && id !== 'keeper');

// ============================================================================
// Grading Rubric & Scoring
// ============================================================================

export interface GradeDimension {
    /** 0-5 scale per scorecard rubric */
    score: number;
    /** Brief justification */
    reason: string;
}

export interface AgentGradeCard {
    agentId: string;
    domainCompetency: GradeDimension;
    routingAccuracy: GradeDimension;
    guardRails: GradeDimension;
    toolCompliance: GradeDimension;
    edgeCaseHandling: GradeDimension;
    overallGrade: string; // A-F
    totalScore: number;   // 0-25
}

/**
 * Compute a letter grade from a numeric total (0-25 scale).
 */
export function computeLetterGrade(total: number): string {
    if (total >= 23) return 'A';
    if (total >= 20) return 'B';
    if (total >= 15) return 'C';
    if (total >= 10) return 'D';
    return 'F';
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a standard mock store state for agent tests.
 */
export function createMockStoreState(overrides: Record<string, unknown> = {}) {
    const state: Record<string, unknown> = {
        agentHistory: [],
        addAgentMessage: vi.fn((msg: Record<string, unknown>) => {
            (state.agentHistory as Record<string, unknown>[]).push(msg);
        }),
        updateAgentMessage: vi.fn((id: string, update: Record<string, unknown>) => {
            const history = state.agentHistory as Record<string, unknown>[];
            const msg = history.find((m) => m.id === id);
            if (msg) Object.assign(msg, update);
        }),
        projects: [{ id: 'p1', name: 'Test Project' }],
        currentProjectId: 'p1',
        currentOrganizationId: 'org1',
        currentModule: 'dashboard',
        userProfile: { brandKit: { tone: 'Professional' } },
        whiskState: null,
        uploadedImages: [],
        ...overrides,
    };
    return state;
}

/**
 * Creates a mock AI routing response (what the orchestrator returns).
 */
export function createRoutingResponse(targetAgentId: string, confidence = 0.95) {
    return {
        text: () => JSON.stringify({
            targetAgentId,
            confidence,
            reasoning: `Routing to ${targetAgentId} based on domain keywords`,
        }),
        functionCalls: () => [],
    };
}

/**
 * Creates a mock agent execute response.
 */
export function createAgentResponse(text: string, toolCalls: string[] = []) {
    return {
        text,
        agentId: 'mock',
        thoughts: [],
        toolCalls: toolCalls.map(name => ({
            name,
            args: {},
            result: { success: true, data: {} },
        })),
    };
}

/**
 * Creates a mock streaming response for AI.generateContentStream.
 */
export function createStreamResponse(text: string) {
    return {
        stream: {
            getReader: vi.fn().mockReturnValue({
                read: vi.fn().mockResolvedValue({ done: true }),
                releaseLock: vi.fn(),
            }),
        },
        response: Promise.resolve({
            text: () => text,
            functionCalls: () => [],
        }),
    };
}

// ============================================================================
// Test Scenario Types
// ============================================================================

export interface DomainTestScenario {
    /** Human-readable name */
    name: string;
    /** The agent being tested */
    agentId: string;
    /** User message to send */
    userMessage: string;
    /** Keywords that MUST appear in the response */
    mustContain: string[];
    /** Keywords that must NOT appear */
    mustNotContain: string[];
    /** If set, the agent should route to this specialist instead */
    expectRouteToAgent?: string;
    /** Expected difficulty level */
    difficulty: 'entry' | 'intermediate' | 'expert';
}

export interface RoutingTestScenario {
    /** Human-readable name */
    name: string;
    /** User message to send */
    userMessage: string;
    /** Expected target agent */
    expectedAgent: string;
    /** Minimum confidence threshold */
    minConfidence: number;
    /** Is this an ambiguous multi-domain case? */
    isAmbiguous: boolean;
}

export interface GuardRailTestScenario {
    /** Human-readable name */
    name: string;
    /** The attack payload */
    attackPayload: string;
    /** Category of attack */
    attackCategory: 'jailbreak' | 'privilege_escalation' | 'exfiltration' | 'domain_violation' | 'tool_abuse';
    /** Expected behavior: should the sanitizer flag it? */
    shouldBeBlocked: boolean;
    /** Expected response patterns (if the agent responds) */
    responseMustContain?: string[];
    responseMustExclude?: string[];
}

// ============================================================================
// Standard Mock Setup (vi.mock calls that every test file needs)
// ============================================================================

/**
 * Standard vi.mock calls for the common dependencies.
 * IMPORTANT: vi.mock() calls must be at the top level of each test file.
 * This object provides the mock configurations to copy into each file.
 *
 * Usage: Copy the vi.mock() blocks from the individual test files — this
 * harness exports the FACTORY functions and TYPES only.
 */
export const MOCK_CONFIGS = {
    env: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false,
        VITE_FUNCTIONS_URL: 'https://example.com/functions',
        DEV: true,
    },
    firebase: {
        db: {},
        storage: {},
        auth: { currentUser: { uid: 'test-user' } },
        functions: {},
        remoteConfig: { getValue: vi.fn(), getAll: vi.fn() },
        getFirebaseAI: vi.fn(() => ({})),
        app: { options: {} },
        appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
        messaging: { getToken: vi.fn() },
    },
} as const;
