import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import { readBoardroomBrowser } from '../boardroomBrowserResearch';
import type { AnyToolFunction } from '../types';

/** Public-page research only. This surface has no browser input or session controls. */
export const WebResearchTools = {
    web_extract: wrapTool('web_extract', async (args: { url: string }, context) => {
        try {
            const mission = context?.boardroomExecution;
            if (mission && !context?.isReadOnly) {
                const page = await readBoardroomBrowser(args.url, {
                    requestId: mission.requestId,
                    stepId: mission.stepId,
                    agentId: mission.ownerAgentId,
                }, context?.signal);
                if (page) return toolSuccess({ ...page, finalUrl: page.url }, `Read the shared page ${page.url}.`);
            }
            const bridge = window.electronAPI?.agent;
            if (!bridge) {
                return toolError(
                    'Public web extraction is available in the indii desktop app only.',
                    'WEB_EXTRACT_DESKTOP_ONLY',
                );
            }

            const response = await bridge.extractWebPage(args.url);
            if (!response.success || !response.data) {
                return toolError(response.error || 'Web extraction failed.', 'WEB_EXTRACT_FAILED');
            }

            return toolSuccess(response.data, `Read public page ${response.data.finalUrl}.`);
        } catch (error: unknown) {
            return toolError(
                `Web extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                'WEB_EXTRACT_INVOKE_ERROR',
            );
        }
    }),
} satisfies Record<string, AnyToolFunction>;
