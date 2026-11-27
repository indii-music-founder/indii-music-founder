import { wrapTool, toolSuccess, toolError } from '@/services/agent/utils/ToolUtils';
import type { AnyToolFunction, FunctionDeclaration } from '@/services/agent/types';
import { auth } from '@/services/firebase';
import { importWithRetry } from '@/utils/dynamicImport';
import { webArtifactStorage } from '@/services/agent/WebArtifactStorage';

export const ArtifactTools = {
    /**
     * Create an artifact document to present structured information to the user.
     * Use this tool to write markdown files containing plans, reports, or data.
     */
    create_artifact: wrapTool('create_artifact', async (args: {
        filename: string;
        content: string;
        artifactType?: 'implementation_plan' | 'walkthrough' | 'task' | 'other';
        requestFeedback?: boolean;
    }, context) => {
        try {
            const { filename, content, artifactType, requestFeedback } = args;
            const owner = auth.currentUser?.uid;
            if (context?.isReadOnly || context?.signal?.aborted || (context?.userId && context.userId !== owner)) {
                return toolError('The artifact request is no longer active.', 'ARTIFACT_REQUEST_INACTIVE');
            }
            const options = { artifactType: artifactType || 'other', requestFeedback: !!requestFeedback };
            const store = context?.boardroomExecution
                ? (await importWithRetry(() => import('@/core/store'))).useStore
                : undefined;
            const missionIsActive = () => {
                const room = store?.getState();
                return !context?.signal?.aborted && owner === auth.currentUser?.uid
                    && (!room || (room.conversationMode === 'boardroom'
                        && (!context?.projectId || room.currentProjectId === context.projectId)));
            };
            if (!missionIsActive()) {
                return toolError('The Boardroom mission is no longer active.', 'BOARDROOM_MISSION_INACTIVE');
            }

            let data: unknown = { ...options, filename };
            if (window.electronAPI?.agent?.createArtifact) {
                const result = await window.electronAPI.agent.createArtifact(filename, content, options);
                if (!result.success) return toolError(result.error || 'Failed to create artifact', 'ARTIFACT_CREATE_FAILED');
                data = result.data;
            } else {
                await webArtifactStorage.write(owner, filename, content);
            }

            const room = store?.getState();
            if (room && room.user?.uid === owner && missionIsActive()) {
                room.openBoardroomWorkbench({ kind: 'artifact', filename });
            }
            return {
                ...toolSuccess(data, `Saved ${filename} to Workbench.`),
                ...(requestFeedback ? { status: 'AWAITING_HUMAN' } : {})
            };
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : String(error), "ARTIFACT_CREATE_ERROR");
        }
    }),

    /**
     * Modify multiple blocks of text in a single file.
     * Use this to edit code or text in a file without rewriting the entire file.
     */
    multi_replace_file_content: wrapTool('multi_replace_file_content', async (args: {
        targetFile: string;
        instruction: string;
        description: string;
        replacementChunks: Array<{
            targetContent: string;
            replacementContent: string;
            startLine: number;
            endLine: number;
            allowMultiple?: boolean;
        }>;
    }) => {
        try {
            const result = await window.electronAPI!.agent.multiReplaceFileContent(args);

            if (result.success) {
                return toolSuccess(result.data, `File ${args.targetFile} modified successfully.`);
            } else {
                return toolError(result.error || "Failed to modify file", "FILE_MODIFY_FAILED");
            }
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : String(error), "FILE_MODIFY_ERROR");
        }
    }),
} satisfies Record<string, AnyToolFunction>;

export const CREATE_ARTIFACT_DECLARATION: FunctionDeclaration = {
    name: 'create_artifact',
    description: 'Save a Markdown document containing a plan, brief, or draft. In Boardroom this opens the exact saved document in Workbench.',
    parameters: {
        type: 'object',
        properties: {
            filename: {
                type: 'string',
                description: "The name of the file to create (e.g., 'implementation_plan.md')."
            },
            content: {
                type: 'string',
                description: 'The markdown content to write to the file.'
            },
            artifactType: {
                type: 'string',
                enum: ['implementation_plan', 'walkthrough', 'task', 'other'],
                description: 'The type of artifact being created.'
            },
            requestFeedback: {
                type: 'boolean',
                description: 'Set to true to explicitly pause execution and request user approval/feedback.'
            }
        },
        required: ['filename', 'content']
    }
};

export const ARTIFACT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
    CREATE_ARTIFACT_DECLARATION,
    {
        name: 'multi_replace_file_content',
        description: "Modify multiple non-contiguous blocks of text in a single file. Use this to edit code or text in a file.",
        parameters: {
            type: 'object',
            properties: {
                targetFile: {
                    type: 'string',
                    description: "The absolute path to the file to modify."
                },
                instruction: {
                    type: 'string',
                    description: "A description of the changes you are making."
                },
                description: {
                    type: 'string',
                    description: "Brief, user-facing explanation of what this change did."
                },
                replacementChunks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            targetContent: { type: 'string', description: 'Exact string to be replaced.' },
                            replacementContent: { type: 'string', description: 'Content to replace with.' },
                            startLine: { type: 'number' },
                            endLine: { type: 'number' },
                            allowMultiple: { type: 'boolean' }
                        },
                        required: ['targetContent', 'replacementContent', 'startLine', 'endLine']
                    }
                }
            },
            required: ['targetFile', 'instruction', 'description', 'replacementChunks']
        }
    }
];
