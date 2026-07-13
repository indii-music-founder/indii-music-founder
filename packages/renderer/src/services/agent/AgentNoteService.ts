import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { OrganizationService } from '@/services/OrganizationService';

export interface AgentNote {
    id: string;
    fromAgentId: string;
    toAgentId: string;
    content: string;
    sessionId?: string;
    projectId?: string;
    createdAt?: number;
}

/** Durable, cross-device manager notes. These deliberately have no task field. */
class AgentNoteService {
    async share(note: Omit<AgentNote, 'id' | 'createdAt'>): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in is required to share an agent note.');
        const ref = await addDoc(collection(db, 'agent_notes'), {
            ...note,
            userId,
            orgId: OrganizationService.getCurrentOrgId() || 'personal',
            createdAt: serverTimestamp(),
        });
        return ref.id;
    }

    async forAgent(agentId: string, projectId?: string): Promise<AgentNote[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        const constraints = [where('userId', '==', userId), where('toAgentId', '==', agentId)];
        if (projectId) constraints.push(where('projectId', '==', projectId));
        const snapshot = await getDocs(query(collection(db, 'agent_notes'), ...constraints, orderBy('createdAt', 'desc'), limit(12)));
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, fromAgentId: data.fromAgentId, toAgentId: data.toAgentId, content: data.content, sessionId: data.sessionId, projectId: data.projectId, createdAt: data.createdAt?.toMillis?.() };
        });
    }
}

export const agentNoteService = new AgentNoteService();
