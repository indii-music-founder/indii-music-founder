import { downloadBoardroomFont } from '../boardroomBrowserResearch';
import type { FunctionDeclaration } from '../types';
import { toolError, toolSuccess, wrapTool } from '../utils/ToolUtils';

export const BOARDROOM_FONT_DOWNLOAD: FunctionDeclaration = {
    name: 'boardroom_download_google_font',
    description: 'Download a public Google Fonts family into the visible Boardroom browser for the artist to save. Use only when the artist asked for a font download. If any font is acceptable, choose Inter. The artist must share browser control with the assigned mission step.',
    parameters: {
        type: 'OBJECT',
        properties: {
            family: { type: 'STRING', description: 'The Google Fonts family name, for example Inter.' },
        },
        required: ['family'],
    },
};

export const BoardroomFontTools = {
    boardroom_download_google_font: wrapTool(BOARDROOM_FONT_DOWNLOAD.name, async ({ family }: { family: string }, context) => {
        const mission = context?.boardroomExecution;
        if (!mission || context.isReadOnly || context.signal?.aborted) {
            return toolError('Download fonts from an active Boardroom mission.', 'BOARDROOM_MISSION_REQUIRED');
        }
        if (typeof family !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 -]{0,69}$/.test(family)) {
            return toolError('Choose a Google Fonts family by name.', 'INVALID_FONT_FAMILY');
        }
        const receipt = await downloadBoardroomFont(family, {
            requestId: mission.requestId,
            stepId: mission.stepId,
            agentId: mission.ownerAgentId,
        }, context.signal);
        if (!receipt) return toolError('Open the Live Browser in Boardroom before downloading.', 'BOARDROOM_BROWSER_REQUIRED');
        return toolSuccess(receipt, `${receipt.filename} is ready to save in the Live Browser.`);
    }),
};
