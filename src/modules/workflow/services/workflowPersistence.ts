import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, doc, getDoc, query, where, updateDoc } from 'firebase/firestore';
import { SavedWorkflow, CustomNode, CustomEdge } from '../types';

const WORKFLOWS_COLLECTION = 'workflows';

export const saveWorkflow = async (workflow: Omit<SavedWorkflow, 'id'> & { id?: string }, userId: string): Promise<string> => {
    try {
        const workflowData = {
            ...workflow,
            userId,
            updatedAt: new Date().toISOString(),
            // Ensure we don't save undefined values which Firestore dislikes
            nodes: workflow.nodes.map(node => JSON.parse(JSON.stringify(node))),
            edges: workflow.edges.map(edge => JSON.parse(JSON.stringify(edge)))
        };

        if (workflow.id) {
            // Update existing
            const docRef = doc(db, WORKFLOWS_COLLECTION, workflow.id);
            await updateDoc(docRef, workflowData);
            return workflow.id;
        } else {
            // Create new
            const docRef = await addDoc(collection(db, WORKFLOWS_COLLECTION), {
                ...workflowData,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        }
    } catch (error) {
        console.error("Error saving workflow:", error);
        throw error;
    }
};

export const getUserWorkflows = async (userId: string): Promise<SavedWorkflow[]> => {
    try {
        const q = query(collection(db, WORKFLOWS_COLLECTION), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SavedWorkflow));
    } catch (error) {
        console.error("Error getting user workflows:", error);
        throw error;
    }
};

export const loadWorkflow = async (workflowId: string): Promise<SavedWorkflow | null> => {
    try {
        const docRef = doc(db, WORKFLOWS_COLLECTION, workflowId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as SavedWorkflow;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error loading workflow:", error);
        throw error;
    }
};
