import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { AgentTaskStateEnum, AgentTaskGraph } from '../shared/types/agent-state';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

export const onAgentTaskUpdate = onDocumentWritten('agent_tasks/{taskId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot || !snapshot.after.exists) return; // Deleted

    const data = snapshot.after.data() as AgentTaskGraph;

    let needsUpdate = false;
    const updates: Partial<AgentTaskGraph> = {};

    // 1. If overall task is PENDING, transition to RUNNING.
    if (data.status === AgentTaskStateEnum.PENDING) {
        updates.status = AgentTaskStateEnum.RUNNING;
        needsUpdate = true;
    }

    // 2. If overall task is RUNNING, check nodes to see what needs to run next.
    if (data.status === AgentTaskStateEnum.RUNNING || updates.status === AgentTaskStateEnum.RUNNING) {
        let allCompleted = true;
        let anyFailed = false;

        const updatedNodes = { ...data.nodes };

        for (const [nodeId, node] of Object.entries(updatedNodes)) {
            if (node.state === AgentTaskStateEnum.FAILED) {
                anyFailed = true;
            }
            if (node.state !== AgentTaskStateEnum.COMPLETED && node.state !== AgentTaskStateEnum.FAILED) {
                allCompleted = false;
            }

            // If a node is PENDING and all its dependencies are COMPLETED, move it to RUNNING
            if (node.state === AgentTaskStateEnum.PENDING) {
                const deps = node.dependencies || [];
                const allDepsCompleted = deps.every(d => updatedNodes[d]?.state === AgentTaskStateEnum.COMPLETED);

                if (allDepsCompleted) {
                    updatedNodes[nodeId] = {
                        ...node,
                        state: AgentTaskStateEnum.RUNNING
                    };
                    needsUpdate = true;
                }
            }
        }

        if (needsUpdate || updates.status) {
            updates.nodes = updatedNodes;
        }

        // 3. Mark overall task FAILED or COMPLETED
        if (anyFailed) {
            updates.status = AgentTaskStateEnum.FAILED;
            needsUpdate = true;
        } else if (allCompleted) {
            updates.status = AgentTaskStateEnum.COMPLETED;
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        updates.updatedAt = Date.now();
        await snapshot.after.ref.update(updates);
        console.log(`[Orchestration] Updated task ${data.taskId || event.params.taskId} state. New Status: ${updates.status || data.status}`);
    }
});
