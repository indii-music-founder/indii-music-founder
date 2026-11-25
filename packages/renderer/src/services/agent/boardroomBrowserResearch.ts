import {
    executeWorkspaceAction,
    type BoardroomWorkspaceAction,
    type BoardroomWorkspaceResult,
} from './boardroomWorkspaceActions';

export interface BoardroomBrowserAssignment {
    requestId: string;
    stepId: string;
    agentId: string;
}

export function createBrowserWorkspaceAction(
    assignment: BoardroomBrowserAssignment,
    operation: string,
    payload?: Record<string, unknown>,
): BoardroomWorkspaceAction {
    return {
        missionId: assignment.requestId,
        stepId: assignment.stepId,
        agentId: assignment.agentId,
        target: 'browser',
        operation,
        payload,
    };
}

export async function executeBrowserAssignmentAction(
    assignment: BoardroomBrowserAssignment,
    operation: string,
    payload?: Record<string, unknown>,
): Promise<BoardroomWorkspaceResult> {
    return executeWorkspaceAction(createBrowserWorkspaceAction(assignment, operation, payload));
}

export interface BoardroomBrowserPage {
    url: string;
    title: string;
    text: string;
    links: { url: string; label: string }[];
}

type BrowserReader = (url: string, assignment: BoardroomBrowserAssignment, signal?: AbortSignal) => Promise<BoardroomBrowserPage>;
type FontDownloader = (family: string, assignment: BoardroomBrowserAssignment, signal?: AbortSignal) => Promise<{ filename: string; size: number }>;
let currentReader: BrowserReader | undefined;
let currentFontDownloader: FontDownloader | undefined;

export function registerBoardroomBrowserReader(reader: BrowserReader) {
    currentReader = reader;
    return () => {
        if (currentReader === reader) currentReader = undefined;
    };
}

export async function readBoardroomBrowser(url: string, assignment: BoardroomBrowserAssignment, signal?: AbortSignal) {
    return currentReader?.(url, assignment, signal);
}

export function registerBoardroomFontDownloader(download: FontDownloader) {
    currentFontDownloader = download;
    return () => {
        if (currentFontDownloader === download) currentFontDownloader = undefined;
    };
}

export async function downloadBoardroomFont(family: string, assignment: BoardroomBrowserAssignment, signal?: AbortSignal) {
    return currentFontDownloader?.(family, assignment, signal);
}
