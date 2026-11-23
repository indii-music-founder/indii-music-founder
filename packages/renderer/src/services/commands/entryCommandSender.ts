import { getEntryCommand } from './EntryCommandRegistry';

/**
 * Slash-command replies are stored with the command id as their sender
 * (`connect-remote`, `create-media`, a saved custom command, …). They are
 * indii speaking, so show them as the Conductor instead of "Unknown Agent".
 */
export function displaySenderId(agentId: string | undefined): string | undefined {
    if (!agentId) return agentId;
    if (agentId === 'save-command' || getEntryCommand(agentId)) return 'generalist';
    return agentId;
}
