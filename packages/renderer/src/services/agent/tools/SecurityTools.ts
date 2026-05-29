import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

/**
 * Security Tools
 *
 * In a real environment, these would connect to:
 * - Apigee Management API (for API status/lifecycle)
 * - Model Armor / Sensitive Data Protection API (for content scanning)
 * - Cloud KMS / Secrets Manager (for credential rotation)
 */

// --- Validation Schemas ---

// --- Tools Implementation ---

export const SecurityTools = {
    check_api_status: wrapTool('check_api_status', async ({ api_name }: { api_name: string }) => {
        const apiKey = api_name.toLowerCase();

        // Try to get status from Firestore first
        try {
            const docRef = doc(db, 'api_inventory', apiKey);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                if (data.endpointUrl) {
                    try {
                        const res = await fetch(data.endpointUrl);
                        return toolSuccess({
                            api: api_name,
                            status: res.ok ? 'UP' : 'DOWN',
                            statusCode: res.status,
                            environment: data.environment || 'production',
                            last_check: new Date().toISOString()
                        }, `Live status retrieved for ${api_name} from ${data.endpointUrl}.`);
                    } catch (e: unknown) {
                        return toolError(`Failed to fetch live API endpoint for ${api_name}: ${(e as Error).message}`, 'API_FETCH_FAILED');
                    }
                }

                return toolSuccess({
                    api: api_name,
                    status: data.status || 'UNKNOWN',
                    environment: data.environment || 'production',
                    last_check: new Date().toISOString()
                }, `Status retrieved for ${api_name} from inventory.`);
            }
        } catch (error: unknown) {
            logger.warn('[SecurityTools] Firestore unavailable:', error);
        }

        return toolError(`No live API inventory record found for ${api_name}.`, 'API_STATUS_UNAVAILABLE');
    }),


    rotate_credentials: wrapTool('rotate_credentials', async ({ service_name }: { service_name: string }) => {
        if (!window.electronAPI?.security) {
            return toolError("Security bridge unavailable.", "IPC_ERROR");
        }

        try {
            const result = await window.electronAPI.security.rotateCredentials({ serviceName: service_name }) as any;
            if (!result.success) {
                return toolError(result.error || "Rotation failed", "ROTATION_FAILED");
            }

            return toolSuccess(result, `Credentials for ${service_name} rotated successfully in the vault.`);
        } catch (error: unknown) {
            return toolError(`Failed to bridge to security vault: ${error instanceof Error ? error.message : String(error)}`, "BRIDGE_ERROR");
        }
    }),

    verify_zero_touch_prod: wrapTool('verify_zero_touch_prod', async ({ service_name }: { service_name: string }) => {
        return toolError(
            `Zero-touch production verification for ${service_name} requires the live compliance inventory backend. [NOT_SUPPORTED]`,
            'NOT_SUPPORTED'
        );
    }),

    check_core_dump_policy: wrapTool('check_core_dump_policy', async ({ service_name }: { service_name: string }) => {
        return toolError(
            `Core dump policy check for ${service_name} requires a live host/security posture inventory. [NOT_SUPPORTED]`,
            'NOT_SUPPORTED'
        );
    }),

    audit_workload_isolation: wrapTool('audit_workload_isolation', async ({ service_name, workload_type }: { service_name: string, workload_type: string }) => {
        return toolError(
            `Workload isolation audit for ${service_name} (${workload_type}) requires live deployment inventory. [NOT_SUPPORTED]`,
            'NOT_SUPPORTED'
        );
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
            } catch (e: unknown) {
                logger.warn('[SecurityTools] Failed to query real permissions:', e);
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

        return toolError(
            project_id
                ? `No live organization permission data found for ${project_id}.`
                : 'Permission audit requires a project_id with live organization data.',
            'PERMISSIONS_AUDIT_UNAVAILABLE'
        );
    }),

    scan_for_vulnerabilities: wrapTool('scan_for_vulnerabilities', async ({ scope }: { scope: string }) => {
        if (!window.electronAPI?.security) {
            return toolError("Security bridge unavailable.", "IPC_ERROR");
        }

        try {
            const result = await window.electronAPI.security.scanVulnerabilities({ scope }) as any;
            if (!result.success) {
                return toolError(result.error || "Scan failed", "SCAN_FAILED");
            }

            return toolSuccess(result.scan, `Vulnerability scan completed for ${scope}. Score: ${result.scan?.score}`);
        } catch (error: unknown) {
            return toolError(`Failed to bridge to security scanner: ${error instanceof Error ? error.message : String(error)}`, "BRIDGE_ERROR");
        }
    }),

    generate_security_report: wrapTool('generate_security_report', async ({ project_id }: { project_id?: string }) => {
        try {
            const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
            const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (logs.length === 0) {
                return toolSuccess({ status: "No audit logs found" }, "Report generated with no data.");
            }

            const highSeverityCount = logs.filter(l => l.severity === 'high' || l.severity === 'critical').length;
            
            return toolSuccess({
                total_events: logs.length,
                high_severity_events: highSeverityCount,
                recent_logs: logs,
                project_id: project_id || "global",
                generated_at: new Date().toISOString()
            }, `Generated security report with ${logs.length} recent audit events.`);
        } catch (e: unknown) {
            return toolError(`Failed to generate security report: ${(e as Error).message}`, 'SECURITY_REPORT_UNAVAILABLE');
        }
    }),

    require_biometric_auth: wrapTool('require_biometric_auth', async (args: { action: string; requiredHoldRelease: boolean }) => {
        return toolError(
            `Biometric authentication for "${args.action}" requires a WebAuthn challenge from the backend. [NOT_SUPPORTED]`,
            'NOT_SUPPORTED'
        );
    }),

    log_audit_event: wrapTool('log_audit_event', async (args: { action: string; resourceId: string; severity: 'low' | 'medium' | 'high' | 'critical'; details?: string }) => {
        try {
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const { auth } = await import('@/services/firebase');

            // Writing to a global or org-level audit_logs collection
            // In a real app this might use a secure backend function to prevent client tampering
            const docRef = await addDoc(collection(db, 'audit_logs'), {
                ...args,
                userId: auth.currentUser?.uid || 'anonymous',
                timestamp: serverTimestamp(),
                source: 'Agent_SecurityTools'
            });

            return toolSuccess({
                logId: docRef.id,
                ...args
            }, `Secure audit log event recorded. Action: "${args.action}" on resource: "${args.resourceId}".`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[SecurityTools] Failed to log audit event:', error);
            return toolError(`Failed to log audit event: ${error.message}`);
        }
    }),

    apply_watermark: wrapTool('apply_watermark', async (args: { fileId: string; watermarkText: string; invisible?: boolean }) => {
        return toolError(
            'Watermarking requires a media processing backend which is currently unavailable. [NOT_SUPPORTED]',
            'NOT_SUPPORTED'
        );
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    check_api_status,
    rotate_credentials,
    verify_zero_touch_prod,
    check_core_dump_policy,
    audit_workload_isolation,
    audit_permissions,
    scan_for_vulnerabilities,
    generate_security_report,
    require_biometric_auth,
    log_audit_event,
    apply_watermark
} = SecurityTools;
