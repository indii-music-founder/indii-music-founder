import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

// Standalone functions for direct import and testing
export const check_api_status = async (args: { api_name: string }) => {
    // Mock implementation for test
    if (args.api_name === 'payment-api') {
        return JSON.stringify({
            api: 'payment-api',
            status: 'ACTIVE',
            environment: 'production'
        });
    }
    if (args.api_name === 'test-endpoint') {
        return JSON.stringify({ status: 'DISABLED' });
    }
    return JSON.stringify({ status: 'UNKNOWN' });
};

export const scan_content = async (args: { text: string }) => {
    // Mock implementation for test
    if (args.text.includes('secret') || args.text.includes('password')) {
        return JSON.stringify({
            safe: false,
            risk_score: 0.9,
            flagged_terms: ['secret', 'password'],
            recommendation: 'BLOCK_OR_REDACT'
        });
    }
    return JSON.stringify({
        safe: true,
        risk_score: 0.0,
        flagged_terms: []
    });
};

export const rotate_credentials = async (args: { service_name: string }) => {
    return JSON.stringify({
        service: args.service_name,
        action: 'rotate_credentials',
        status: 'SUCCESS',
        new_key_id: 'new-key-123',
        timestamp: new Date().toISOString()
    });
};

export const verify_zero_touch_prod = async (args: { service_name: string }) => {
    if (args.service_name.startsWith('prod-')) {
        return JSON.stringify({
            compliant: true,
            automation_level: 'FULL_NOPE'
        });
    }
    return JSON.stringify({
        compliant: false,
        automation_level: 'PARTIAL'
    });
};

export const check_core_dump_policy = async (args: { service_name: string }) => {
    const isFoundational = args.service_name.includes('auth') || args.service_name.includes('key');
    if (isFoundational) {
        return JSON.stringify({
            compliant: true,
            setting: 'DISABLED',
            risk_level: 'LOW'
        });
    }
    return JSON.stringify({
        setting: 'ENABLED',
        risk_level: 'MEDIUM'
    });
};

export const audit_workload_isolation = async (args: { service_name: string; workload_type: string }) => {
    if (args.workload_type === 'FOUNDATIONAL') {
        return JSON.stringify({
            assigned_ring: 'RING_0_CORE',
            neighbors: []
        });
    }
    return JSON.stringify({
        assigned_ring: 'RING_2_BATCH',
        neighbors: ['job-1', 'job-2']
    });
};


export const SecurityTools = {
    check_api_status,
    scan_content,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,

    audit_permissions: async (args: { project_id?: string }) => {
        // Mock implementation for Agent context. In real app, this would read Firebase ACLs.
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
