import { McpContext } from './types.js';

export function verifyOwnership(context: McpContext, targetUserId: string) {
    if (!context || !context.user) {
        throw new Error('Unauthorized: Missing user context');
    }
    if (context.user.uid !== targetUserId && context.user.admin !== true) {
        throw new Error(`Forbidden: User ${context.user.uid} is not authorized to act on behalf of ${targetUserId}`);
    }
}
