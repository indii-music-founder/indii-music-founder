import { IndiiMcpTool, McpContext } from '../types.js';
import { verifyOwnership } from '../helpers.js';

export const stageStripePayouts: IndiiMcpTool = {
    name: 'stage_stripe_payouts',
    description: 'Prepares royalty payouts for one-click approval.',
    inputSchema: {
        type: 'object',
        properties: {
            artistId: { type: 'string' },
            payoutPeriod: { type: 'string' }
        },
        required: ['artistId', 'payoutPeriod']
    },
    handler: async (rawArgs: Record<string, unknown>, context: McpContext) => {
        const targetUserId = (rawArgs as any).userId || (rawArgs as any).artistId || (rawArgs as any).ownerId || context.user.uid;
        try {
            verifyOwnership(context, targetUserId);
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: e.message }]
            };
        }
        const uid = context.user.uid;

        const { artistId, payoutPeriod } = rawArgs as any;
        
        const db = (await import('firebase-admin')).firestore();
        const docRef = await db.collection('payoutJobs').add({
            status: 'staged',
            artistId,
            payoutPeriod,
            initiatorUid: uid,
            createdAt: (await import('firebase-admin')).firestore.FieldValue.serverTimestamp()
        });

        return {
            content: [{ type: 'text', text: `Successfully staged Stripe payouts for artist ${artistId} for period ${payoutPeriod}. Job ID: ${docRef.id}.` }]
        };
    }
};
