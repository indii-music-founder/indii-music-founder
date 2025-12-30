import { ToolDefinition } from '../types';

/**
 * MOCKED Security Tools
 *
 * In a real environment, these would connect to:
 * - Apigee Management API (for API status/lifecycle)
 * - Model Armor / Sensitive Data Protection API (for content scanning)
 * - Cloud KMS / Secrets Manager (for credential rotation)
 *
 * For this demo, we simulate these operations.
 */

// Mock data stores
const MOCK_APIS: Record<string, 'ACTIVE' | 'DISABLED' | 'DEPRECATED'> = {
    'payment-api': 'ACTIVE',
    'users-api': 'ACTIVE',
    'legacy-auth-api': 'DEPRECATED',
    'test-endpoint': 'DISABLED'
};

const SENSITIVE_TERMS = ['password', 'secret', 'key', 'ssn', 'credit_card'];

// --- Tool Implementations ---

export const check_api_status = async (args: { api_name: string }): Promise<string> => {
    const { api_name } = args;
    const status = MOCK_APIS[api_name.toLowerCase()] || 'UNKNOWN';

    return JSON.stringify({
        api: api_name,
        status: status,
        environment: 'production',
        last_check: new Date().toISOString()
    });
};

export const scan_content = async (args: { text: string }): Promise<string> => {
    const { text } = args;
    const lowerText = text.toLowerCase();

    const foundTerms = SENSITIVE_TERMS.filter(term => lowerText.includes(term));
    const isSafe = foundTerms.length === 0;

    return JSON.stringify({
        safe: isSafe,
        risk_score: isSafe ? 0.0 : 0.9,
        flagged_terms: foundTerms,
        recommendation: isSafe ? 'ALLOW' : 'BLOCK_OR_REDACT'
    });
};

export const rotate_credentials = async (args: { service_name: string }): Promise<string> => {
    const { service_name } = args;

    // Simulate delay for rotation
    await new Promise(resolve => setTimeout(resolve, 500));

    return JSON.stringify({
        service: service_name,
        action: 'rotate_credentials',
        status: 'SUCCESS',
        new_key_id: `key-${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString()
    });
};

export const verify_zero_touch_prod = async (args: { service_name: string }): Promise<string> => {
    const { service_name } = args;
    // Mock logic: Assume services starting with 'prod-' have ZTP enabled
    const isCompliant = service_name.toLowerCase().startsWith('prod-') || service_name === 'foundational-auth';

    return JSON.stringify({
        service: service_name,
        check: 'zero_touch_prod',
        compliant: isCompliant,
        automation_level: isCompliant ? 'FULL_NOPE' : 'PARTIAL', // NoPe = No Persons
        last_audit: new Date().toISOString()
    });
};

export const check_core_dump_policy = async (args: { service_name: string }): Promise<string> => {
    const { service_name } = args;
    // Mock logic: Foundational services MUST have core dumps disabled
    const isFoundational = service_name.includes('auth') || service_name.includes('key');
    const coreDumpsDisabled = isFoundational; // In this mock, we assume we are compliant if it's foundational

    return JSON.stringify({
        service: service_name,
        check: 'core_dump_policy',
        compliant: coreDumpsDisabled,
        setting: coreDumpsDisabled ? 'DISABLED' : 'ENABLED',
        risk_level: coreDumpsDisabled ? 'LOW' : isFoundational ? 'CRITICAL' : 'MEDIUM'
    });
};

export const audit_workload_isolation = async (args: { service_name: string, workload_type: 'FOUNDATIONAL' | 'SENSITIVE' | 'LOWER_PRIORITY' }): Promise<string> => {
    const { service_name, workload_type } = args;

    // Mock logic for security rings
    let ring = 'GENERAL';
    if (workload_type === 'FOUNDATIONAL') ring = 'RING_0_CORE';
    if (workload_type === 'SENSITIVE') ring = 'RING_1_SENSITIVE';
    if (workload_type === 'LOWER_PRIORITY') ring = 'RING_2_BATCH';

    return JSON.stringify({
        service: service_name,
        check: 'workload_isolation',
        workload_type: workload_type,
        assigned_ring: ring,
        isolation_status: 'ENFORCED',
        neighbors: workload_type === 'FOUNDATIONAL' ? [] : ['other-batch-jobs'] // Foundational should have no neighbors
    });
};

export const audit_permissions = async () => {
    return JSON.stringify({
        status: "complete",
        adminCount: 2,
        users: [
            { id: "user-1", role: "admin", mfa_enabled: true },
            { id: "user-2", role: "editor", mfa_enabled: false }
        ],
        alerts: ["User-2 missing MFA"]
    }, null, 2);
};

export const scan_for_vulnerabilities = async () => {
    return JSON.stringify({
        scanId: `SCAN-${Date.now()}`,
        status: "passed",
        vulnerabilitiesFound: 0,
        coverage: "100%"
    }, null, 2);
};

export const generate_security_report = async () => {
    return JSON.stringify({
        reportDate: new Date().toISOString(),
        overallScore: "A-",
        sections: {
            auth: "Strong",
            infrastructure: "Secure",
            data: "Encrypted"
        },
        recommendations: [
            "Enable MFA for all editors",
            "Rotate service keys next week"
        ]
    }, null, 2);
};

export const SecurityTools = {
    check_api_status,
    scan_content,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,
    audit_permissions,
    scan_for_vulnerabilities,
    generate_security_report
};
