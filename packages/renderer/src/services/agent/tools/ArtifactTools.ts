import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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
    }) => {
        try {
            const { filename, content, artifactType, requestFeedback } = args;
            
            const result = await (window as any).electronAPI.agent.createArtifact(filename, content, {
                artifactType: artifactType || 'other',
                requestFeedback: !!requestFeedback
            });
            
            if (result.success) {
                return {
                    ...toolSuccess(result.data, `Artifact ${filename} created successfully.`),
                    ...(requestFeedback ? { status: 'awaiting_approval' } : {})
                };
            } else {
                return toolError(result.error || "Failed to create artifact", "ARTIFACT_CREATE_FAILED");
            }
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
            const result = await (window as any).electronAPI.agent.multiReplaceFileContent(args);
            
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

import type { FunctionDeclaration } from '../types';

export const ARTIFACT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: 'create_artifact',
        description: 'Create an artifact document to present structured information to the user. Use this tool to write markdown files containing plans, reports, or data.',
        parameters: {
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: "The name of the file to create (e.g., 'implementation_plan.md')."
                },
                content: {
                    type: 'string',
                    description: "The markdown content to write to the file."
                },
                artifactType: {
                    type: 'string',
                    enum: ['implementation_plan', 'walkthrough', 'task', 'other'],
                    description: "The type of artifact being created."
                },
                requestFeedback: {
                    type: 'boolean',
                    description: "Set to true to explicitly pause execution and request user approval/feedback."
                }
            },
            required: ['filename', 'content']
        }
    },
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
