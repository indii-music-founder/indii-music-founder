import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    check_api_status,
    scan_for_vulnerabilities,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,
    audit_permissions
} from '../SecurityTools';
import { getDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        serverTimestamp: vi.fn(),
        ...actual as Record<string, unknown>,
        getDocs: vi.fn(),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        doc: vi.fn(),
        getDoc: vi.fn()
    };
});

// Mock the local firebase service to prevent real initialization
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    db: {}, // Mock db object
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: {}, // Mock remote config
    ai: {}, // Mock ai service
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock electronAPI
if (typeof window !== 'undefined') {
    (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI = {
        security: {
            rotateCredentials: vi.fn().mockResolvedValue({
                success: true,
                service: 'database-db',
                action: 'rotate_credentials',
                status: 'SUCCESS',
                new_key_id: 'mock-key-123',
                timestamp: new Date().toISOString()
            }),
            scanVulnerabilities: vi.fn().mockResolvedValue({
                success: true,
                scan: {
                    scope: 'all',
                    vulnerabilities: [],
                    score: 1.0
                }
            })
        }
    };
}

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

            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => mockOrgData
            } as unknown as import('firebase/firestore').DocumentSnapshot<import('firebase/firestore').DocumentData>);

            const result = await audit_permissions({ project_id: 'org-1' });
            const parsed = result.data;

            expect(parsed.status).toBe("Live Audit Complete");

            // Logic: owner = admin, others = viewer
            // user-1 is owner -> admin
            // user-2, user-3 -> viewer

            const adminRole = parsed.roles.find((r: { role: string }) => r.role === 'admin');
            const viewerRole = parsed.roles.find((r: { role: string }) => r.role === 'viewer');

            expect(adminRole.count).toBe(1);
            expect(viewerRole.count).toBe(2);

            // Autonomous should NOT be called
            expect(AutonomousIntelligence.generateStructuredData).not.toHaveBeenCalled();
        });

        it('should return error if Firestore returns empty/error', async () => {
            // Mock Firestore not found
            vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as unknown as import('firebase/firestore').DocumentSnapshot<import('firebase/firestore').DocumentData>);

            const result = await audit_permissions({ project_id: 'test-project' });

            expect(result.success).toBe(false);
            expect(result.error).toContain("No live organization permission data found for test-project.");
        });
    });

    describe('check_api_status', () => {
        it('should return ACTIVE for known active API', async () => {
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'ACTIVE', environment: 'production' })
            } as any);
            const result = await check_api_status({ api_name: 'payment-api' });
            expect(result.success).toBe(true);
            const parsed = result.data;
            expect(parsed.api).toBe('payment-api');
            expect(parsed.status).toBe('ACTIVE');
            expect(parsed.environment).toBe('production');
        });

        it('should return DISABLED for known disabled API', async () => {
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'DISABLED' })
            } as any);
            const result = await check_api_status({ api_name: 'test-endpoint' });
            expect(result.success).toBe(true);
            const parsed = result.data;
            expect(parsed.status).toBe('DISABLED');
        });

        it('should return UNKNOWN for unknown API', async () => {
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'UNKNOWN' })
            } as any);
            const result = await check_api_status({ api_name: 'random-api' });
            expect(result.success).toBe(true);
            const parsed = result.data;
            expect(parsed.status).toBe('UNKNOWN');
        });
    });

    describe('scan_for_vulnerabilities', () => {
        it('should return vulnerability scan result', async () => {
            const result = await scan_for_vulnerabilities({ scope: 'all' });
            const parsed = result.data;
            expect(parsed.scope).toBe('all');
            expect(parsed.score).toBe(1.0);
            expect(parsed.vulnerabilities).toHaveLength(0);
        });
    });

    describe('rotate_credentials', () => {
        it('should simulate credential rotation', async () => {
            const result = await rotate_credentials({ service_name: 'database-db' });
            const parsed = result.data;
            expect(parsed.service).toBe('database-db');
            expect(parsed.action).toBe('rotate_credentials');
            expect(parsed.status).toBe('SUCCESS');
            expect(parsed.new_key_id).toBeDefined();
            expect(parsed.timestamp).toBeDefined();
        });
    });

    describe('verify_zero_touch_prod', () => {
        it('should return non-compliant/unavailable due to missing compliance inventory', async () => {
            const result = await verify_zero_touch_prod({ service_name: 'prod-payment-service' });
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('NOT_SUPPORTED');
        });
    });

    describe('check_core_dump_policy', () => {
        it('should return unavailable due to missing security posture inventory', async () => {
            const result = await check_core_dump_policy({ service_name: 'foundational-auth' });
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('NOT_SUPPORTED');
        });
    });

    describe('audit_workload_isolation', () => {
        it('should return unavailable due to missing deployment inventory', async () => {
            const result = await audit_workload_isolation({
                service_name: 'identity-provider',
                workload_type: 'FOUNDATIONAL'
            });
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('NOT_SUPPORTED');
        });
    });
});
