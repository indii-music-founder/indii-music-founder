const fs = require('fs');
const file = 'packages/renderer/src/services/agent/tools/SecurityTools.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`    check_api_status: wrapTool('check_api_status', async ({ api_name }: { api_name: string }) => {
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
                }, \`Status retrieved for \${api_name} from inventory.\`);
            }
        } catch (error: unknown) {
            logger.warn('[SecurityTools] Firestore unavailable:', error);
        }

        return toolError(\`No live API inventory record found for \${api_name}.\`, 'API_STATUS_UNAVAILABLE');
    }),`,
`    check_api_status: wrapTool('check_api_status', async ({ api_name }: { api_name: string }) => {
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
                        }, \`Live status retrieved for \${api_name} from \${data.endpointUrl}.\`);
                    } catch (e: unknown) {
                        return toolError(\`Failed to fetch live API endpoint for \${api_name}: \${(e as Error).message}\`, 'API_FETCH_FAILED');
                    }
                }

                return toolSuccess({
                    api: api_name,
                    status: data.status || 'UNKNOWN',
                    environment: data.environment || 'production',
                    last_check: new Date().toISOString()
                }, \`Status retrieved for \${api_name} from inventory.\`);
            }
        } catch (error: unknown) {
            logger.warn('[SecurityTools] Firestore unavailable:', error);
        }

        return toolError(\`No live API inventory record found for \${api_name}.\`, 'API_STATUS_UNAVAILABLE');
    }),`);

content = content.replace(
`    verify_zero_touch_prod: wrapTool('verify_zero_touch_prod', async ({ service_name }: { service_name: string }) => {
        return toolError(
            \`Zero-touch production verification for \${service_name} requires the live compliance inventory backend.\`,
            'COMPLIANCE_BACKEND_UNAVAILABLE'
        );
    }),

    check_core_dump_policy: wrapTool('check_core_dump_policy', async ({ service_name }: { service_name: string }) => {
        return toolError(
            \`Core dump policy check for \${service_name} requires a live host/security posture inventory.\`,
            'COMPLIANCE_BACKEND_UNAVAILABLE'
        );
    }),

    audit_workload_isolation: wrapTool('audit_workload_isolation', async ({ service_name, workload_type }: { service_name: string, workload_type: string }) => {
        return toolError(
            \`Workload isolation audit for \${service_name} (\${workload_type}) requires live deployment inventory.\`,
            'COMPLIANCE_BACKEND_UNAVAILABLE'
        );
    }),`,
`    verify_zero_touch_prod: wrapTool('verify_zero_touch_prod', async ({ service_name }: { service_name: string }) => {
        return toolError(
            \`Zero-touch production verification for \${service_name} requires the live compliance inventory backend. [NOT_SUPPORTED]\`,
            'NOT_SUPPORTED'
        );
    }),

    check_core_dump_policy: wrapTool('check_core_dump_policy', async ({ service_name }: { service_name: string }) => {
        return toolError(
            \`Core dump policy check for \${service_name} requires a live host/security posture inventory. [NOT_SUPPORTED]\`,
            'NOT_SUPPORTED'
        );
    }),

    audit_workload_isolation: wrapTool('audit_workload_isolation', async ({ service_name, workload_type }: { service_name: string, workload_type: string }) => {
        return toolError(
            \`Workload isolation audit for \${service_name} (\${workload_type}) requires live deployment inventory. [NOT_SUPPORTED]\`,
            'NOT_SUPPORTED'
        );
    }),`);

content = content.replace(
`    generate_security_report: wrapTool('generate_security_report', async () => {
        return toolError(
            'Security report generation requires live audit, vulnerability, and compliance data sources.',
            'SECURITY_REPORT_UNAVAILABLE'
        );
    }),

    require_biometric_auth: wrapTool('require_biometric_auth', async (args: { action: string; requiredHoldRelease: boolean }) => {
        return toolError(
            \`Biometric authentication for "\${args.action}" requires a WebAuthn challenge from the backend.\`,
            'BIOMETRIC_AUTH_UNAVAILABLE'
        );
    }),`,
`    generate_security_report: wrapTool('generate_security_report', async ({ project_id }: { project_id?: string }) => {
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
            }, \`Generated security report with \${logs.length} recent audit events.\`);
        } catch (e: unknown) {
            return toolError(\`Failed to generate security report: \${(e as Error).message}\`, 'SECURITY_REPORT_UNAVAILABLE');
        }
    }),

    require_biometric_auth: wrapTool('require_biometric_auth', async (args: { action: string; requiredHoldRelease: boolean }) => {
        return toolError(
            \`Biometric authentication for "\${args.action}" requires a WebAuthn challenge from the backend. [NOT_SUPPORTED]\`,
            'NOT_SUPPORTED'
        );
    }),`);

content = content.replace(
`    log_audit_event: wrapTool('log_audit_event', async (args: { action: string; resourceId: string; severity: 'low' | 'medium' | 'high' | 'critical'; details?: string }) => {
        try {
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            // Writing to a global or org-level audit_logs collection
            // In a real app this might use a secure backend function to prevent client tampering
            const docRef = await addDoc(collection(db, 'audit_logs'), {
                ...args,
                timestamp: serverTimestamp(),
                source: 'Agent_SecurityTools'
            });`,
`    log_audit_event: wrapTool('log_audit_event', async (args: { action: string; resourceId: string; severity: 'low' | 'medium' | 'high' | 'critical'; details?: string }) => {
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
            });`);

fs.writeFileSync(file, content);
