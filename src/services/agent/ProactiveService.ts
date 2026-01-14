import { db, auth } from '@/services/firebase';
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc,
    Timestamp,
    deleteDoc,
    getDocs
} from 'firebase/firestore';
import { events, EventType } from '@/core/events';
import { v4 as uuidv4 } from 'uuid';
import { AgentContext, ProactiveTask } from './types';

export class ProactiveService {
    private unsubscribers: (() => void)[] = [];
    private activeInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.initializeEventListeners();
        this.startPolling();
    }

    /**
     * Listen for system events and trigger subscribed agents
     */
    private initializeEventListeners() {
        // For simplicity in Alpha, we'll watch all events and check Firestore for subscriptions
        // A more optimized way would be to register specific listeners on the EventBus
        const allEvents: EventType[] = [
            'AGENT_ACTION',
            'DEPARTMENT_REQUEST',
            'SYSTEM_ALERT',
            'TASK_COMPLETED',
            'TASK_FAILED'
        ];

        allEvents.forEach(eventType => {
            events.on(eventType, async (data) => {
                await this.handleSystemEvent(eventType, data);
            });
        });
    }

    /**
     * Start a lightweight polling mechanism for scheduled tasks
     */
    private startPolling() {
        if (this.activeInterval) clearInterval(this.activeInterval);

        this.activeInterval = setInterval(async () => {
            await this.checkScheduledTasks();
        }, 30000); // Check every 30 seconds
    }

    private async handleSystemEvent(eventType: string, data: any) {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Query Firestore for agents subscribed to this event
        const q = query(
            collection(db, 'proactive_tasks'),
            where('userId', '==', userId),
            where('triggerType', '==', 'event'),
            where('eventPattern', '==', eventType),
            where('status', '==', 'pending')
        );

        const snapshot = await getDocs(q);
        for (const document of snapshot.docs) {
            const task = { id: document.id, ...document.data() } as ProactiveTask;
            await this.executeProactiveTask(task, data);
        }
    }

    private async checkScheduledTasks() {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const now = Date.now();
        const q = query(
            collection(db, 'proactive_tasks'),
            where('userId', '==', userId),
            where('triggerType', '==', 'schedule'),
            where('status', '==', 'pending'),
            where('executeAt', '<=', now)
        );

        const snapshot = await getDocs(q);
        for (const document of snapshot.docs) {
            const task = { id: document.id, ...document.data() } as ProactiveTask;
            await this.executeProactiveTask(task);
        }
    }

    private async executeProactiveTask(task: ProactiveTask, eventData?: any) {
        try {
            // Update status to executing to prevent double-triggering
            await updateDoc(doc(db, 'proactive_tasks', task.id), {
                status: 'executing'
            });

            console.info(`[ProactiveService] Triggering agent ${task.agentId} for task: ${task.task}`);

            // Construct proactive prompt
            const contextMsg = eventData ? `\nSystem Event Context: ${JSON.stringify(eventData)}` : '';
            const fullTask = `[PROACTIVE TRIGGER] ${task.task}${contextMsg}`;

            // Run agent
            const { agentService } = await import('./AgentService');
            const context: AgentContext = {
                traceId: `proactive-${task.id}`,
                // @ts-expect-error - testing private method access if needed - extensions for proactive details
                proactiveTask: task,
                triggerType: task.triggerType
            };

            await agentService.runAgent(task.agentId, fullTask, context);

            // Mark as completed
            await updateDoc(doc(db, 'proactive_tasks', task.id), {
                status: 'completed'
            });

        } catch (error: any) {
            console.error(`[ProactiveService] Failed to execute task ${task.id}:`, error);
            await updateDoc(doc(db, 'proactive_tasks', task.id), {
                status: 'failed',
                lastError: error.message
            });
        }
    }

    /**
     * Schedule a task for future execution
     */
    async scheduleTask(agentId: string, instruction: string, executeAtMs: number): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated');

        const task: Omit<ProactiveTask, 'id'> = {
            agentId,
            task: instruction,
            triggerType: 'schedule',
            executeAt: executeAtMs,
            status: 'pending',
            createdAt: Date.now(),
            userId
        };

        const docRef = await addDoc(collection(db, 'proactive_tasks'), task);
        return docRef.id;
    }

    /**
     * Subscribe an agent to a system event
     */
    async subscribeToEvent(agentId: string, eventType: EventType, instruction: string): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated');

        const task: Omit<ProactiveTask, 'id'> = {
            agentId,
            task: instruction,
            triggerType: 'event',
            eventPattern: eventType,
            status: 'pending',
            createdAt: Date.now(),
            userId
        };

        const docRef = await addDoc(collection(db, 'proactive_tasks'), task);
        return docRef.id;
    }

    dispose() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.unsubscribers.forEach(unsub => unsub());
    }
}

export const proactiveService = new ProactiveService();
