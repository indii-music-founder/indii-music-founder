import type { AgentContext } from '@/services/agent/types';
import { logger } from '@/utils/logger';
import { importWithRetry } from '@/utils/dynamicImport';

export async function buildMeetingRoomProtocol(context: AgentContext): Promise<string> {
    const { agentRegistry } = await importWithRetry(() => import('@/services/agent/registry'));
    const seated = context.seatedAgents || [];
    const seatedNames = seated.map((id: string) => `${agentRegistry.get(id)?.name || id} (ID: '${id}')`).join(', ');
    const roomTitle = typeof context.meetingRoomTitle === 'string' && context.meetingRoomTitle.trim()
        ? context.meetingRoomTitle.trim()
        : 'Meeting Room';
    const roomBrief = typeof context.meetingRoomBrief === 'string' && context.meetingRoomBrief.trim()
        ? `\nRoom Mission Brief: ${context.meetingRoomBrief.trim()}`
        : '';
    return `\n## MEETING ROOM COLLABORATION PROTOCOL\nYou are collaborating inside the "${roomTitle}" Meeting Room.${roomBrief}\nThis Meeting Room has a stationary, locked roster ([SEATED_AGENTS]) for the life of the room — agents cannot be added or removed after creation. If expertise outside [SEATED_AGENTS] is needed, advise the user to create a new Meeting Room with that team rather than attempting to add or seat agents here.\nBuild directly on peer contributions and shared room assets. Peer participants share factual notes via share_note; do not delegate tasks across departments.\n\n[SEATED_AGENTS]: ${seatedNames}.\n`;
}

export function indexAgentResponse(name: string, text: string, context?: AgentContext): void {
    const scope = context?.meetingRoomSessionId ? {
        sessionId: context.meetingRoomSessionId,
        projectId: context.projectId,
        memoryScope: context.meetingRoomIsolateMemory === false ? 'global' as const : 'room' as const,
    } : undefined;

    void importWithRetry(() => import('@/services/agent/memory/AlwaysOnMemoryEngine'))
        .then(({ alwaysOnMemoryEngine }) =>
            alwaysOnMemoryEngine.ingest(`Agent Response (${name}): ${text.substring(0, 500)}`, 'agent_output', 'context', scope))
        .catch((error: unknown) => logger.warn('[BaseAgent] Failed to store streaming response in memory', error));
}
