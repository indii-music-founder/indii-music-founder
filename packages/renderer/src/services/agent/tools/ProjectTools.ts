// useStore removed
import type { AppSlice } from '@/core/store';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';

export const ProjectTools = {
    create_project: wrapTool('create_project', async (args: { name: string, type: AppSlice['currentModule'], orgId?: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const currentOrganizationId = toolContext
            ? toolContext.get('currentOrganizationId')
            : store.currentOrganizationId;

        const targetOrgId = args.orgId || currentOrganizationId;

        if (!targetOrgId) {
            return toolError("No active organization found. Please switch to or create an organization first.", "ORG_REQUIRED");
        }

        // Mutations still go through store actions (not in execution context scope)
        const projectId = await store.createNewProject(args.name, args.type, targetOrgId);

        return toolSuccess({
            projectId,
            name: args.name,
            type: args.type
        }, `Project created successfully. ID: ${projectId}`);
    }),

    list_projects: wrapTool('list_projects', async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const projects = (toolContext
            ? toolContext.get('projects')
            : store.projects) || [];

        // Ensure projects are loaded if empty
        if (projects.length === 0) {
            await store.loadProjects();
            // Re-read after loading
            const loadedProjects = (toolContext
                ? toolContext.get('projects')
                : store.projects) || [];

            if (loadedProjects.length === 0) {
                return toolSuccess({ projects: [] }, "No projects found.");
            }

            return toolSuccess({ projects: loadedProjects }, `Found ${loadedProjects.length} projects.`);
        }

        return toolSuccess({ projects }, `Found ${projects.length} projects.`);
    }),

    open_project: wrapTool('open_project', async (args: { projectId: string }, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const { useStore } = await import('@/core/store');
        const store = useStore.getState();

        // Phase 3.6: Read state through execution context when available
        const projects = (toolContext
            ? toolContext.get('projects')
            : store.projects) || [];

        const project = projects.find(p => p.id === args.projectId);
        if (!project) {
            return toolError(`Project with ID ${args.projectId} not found.`, "NOT_FOUND");
        }

        // Mutations still go through store actions
        store.setProject(args.projectId);
        store.setModule(project.type);

        return toolSuccess({
            projectId: args.projectId,
            projectName: project.name,
            projectType: project.type
        }, `Opened project: ${project.name}`);
    }),

    create_task: wrapTool('create_task', async (args: { title: string; projectId: string; dueDate?: string; priority?: 'low' | 'medium' | 'high' }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to create a task.");
            }

            const docRef = await addDoc(collection(db, 'users', uid, 'tasks'), {
                ...args,
                status: 'todo',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                priority: args.priority || 'medium'
            });

            return toolSuccess({
                taskId: docRef.id,
                ...args
            }, `Successfully created task "${args.title}" for project ${args.projectId}.`);
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(`Failed to create task: ${error.message}`);
        }
    }),

    list_tasks: wrapTool('list_tasks', async (args: { projectId?: string; status?: string }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to list tasks.");
            }

            let tasksQuery = query(collection(db, 'users', uid, 'tasks'), orderBy('createdAt', 'desc'));
            if (args.projectId) {
                tasksQuery = query(tasksQuery, where('projectId', '==', args.projectId));
            }
            if (args.status) {
                tasksQuery = query(tasksQuery, where('status', '==', args.status));
            }

            const snapshot = await getDocs(tasksQuery);
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            return toolSuccess({ tasks }, `Found ${tasks.length} tasks.`);
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(`Failed to list tasks: ${error.message}`);
        }
    }),

    update_task_status: wrapTool('update_task_status', async (args: { taskId: string; status: 'todo' | 'in_progress' | 'done' }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to update tasks.");
            }

            const taskRef = doc(db, 'users', uid, 'tasks', args.taskId);
            await updateDoc(taskRef, {
                status: args.status,
                updatedAt: serverTimestamp()
            });

            return toolSuccess({ taskId: args.taskId, status: args.status }, `Task status updated to ${args.status}.`);
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(`Failed to update task: ${error.message}`);
        }
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    create_project,
    list_projects,
    open_project,
    create_task,
    list_tasks,
    update_task_status
} = ProjectTools;
