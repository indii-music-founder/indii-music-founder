import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    check_api_status,
    scan_content,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,
    audit_permissions
} from './SecurityTools';
import { AI } from '@/services/ai/AIService';
import { getDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateStructuredData: vi.fn()
    }
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        getDocs: vi.fn(),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        doc: vi.fn(),
        getDoc: vi.fn()
    };
});

describe('SecurityTools (Mocked)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('audit_permissions', () => {
        it('should return real Firestore data if available', async () => {
            // Mock Firestore response for Organization
            const mockOrgData = {
                ownerId: 'user-1',
                members: ['user-1', 'user-2', 'user-3']
            };

            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => mockOrgData
            });

            const result = await audit_permissions({ project_id: 'org-1' });
            const parsed = JSON.parse(result);

            expect(parsed.status).toBe("Live Audit Complete");

            // Logic: owner = admin, others = viewer
            // user-1 is owner -> admin
            // user-2, user-3 -> viewer

            const adminRole = parsed.roles.find((r: any) => r.role === 'admin');
            const viewerRole = parsed.roles.find((r: any) => r.role === 'viewer');

            expect(adminRole.count).toBe(1);
            expect(viewerRole.count).toBe(2);

            // AI should NOT be called
            expect(AI.generateContent).not.toHaveBeenCalled();
        });

        it('should fallback to AI if Firestore returns empty/error', async () => {
            // Mock Firestore not found
            (getDoc as any).mockResolvedValue({ exists: () => false });

            // Mock AI response
            const mockAIResponse = {
                project_id: 'test-project',
                status: 'AI Audit',
                roles: [{ role: 'admin', count: 1, risk: 'LOW' }],
                recommendations: []
            };
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify(mockAIResponse)
            });

            const result = await audit_permissions({ project_id: 'test-project' });
            const parsed = JSON.parse(result);

            expect(parsed.status).toBe("AI Audit");
            expect(AI.generateContent).toHaveBeenCalled();
        });
    });

    describe('check_api_status', () => {
        it('should return ACTIVE for known active API', async () => {
            const result = await check_api_status({ api_name: 'payment-api' });
            const parsed = JSON.parse(result);
            expect(parsed.api).toBe('payment-api');
            expect(parsed.status).toBe('ACTIVE');
            expect(parsed.environment).toBe('production');
        });

        it('should return DISABLED for known disabled API', async () => {
            const result = await check_api_status({ api_name: 'test-endpoint' });
            const parsed = JSON.parse(result);
            expect(parsed.status).toBe('DISABLED');
        });

        it('should return UNKNOWN for unknown API', async () => {
            const result = await check_api_status({ api_name: 'random-api' });
            const parsed = JSON.parse(result);
            expect(parsed.status).toBe('UNKNOWN');
        });
    });

    describe('scan_content', () => {
        it('should return safe for clean content', async () => {
            const result = await scan_content({ text: 'Hello world, this is a safe message.' });
            const parsed = JSON.parse(result);
            expect(parsed.safe).toBe(true);
            expect(parsed.risk_score).toBe(0.0);
            expect(parsed.flagged_terms).toHaveLength(0);
        });

        it('should flag sensitive terms', async () => {
            const result = await scan_content({ text: 'Here is my secret password.' });
            const parsed = JSON.parse(result);
            expect(parsed.safe).toBe(false);
            expect(parsed.risk_score).toBe(0.9);
            expect(parsed.flagged_terms).toContain('secret');
            expect(parsed.flagged_terms).toContain('password');
            expect(parsed.recommendation).toBe('BLOCK_OR_REDACT');
        });
    });

    describe('rotate_credentials', () => {
        it('should simulate credential rotation', async () => {
            const result = await rotate_credentials({ service_name: 'database-db' });
            const parsed = JSON.parse(result);
            expect(parsed.service).toBe('database-db');
            expect(parsed.action).toBe('rotate_credentials');
            expect(parsed.status).toBe('SUCCESS');
            expect(parsed.new_key_id).toBeDefined();
            expect(parsed.timestamp).toBeDefined();
        });
    });

    describe('verify_zero_touch_prod', () => {
        it('should return compliant for prod- prefixed services', async () => {
            const result = await verify_zero_touch_prod({ service_name: 'prod-payment-service' });
            const parsed = JSON.parse(result);
            expect(parsed.compliant).toBe(true);
            expect(parsed.automation_level).toBe('FULL_NOPE');
        });

        it('should return non-compliant for dev services', async () => {
            const result = await verify_zero_touch_prod({ service_name: 'dev-sandbox' });
            const parsed = JSON.parse(result);
            expect(parsed.compliant).toBe(false);
            expect(parsed.automation_level).toBe('PARTIAL');
        });
    });

    describe('check_core_dump_policy', () => {
        it('should confirm core dumps disabled for foundational auth service', async () => {
            const result = await check_core_dump_policy({ service_name: 'foundational-auth' });
            const parsed = JSON.parse(result);
            expect(parsed.compliant).toBe(true);
            expect(parsed.setting).toBe('DISABLED');
            expect(parsed.risk_level).toBe('LOW');
        });

        it('should show enabled (and medium risk) for non-critical service', async () => {
            const result = await check_core_dump_policy({ service_name: 'generic-app' });
            const parsed = JSON.parse(result);
            expect(parsed.setting).toBe('ENABLED');
            expect(parsed.risk_level).toBe('MEDIUM');
        });
    });

    describe('audit_workload_isolation', () => {
        it('should assign RING_0 to FOUNDATIONAL workloads and verify no neighbors', async () => {
            const result = await audit_workload_isolation({
                service_name: 'identity-provider',
                workload_type: 'FOUNDATIONAL'
            });
            const parsed = JSON.parse(result);
            expect(parsed.assigned_ring).toBe('RING_0_CORE');
            expect(parsed.neighbors).toHaveLength(0);
        });

        it('should assign RING_2 to LOWER_PRIORITY workloads', async () => {
            const result = await audit_workload_isolation({
                service_name: 'daily-report-job',
                workload_type: 'LOWER_PRIORITY'
            });
            const parsed = JSON.parse(result);
            expect(parsed.assigned_ring).toBe('RING_2_BATCH');
            expect(parsed.neighbors).not.toHaveLength(0);
        });
    });
});
