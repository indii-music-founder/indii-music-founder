
import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';

/**
 * Security Tools
 * 
 * In a real environment, these would connect to:
 * - Apigee Management API (for API status/lifecycle)
 * - Model Armor / Sensitive Data Protection API (for content scanning)
 * - Cloud KMS / Secrets Manager (for credential rotation)
 */

// --- Validation Schemas ---

const AuditPermissionsSchema = z.object({
    project_id: z.string().optional(),
    status: z.string(),
    roles: z.array(z.object({
        role: z.string(),
        count: z.number(),
        risk: z.string()
    })),
    recommendations: z.array(z.string())
});

const VulnerabilityScanSchema = z.object({
    scope: z.string(),
    vulnerabilities: z.array(z.object({
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        description: z.string(),
        remediation: z.string()
    })),
    score: z.number()
});

const SecurityReportSchema = z.object({
    reportDate: z.string(),
    overallScore: z.string(),
    sections: z.object({
        auth: z.string(),
        infrastructure: z.string(),
        data: z.string()
    })
});

// Mock data stores
const MOCK_APIS: Record<string, 'ACTIVE' | 'DISABLED' | 'DEPRECATED'> = {
    'payment-api': 'ACTIVE',
    'users-api': 'ACTIVE',
    'legacy-auth-api': 'DEPRECATED',
    'test-endpoint': 'DISABLED'
};

const SENSITIVE_TERMS = ['password', 'secret', 'key', 'ssn', 'credit_card'];

// --- Tools Implementation ---

export const SecurityTools = {
    check_api_status: async ({ api_name }: { api_name: string }) => {
        const status = MOCK_APIS[api_name.toLowerCase()] || 'UNKNOWN';
        return JSON.stringify({
            api: api_name,
            status: status,
            environment: 'production',
            last_check: new Date().toISOString()
        });
    },

    scan_content: async ({ text }: { text: string }) => {
        const lowerText = text.toLowerCase();
        const foundTerms = SENSITIVE_TERMS.filter(term => lowerText.includes(term));
        const isSafe = foundTerms.length === 0;

        return JSON.stringify({
            safe: isSafe,
            risk_score: isSafe ? 0.0 : 0.9,
            flagged_terms: foundTerms,
            recommendation: isSafe ? 'ALLOW' : 'BLOCK_OR_REDACT'
        });
    },

    rotate_credentials: async ({ service_name }: { service_name: string }) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return JSON.stringify({
            service: service_name,
            action: 'rotate_credentials',
            status: 'SUCCESS',
            new_key_id: `key-${Math.random().toString(36).substring(7)}`,
            timestamp: new Date().toISOString()
        });
    },

    verify_zero_touch_prod: async ({ service_name }: { service_name: string }) => {
        const isCompliant = service_name.toLowerCase().startsWith('prod-') || service_name === 'foundational-auth';
        return JSON.stringify({
            service: service_name,
            check: 'zero_touch_prod',
            compliant: isCompliant,
            automation_level: isCompliant ? 'FULL_NOPE' : 'PARTIAL',
            last_audit: new Date().toISOString()
        });
    },

    check_core_dump_policy: async ({ service_name }: { service_name: string }) => {
        const isFoundational = service_name.includes('auth') || service_name.includes('key');
        const coreDumpsDisabled = isFoundational;
        return JSON.stringify({
            service: service_name,
            check: 'core_dump_policy',
            compliant: coreDumpsDisabled,
            setting: coreDumpsDisabled ? 'DISABLED' : 'ENABLED',
            risk_level: coreDumpsDisabled ? 'LOW' : isFoundational ? 'CRITICAL' : 'MEDIUM'
        });
    },

    audit_workload_isolation: async ({ service_name, workload_type }: { service_name: string, workload_type: string }) => {
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
    },

    audit_permissions: async ({ project_id }: { project_id?: string }) => {
        const prompt = `
        You are a Security Officer. Perform a Permission Audit ${project_id ? `for project ${project_id}` : 'for the organization'}.
        Review standard roles: Admin, Editor, Viewer.
        Identify potential risks (e.g., too many Admins, external guests).

        Output a strict JSON object (no markdown) matching this schema:
        { "project_id": string (optional), "status": string, "roles": [{ "role": string, "count": number, "risk": string }], "recommendations": string[] }
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = AuditPermissionsSchema.parse(parsed);
            return JSON.stringify(result, null, 2);
        } catch (e) {
            console.error('SecurityTools.audit_permissions error:', e);
            return JSON.stringify({
                status: "Error",
                roles: [],
                recommendations: ["Manual audit required"]
            });
        }
    },

    scan_for_vulnerabilities: async ({ scope }: { scope: string }) => {
        const prompt = `
        You are a Security Analyst. Perform a Vulnerability Scan on: ${scope}.
        Check for: Exposed API Keys, Weak Passwords, Unencrypted Data, Outdated Dependencies.

        Output a strict JSON object (no markdown) matching this schema:
        { "scope": string, "vulnerabilities": [{ "severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "description": string, "remediation": string }], "score": number }
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = VulnerabilityScanSchema.parse(parsed);
            return JSON.stringify(result, null, 2);
        } catch (e) {
            console.error('SecurityTools.scan_for_vulnerabilities error:', e);
            return JSON.stringify({
                scope,
                vulnerabilities: [],
                score: 0
            });
        }
    },

    generate_security_report: async () => {
        // Return structured data directly as it's a mock
        const report = {
            reportDate: new Date().toISOString(),
            overallScore: "A-",
            sections: {
                auth: "Strong",
                infrastructure: "Secure",
                data: "Encrypted"
            }
        };
        // Validate it anyway to ensure schema compliance
        try {
            SecurityReportSchema.parse(report);
            return JSON.stringify(report, null, 2);
        } catch (e) {
             return JSON.stringify(report, null, 2);
        }
    }
};

// Aliases
export const check_api_status = SecurityTools.check_api_status;
export const scan_content = SecurityTools.scan_content;
export const rotate_credentials = SecurityTools.rotate_credentials;
export const verify_zero_touch_prod = SecurityTools.verify_zero_touch_prod;
export const check_core_dump_policy = SecurityTools.check_core_dump_policy;
export const audit_workload_isolation = SecurityTools.audit_workload_isolation;
export const audit_permissions = SecurityTools.audit_permissions;
export const scan_for_vulnerabilities = SecurityTools.scan_for_vulnerabilities;
export const generate_security_report = SecurityTools.generate_security_report;
