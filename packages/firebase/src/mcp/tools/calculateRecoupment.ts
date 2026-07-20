import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';

import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

function stableId(...parts: string[]): string {
    return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error || 'unknown Firestore error');
}

function ledgerMicros(microsValue: unknown, decimalValue?: unknown): number {
    if (Number.isSafeInteger(microsValue)) return Number(microsValue);
    if (typeof decimalValue === 'number' && Number.isFinite(decimalValue)) return Math.round(decimalValue * 1_000_000);
    return 0;
}

export const calculateRecoupment: IndiiMcpTool = {
    name: 'calculate_recoupment',
    description: 'Calculates release recoupment from Firestore earnings and recoupment balance ledgers.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string' },
        },
        required: ['releaseId'],
    },
    handler: async (rawArgs: Record<string, unknown>, context: McpContext) => {
        const targetUserId = String(rawArgs.userId || rawArgs.artistId || rawArgs.ownerId || context.user.uid);
        try {
            verifyOwnership(context, targetUserId);
        } catch (error: unknown) {
            return {
                isError: true,
                content: [{ type: 'text', text: errorMessage(error) }],
            };
        }

        const releaseId = typeof rawArgs.releaseId === 'string' ? rawArgs.releaseId.trim() : '';
        if (!releaseId || releaseId.includes('/') || releaseId.length > 200) {
            return {
                isError: true,
                content: [{ type: 'text', text: 'releaseId is required and must be a valid Firestore document identifier.' }],
            };
        }

        try {
            const firestore = admin.firestore();
            const recoupmentId = `recoup_${stableId(targetUserId, releaseId).slice(0, 48)}`;
            const [balanceSnap, earningsSnap] = await Promise.all([
                firestore.collection('recoupment_balances').doc(recoupmentId).get(),
                firestore.collection('earnings')
                    .where('userId', '==', targetUserId)
                    .where('releaseId', '==', releaseId)
                    .get(),
            ]);

            const balance = balanceSnap.exists ? balanceSnap.data() || {} : {};
            const outstandingBalanceMicros = ledgerMicros(balance.balanceMicros, balance.balance);
            let grossRevenueMicros = 0;
            let netRevenueMicros = 0;
            const earningsIds: string[] = [];

            earningsSnap.docs.forEach(doc => {
                const data = doc.data() || {};
                earningsIds.push(doc.id);
                grossRevenueMicros += ledgerMicros(data.grossRevenueMicros, data.grossRevenue);
                netRevenueMicros += ledgerMicros(data.netRevenueMicros, data.netRevenue);
            });

            const totalRecoupableMicros = ledgerMicros(balance.totalExpenseMicros, balance.totalExpense) || outstandingBalanceMicros;
            const recoupedMicros = Math.max(0, totalRecoupableMicros - outstandingBalanceMicros);
            const revenueAvailableMicros = Math.max(0, netRevenueMicros);
            const projectedRemainingMicros = Math.max(0, outstandingBalanceMicros - revenueAvailableMicros);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        artistId: targetUserId,
                        releaseId,
                        source: {
                            recoupmentBalance: `recoupment_balances/${recoupmentId}`,
                            earningsCollection: 'earnings',
                        },
                        currency: typeof balance.currency === 'string' ? balance.currency : 'USD',
                        grossRevenue: grossRevenueMicros / 1_000_000,
                        netRevenue: netRevenueMicros / 1_000_000,
                        totalRecoupable: totalRecoupableMicros / 1_000_000,
                        recoupedToDate: recoupedMicros / 1_000_000,
                        outstandingBalance: outstandingBalanceMicros / 1_000_000,
                        projectedRemainingAfterCurrentEarnings: projectedRemainingMicros / 1_000_000,
                        isRecouped: outstandingBalanceMicros <= 0,
                        earningsCount: earningsIds.length,
                        earningsIds,
                    }, null, 2),
                }],
            };
        } catch (error: unknown) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Recoupment lookup failed: ${errorMessage(error)}` }],
            };
        }
    },
};
