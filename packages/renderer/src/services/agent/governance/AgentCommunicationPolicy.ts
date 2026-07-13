import { getDepartmentOf, isHead, isWorker } from '../departments';

export type AgentCommunicationKind = 'task' | 'note';
export type AgentConversationMode = 'direct' | 'department' | 'boardroom';

export interface CommunicationRequest {
    sourceAgentId: string;
    targetAgentId: string;
    kind: AgentCommunicationKind;
    mode?: AgentConversationMode;
    seatedAgents?: string[];
}

export interface CommunicationDecision {
    allowed: boolean;
    code?: string;
    reason?: string;
}

/**
 * The organisation's communication boundary. A note is information, never an
 * instruction. Only a department head may assign work to that department's
 * employees; peer managers coordinate by notes in Boardroom.
 */
export function validateAgentCommunication(request: CommunicationRequest): CommunicationDecision {
    const { sourceAgentId, targetAgentId, kind, mode, seatedAgents = [] } = request;
    if (sourceAgentId === targetAgentId) {
        return { allowed: false, code: 'SELF_COMMUNICATION_BLOCKED', reason: 'An agent cannot message itself.' };
    }
    if (!mode) return { allowed: true };
    if (mode === 'direct') {
        return { allowed: false, code: 'DIRECT_MODE_NO_DELEGATION', reason: 'Direct mode is a private user-to-agent conversation.' };
    }

    const sourceDepartment = getDepartmentOf(sourceAgentId);
    const targetDepartment = getDepartmentOf(targetAgentId);

    if (mode === 'department') {
        if (!sourceDepartment || sourceDepartment.id !== targetDepartment?.id) {
            return { allowed: false, code: 'DEPARTMENT_SCOPE_VIOLATION', reason: 'Department communication cannot cross department boundaries.' };
        }
        if (kind === 'task' && !(isHead(sourceAgentId) && isWorker(targetAgentId))) {
            return { allowed: false, code: 'MANAGER_ROUTE_REQUIRED', reason: 'Only a department manager can assign work to an employee in that department.' };
        }
        return { allowed: true };
    }

    // Boardroom is manager-to-manager information sharing only. It never runs
    // a peer manager's work and employees do not sit at this table.
    if (!isHead(sourceAgentId) || !isHead(targetAgentId)) {
        return { allowed: false, code: 'BOARDROOM_TIER_VIOLATION', reason: 'Only department managers may communicate in Boardroom.' };
    }
    if (!seatedAgents.includes(sourceAgentId) || !seatedAgents.includes(targetAgentId)) {
        return { allowed: false, code: 'BOARDROOM_SEATING_VIOLATION', reason: 'Both managers must be seated in Boardroom.' };
    }
    if (kind === 'task') {
        return { allowed: false, code: 'BOARDROOM_NOTES_ONLY', reason: 'Boardroom managers may share facts and context, but cannot assign work to one another.' };
    }
    return { allowed: true };
}
