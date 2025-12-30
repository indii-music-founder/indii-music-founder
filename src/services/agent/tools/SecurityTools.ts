import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

// Mock data stores for standard/legacy checks
const MOCK_APIS: Record<string, 'ACTIVE' | 'DISABLED' | 'DEPRECATED'> = {
    'payment-api': 'ACTIVE',
    'users-api': 'ACTIVE',
    'legacy-auth-api': 'DEPRECATED',
    'test-endpoint': 'DISABLED'
};

const SENSITIVE_TERMS = ['password', 'secret', 'key', 'ssn', 'credit_card'];

// --- Legacy/Standard Named Exports (Required by existing tests) ---

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
    const isCompliant = service_name.toLowerCase().startsWith('prod-') || service_name === 'foundational-auth';

    return JSON.stringify({
        service: service_name,
        check: 'zero_touch_prod',
        compliant: isCompliant,
        automation_level: isCompliant ? 'FULL_NOPE' : 'PARTIAL',
        last_audit: new Date().toISOString()
    });
};

export const check_core_dump_policy = async (args: { service_name: string }): Promise<string> => {
    const { service_name } = args;
    const isFoundational = service_name.includes('auth') || service_name.includes('key');
    const coreDumpsDisabled = isFoundational;

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
        neighbors: workload_type === 'FOUNDATIONAL' ? [] : ['other-batch-jobs']
    });
};

// --- New AI-Integrated Security Tools ---

export const SecurityTools = {
    check_api_status,
    scan_content,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,

    audit_permissions: async (args: { project_id?: string }) => {
        const prompt = `
        You are a Security Officer. Perform a Permission Audit ${args.project_id ? `for project ${args.project_id}` : 'for the organization'}.

        Review standard roles: Admin, Editor, Viewer.
        Identify potential risks (e.g., too many Admins, external guests).

        Generate a report with:
        1. Current Access Summary (Simulated)
        2. Risk Level (Low/Med/High)
        3. Recommendations for Least Privilege Principle
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to audit permissions.";
        } catch (e) {
            return "Error auditing permissions.";
        }
    },

    scan_for_vulnerabilities: async (args: { scope: string }) => {
        const prompt = `
        You are a Security Analyst. Perform a Vulnerability Scan on: ${args.scope}.

        Check for:
        1. Exposed API Keys
        2. Weak Passwords
        3. Unencrypted Data
        4. Outdated Dependencies

        Generate a Security Findings Report.
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to scan for vulnerabilities.";
        } catch (e) {
            return "Error scanning for vulnerabilities.";
        }
    }
};

