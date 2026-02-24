import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';
import { db } from '../../src/services/firebase'; // Note: This mapping might need adjustment based on how it's bundled
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const RotationSchema = z.object({
    serviceName: z.string()
});

const ScanSchema = z.object({
    scope: z.string().optional()
});

export function registerSecurityHandlers() {
    // 1. Rotate Credentials
    ipcMain.handle('security:rotate-credentials', async (event: IpcMainInvokeEvent, data: any) => {
        validateSender(event);

        try {
            const validated = RotationSchema.parse(data);
            const { serviceName } = validated;

            console.log(`[SecurityHandler] Rotating credentials for: ${serviceName}`);

            // Interaction with Firestore vault
            const docRef = doc(db, 'vault', serviceName);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return { success: false, error: `Service ${serviceName} not found in vault.` };
            }

            // In a real rotation, we would call an external API (Stripe/GitHub) to get a new key.
            // Here, we simulate the logic by updating the rotation timestamp and key metadata.
            const newKeySuffix = Math.random().toString(36).substring(7);
            const newKey = `sk_test_rotated_${newKeySuffix}`;

            await updateDoc(docRef, {
                key: newKey,
                last_rotated: new Date().toISOString(),
                rotation_count: (docSnap.data().rotation_count || 0) + 1
            });

            return {
                success: true,
                service: serviceName,
                message: `Credentials for ${serviceName} rotated successfully in vault.`
            };

        } catch (error: any) {
            console.error('[SecurityHandler] Rotation Error:', error);
            return { success: false, error: error.message };
        }
    });

    // 2. Scan for Vulnerabilities
    ipcMain.handle('security:scan-vulnerabilities', async (event: IpcMainInvokeEvent, data: any) => {
        validateSender(event);

        try {
            const validated = ScanSchema.parse(data);
            const scope = validated.scope || process.cwd();

            console.log(`[SecurityHandler] Running vulnerability scan on: ${scope}`);

            const result = await AgentSupervisor.execute<any>(
                'security',
                'vulnerability_scanner.py',
                [scope],
                { timeoutMs: 30000 }
            );

            if (!result.success && result.status !== 'success') {
                return { success: false, error: result.error || 'Vulnerability scan failed' };
            }

            // Adjust result mapping if needed based on scanner output
            const scanData = result.status === 'success' ? result : result.data;

            return {
                success: true,
                scan: scanData,
                message: `Vulnerability scan complete. Found ${scanData.vulnerabilities?.length || 0} issues.`
            };

        } catch (error: any) {
            console.error('[SecurityHandler] Scan Error:', error);
            return { success: false, error: error.message };
        }
    });
}
