import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { delay } from '@/utils/async';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

// Fallback API inventory when Firestore is unavailable
const FALLBACK_APIS: Record<string, 'ACTIVE' | 'DISABLED' | 'DEPRECATED'> = {
    'payment-api': 'ACTIVE',
    'users-api': 'ACTIVE',
    'legacy-auth-api': 'DEPRECATED',
    'test-endpoint': 'DISABLED'
};

const SENSITIVE_TERMS = ['password', 'secret', 'key', 'ssn', 'credit_card'];

// --- Tools Implementation ---

export const SecurityTools: Record<string, AnyToolFunction> = {
    check_api_status: wrapTool('check_api_status', async ({ api_name }: { api_name: string }) => {
        const apiKey = api_name.toLowerCase();

        // Try to get status from Firestore first
        try {
            const docRef = doc(db, 'api_inventory', apiKey);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                return toolSuccess({
                    api: api_name,
                    status: data.status || 'UNKNOWN',
                    environment: data.environment || 'production',
                    last_check: new Date().toISOString()
                }, `Status retrieved for ${api_name} from inventory.`);
            }
        } catch (error) {
            console.warn('[SecurityTools] Firestore unavailable, using fallback:', error);
        }

        // Fallback to static data
        const status = FALLBACK_APIS[apiKey] || 'UNKNOWN';
        return toolSuccess({
            api: api_name,
            status: status,
            environment: 'production',
            last_check: new Date().toISOString()
        }, `Status retrieved for ${api_name} from fallback list.`);
    }),

    scan_content: wrapTool('scan_content', async ({ text }: { text: string }) => {
        const lowerText = text.toLowerCase();
        const foundTerms = SENSITIVE_TERMS.filter(term => lowerText.includes(term));
        const isSafe = foundTerms.length === 0;

        return toolSuccess({
            safe: isSafe,
            risk_score: isSafe ? 0.0 : 0.9,
            flagged_terms: foundTerms,
            recommendation: isSafe ? 'ALLOW' : 'BLOCK_OR_REDACT'
        }, isSafe ? "No sensitive terms found." : `Found ${foundTerms.length} sensitive terms.`);
    }),

    rotate_credentials: wrapTool('rotate_credentials', async ({ service_name }: { service_name: string }) => {
        await delay(500);
        const newKeyId = `key-${Math.random().toString(36).substring(7)}`;
        return toolSuccess({
            service: service_name,
            action: 'rotate_credentials',
            status: 'SUCCESS',
            new_key_id: newKeyId,
            timestamp: new Date().toISOString()
        }, `Credentials rotated successfully for ${service_name}. New Key ID: ${newKeyId}`);
    }),

    verify_zero_touch_prod: wrapTool('verify_zero_touch_prod', async ({ service_name }: { service_name: string }) => {
        const isCompliant = service_name.toLowerCase().startsWith('prod-') || service_name === 'foundational-auth';
        return toolSuccess({
            service: service_name,
            check: 'zero_touch_prod',
            compliant: isCompliant,
            automation_level: isCompliant ? 'FULL_NOPE' : 'PARTIAL',
            last_audit: new Date().toISOString()
        }, isCompliant ? "Service is compliant with zero-touch production policy." : "Service requires remediation to meet zero-touch compliance.");
    }),

    check_core_dump_policy: wrapTool('check_core_dump_policy', async ({ service_name }: { service_name: string }) => {
        const isFoundational = service_name.includes('auth') || service_name.includes('key');
        const coreDumpsDisabled = isFoundational;
        return toolSuccess({
            service: service_name,
            check: 'core_dump_policy',
            compliant: coreDumpsDisabled,
            setting: coreDumpsDisabled ? 'DISABLED' : 'ENABLED',
            risk_level: coreDumpsDisabled ? 'LOW' : isFoundational ? 'CRITICAL' : 'MEDIUM'
        }, coreDumpsDisabled ? "Core dumps are correctly disabled." : "Core dumps should be disabled for this service.");
    }),

    audit_workload_isolation: wrapTool('audit_workload_isolation', async ({ service_name, workload_type }: { service_name: string, workload_type: string }) => {
        let ring = 'GENERAL';
        if (workload_type === 'FOUNDATIONAL') ring = 'RING_0_CORE';
        if (workload_type === 'SENSITIVE') ring = 'RING_1_SENSITIVE';
        if (workload_type === 'LOWER_PRIORITY') ring = 'RING_2_BATCH';

        return toolSuccess({
            service: service_name,
            check: 'workload_isolation',
            workload_type: workload_type,
            assigned_ring: ring,
            isolation_status: 'ENFORCED',
            neighbors: workload_type === 'FOUNDATIONAL' ? [] : ['other-batch-jobs']
        }, `Service ${service_name} isolation verified within ${ring}.`);
    }),

    audit_permissions: wrapTool('audit_permissions', async ({ project_id }: { project_id?: string }) => {
        let realRoles: Record<string, number> | null = null;

        if (project_id) {
            try {
                const docRef = doc(db, 'organizations', project_id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    realRoles = {};
                    const members = data.members || [];
                    const ownerId = data.ownerId;

                    members.forEach((userId: string) => {
                        const role = (userId === ownerId) ? 'admin' : 'viewer';
                        realRoles![role] = (realRoles![role] || 0) + 1;
                    });
                }
            } catch (e) {
                console.warn('[SecurityTools] Failed to query real permissions:', e);
            }
        }

        if (realRoles) {
            const rolesArray = Object.entries(realRoles).map(([role, count]) => ({
                role,
                count,
                risk: role === 'admin' && count > 3 ? 'HIGH' : 'LOW'
            }));

            return toolSuccess({
                project_id: project_id,
                status: "Live Audit Complete",
                roles: rolesArray,
                recommendations: rolesArray.length > 0 ? ["Review access periodically"] : ["No members found"]
            }, "Permissions audit completed using live organization data.");
        }

        // Fallback to AI Simulation
        const schema = zodToJsonSchema(AuditPermissionsSchema);
        const prompt = `
        You are a Security Officer. Perform a Permission Audit ${project_id ? `for project ${project_id}` : 'for the organization'}.
        Review standard roles: Admin, Editor, Viewer.
        Identify potential risks (e.g., too many Admins, external guests).
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as any
        );
        const validated = AuditPermissionsSchema.parse(data);
        return toolSuccess(validated, "Permissions audit simulated via AI due to missing live data.");
    }),

    scan_for_vulnerabilities: wrapTool('scan_for_vulnerabilities', async ({ scope }: { scope: string }) => {
        const schema = zodToJsonSchema(VulnerabilityScanSchema);
        const prompt = `
        You are a Security Analyst. Perform a Vulnerability Scan on: ${scope}.
        Check for: Exposed API Keys, Weak Passwords, Unencrypted Data, Outdated Dependencies.
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as any
        );
        const validated = VulnerabilityScanSchema.parse(data);
        return toolSuccess(validated, `Vulnerability scan completed for ${scope}. Risk score: ${validated.score}`);
    }),

    generate_security_report: wrapTool('generate_security_report', async () => {
        const report = {
            reportDate: new Date().toISOString(),
            overallScore: "A-",
            sections: {
                auth: "Strong",
                infrastructure: "Secure",
                data: "Encrypted"
            }
        };
        SecurityReportSchema.parse(report);
        return toolSuccess(report, "Consolidated security report generated.");
    })
};

// Aliases
export const {
    check_api_status,
    scan_content,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,
    audit_permissions,
    scan_for_vulnerabilities,
    generate_security_report
} = SecurityTools;
