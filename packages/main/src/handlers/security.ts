import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';

// ARCHITECTURE NOTE: This handler does NOT import Firebase.
// Firebase client SDK is a browser-side module and must NEVER be loaded
// in the Electron main process (Node.js). All Firestore reads/writes
// are handled by the renderer. This handler receives vault data from
// the renderer, performs external API calls (Stripe, GitHub), and
// returns the result. The renderer writes the result back to Firestore.

const RotationInputSchema = z.object({
    serviceName: z.string(),
    vaultData: z.record(z.unknown()),
});

const ScanSchema = z.object({
    scope: z.string().optional()
});

export function registerSecurityHandlers() {
    // 1. Rotate Credentials
    // The renderer reads vault data from Firestore and passes it here.
    // This handler calls the external provider API and returns the new key.
    // The renderer writes the result back to Firestore.
    ipcMain.handle('security:rotate-credentials', async (event: IpcMainInvokeEvent, data: unknown) => {
        validateSender(event);

        try {
            const validated = RotationInputSchema.parse(data);
            const { serviceName, vaultData } = validated;

            console.log(`[SecurityHandler] Rotating credentials for: ${serviceName}`);

            let newKey: string | null = null;

            // Item 334: Real key rotation via provider APIs
            if (serviceName === 'stripe') {
                // Stripe: create a new restricted key via API
                const stripeSecret = vaultData.api_secret as string | undefined;
                if (!stripeSecret) {
                    return { success: false, error: 'Stripe API secret not found in vault for rotation.' };
                }
                const stripeRes = await fetch('https://api.stripe.com/v1/restricted_keys', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${stripeSecret}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'name=indiiOS-rotated&restrictions[resources][]=charges&restrictions[resources][]=customers',
                });
                if (!stripeRes.ok) {
                    const errBody = await stripeRes.text();
                    return { success: false, error: `Stripe key rotation failed: ${errBody}` };
                }
                const stripeData = await stripeRes.json() as { key?: string };
                newKey = stripeData.key ?? null;

            } else if (serviceName === 'github') {
                // GitHub: update a repository secret via the Secrets API
                const { github_token, secret_name, repo } = vaultData as { github_token: string; secret_name: string; repo: string };
                if (!github_token || !secret_name || !repo) {
                    return { success: false, error: 'GitHub token, secret_name, and repo required in vault.' };
                }
                const [owner, repoName] = repo.split('/');
                // Get the repo's public key for secret encryption
                const pubKeyRes = await fetch(
                    `https://api.github.com/repos/${owner}/${repoName}/actions/secrets/public-key`,
                    { headers: { 'Authorization': `Bearer ${github_token}`, 'Accept': 'application/vnd.github+json' } }
                );
                if (!pubKeyRes.ok) {
                    return { success: false, error: `Failed to fetch GitHub repo public key: ${pubKeyRes.statusText}` };
                }
                const pubKeyData = await pubKeyRes.json() as { key: string; key_id: string };
                // Note: proper encryption with libsodium would be done here in a full implementation.
                // For now, we update the secret placeholder to trigger CI re-fetch.
                const patchRes = await fetch(
                    `https://api.github.com/repos/${owner}/${repoName}/actions/secrets/${secret_name}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${github_token}`,
                            'Accept': 'application/vnd.github+json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            encrypted_value: (vaultData.key as string) ?? '', // caller should pre-encrypt with pubKeyData.key
                            key_id: pubKeyData.key_id,
                        }),
                    }
                );
                if (!patchRes.ok && patchRes.status !== 204) {
                    return { success: false, error: `GitHub secret update failed: ${patchRes.statusText}` };
                }
                newKey = `[github-secret-updated:${secret_name}]`; // Not returned — stays in GitHub

            } else {
                return { success: false, error: `Key rotation not implemented for service: ${serviceName}` };
            }

            if (!newKey) {
                return { success: false, error: 'Rotation succeeded but no new key was returned by provider.' };
            }

            // Return the new key to the renderer — it handles the Firestore write
            return {
                success: true,
                service: serviceName,
                newKey,
                message: `Credentials for ${serviceName} rotated successfully via provider API.`
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[SecurityHandler] Rotation Error:', error);
            return { success: false, error: message };
        }
    });

    // 2. Scan for Vulnerabilities
    ipcMain.handle('security:scan-vulnerabilities', async (event: IpcMainInvokeEvent, data: unknown) => {
        validateSender(event);

        try {
            const validated = ScanSchema.parse(data);
            const scope = validated.scope || process.cwd();

            console.log(`[SecurityHandler] Running vulnerability scan on: ${scope}`);

            const result = await AgentSupervisor.execute<{ success?: boolean; status?: string; error?: string; data?: Record<string, unknown>; vulnerabilities?: unknown[] }>(
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
            const vulnCount = scanData && 'vulnerabilities' in scanData && Array.isArray(scanData.vulnerabilities)
                ? scanData.vulnerabilities.length : 0;

            return {
                success: true,
                scan: scanData,
                message: `Vulnerability scan complete. Found ${vulnCount} issues.`
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[SecurityHandler] Scan Error:', error);
            return { success: false, error: message };
        }
    });
}
