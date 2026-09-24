import log from 'electron-log';
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { ComputerScreenshotSchema, ComputerOpenAppSchema, ComputerClickSchema, ComputerKeySchema, ComputerScrollSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { computerExecutionService } from '../services/ComputerExecutionService';
import { computerAllowlistStore } from '../services/computer/ComputerAllowlistStore';
import { ComputerAuthorizationService, type ComputerAction, type ComputerApprovalScope } from '../services/computer/ComputerAuthorizationService';
import { FirebaseComputerAuthorizationBackend } from '../services/computer/FirebaseComputerAuthorizationBackend';

const authorizationService = new ComputerAuthorizationService(new FirebaseComputerAuthorizationBackend());
const SessionId = z.string().min(16).max(256);
const Token = z.string().min(32).max(256);
const Authorization = z.object({ token: Token, rendererSessionId: SessionId, agentId: z.string().min(1).max(128) }).strict();
const AuthorizeRequest = z.object({ idToken: z.string().min(32).max(16_384), approvalId: z.string().min(1).max(256), rendererSessionId: SessionId }).strict();
const DriveStart = z.object({ goal: z.string().trim().min(1).max(4000), maxSteps: z.number().int().min(1).max(30).default(15), authorization: Authorization }).strict();

const rendererId = (event: IpcMainInvokeEvent) => event.sender.id;
function failure(label: string, error: unknown) {
    log.error(label, error instanceof Error ? error.message : String(error)); // metadata only; never arguments
    return { success: false, error: error instanceof z.ZodError ? `Validation Error: ${error.errors[0].message}` : error instanceof Error ? error.message : String(error) };
}
async function confirmNativeApproval(event: IpcMainInvokeEvent, scope: ComputerApprovalScope): Promise<boolean> {
    const options = {
        type: 'warning' as const,
        title: 'Approve computer control',
        message: `Allow ${scope.toolName} to control this computer?`,
        detail: `Agent: ${scope.agentId}\nAction: ${scope.action}\nExact scope: ${JSON.stringify(scope.args).slice(0, 4000)}`,
        buttons: ['Cancel', 'Approve once'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
    };
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = owner ? await dialog.showMessageBox(owner, options) : await dialog.showMessageBox(options);
    return result.response === 1;
}
function authorizeAction(event: IpcMainInvokeEvent, input: { authorization?: unknown; driveSessionToken?: unknown }, toolName: string, action: ComputerAction, args: Record<string, unknown>) {
    const auth = Authorization.parse(input.authorization);
    if (input.driveSessionToken !== undefined) {
        const sessionToken = Token.parse(input.driveSessionToken);
        if (auth.token !== sessionToken) throw new Error('Computer drive token mismatch.');
        authorizationService.consumeDriveAction({ sessionToken, rendererId: rendererId(event), rendererSessionId: auth.rendererSessionId, agentId: auth.agentId, action });
    } else {
        authorizationService.consume({ token: auth.token, rendererId: rendererId(event), rendererSessionId: auth.rendererSessionId, agentId: auth.agentId, toolName, action, args });
    }
}

export function registerComputerHandlers() {
    ipcMain.handle('computer:check-permissions', async event => {
        try { validateSender(event); return { success: true, data: computerExecutionService.getPermissionStatus() }; }
        catch (error) { return failure('Computer permission check failed', error); }
    });
    ipcMain.handle('computer:authorize-approval', async (event, raw) => {
        try {
            validateSender(event);
            if (computerExecutionService.isAborted()) throw new Error('Computer control was aborted (kill switch active).');
            const input = AuthorizeRequest.parse(raw);
            const data = await authorizationService.authorize({ ...input, rendererId: rendererId(event), confirm: scope => confirmNativeApproval(event, scope) });
            log.info('Computer approval authorized', { approvalId: input.approvalId, rendererId: rendererId(event), expiresAt: data.expiresAt });
            return { success: true, data };
        } catch (error) { return failure('Computer authorization failed', error); }
    });
    ipcMain.handle('computer:begin-drive', async (event, raw) => {
        try {
            validateSender(event);
            if (computerExecutionService.isAborted()) throw new Error('Computer control was aborted (kill switch active).');
            const input = DriveStart.parse(raw);
            return { success: true, data: authorizationService.beginDrive({ token: input.authorization.token, rendererId: rendererId(event), rendererSessionId: input.authorization.rendererSessionId, agentId: input.authorization.agentId, args: { goal: input.goal, maxSteps: input.maxSteps } }) };
        } catch (error) { return failure('Computer drive authorization failed', error); }
    });
    ipcMain.handle('computer:end-drive', async (event, raw) => {
        try { validateSender(event); const token = z.object({ sessionToken: Token }).strict().parse(raw).sessionToken; authorizationService.revoke(token); return { success: true }; }
        catch (error) { return failure('Computer drive revoke failed', error); }
    });
    ipcMain.handle('computer:screenshot', async (event, raw) => {
        try {
            validateSender(event);
            const input = z.object({ displayId: z.number().int().nonnegative().optional(), authorization: Authorization, driveSessionToken: Token.optional() }).strict().parse(raw);
            const args = ComputerScreenshotSchema.parse({ displayId: input.displayId }) ?? {};
            authorizeAction(event, input, 'computer_screenshot', 'screenshot', args);
            return { success: true, data: await computerExecutionService.screenshot(args.displayId) };
        } catch (error) { return failure('Computer screenshot failed', error); }
    });
    ipcMain.handle('computer:list-apps', async event => {
        try { validateSender(event); return { success: true, data: { apps: await computerExecutionService.listApps() } }; }
        catch (error) { return failure('Computer list apps failed', error); }
    });
    ipcMain.handle('computer:open-app', async (event, raw) => {
        try {
            validateSender(event);
            const input = z.object({ app: z.unknown(), authorization: Authorization }).strict().parse(raw);
            const app = ComputerOpenAppSchema.parse(input.app);
            authorizeAction(event, input, 'computer_open_app', 'open_app', { app });
            await computerExecutionService.openApp(app);
            return { success: true, data: { app } };
        } catch (error) { return failure('Computer open app failed', error); }
    });
    const inputHandler = (channel: string, toolName: string, action: 'click' | 'key' | 'scroll') => ipcMain.handle(channel, async (event, raw) => {
        try {
            validateSender(event);
            if (computerExecutionService.isAborted()) throw new Error('Computer control was aborted (kill switch active).');
            const input = z.object({ authorization: Authorization, driveSessionToken: Token.optional() }).passthrough().parse(raw);
            if (action === 'click') {
                const a = ComputerClickSchema.parse(input); authorizeAction(event, input, toolName, action, { x: a.x, y: a.y, button: a.button });
                await computerExecutionService.click(a.x, a.y, a.button); return { success: true, data: { x: a.x, y: a.y, button: a.button } };
            }
            if (action === 'key') {
                const a = ComputerKeySchema.parse(input); authorizeAction(event, input, toolName, action, { combo: a.combo });
                await computerExecutionService.key(a.combo); return { success: true, data: { combo: a.combo } };
            }
            const a = ComputerScrollSchema.parse(input); authorizeAction(event, input, toolName, action, { dx: a.dx, dy: a.dy });
            await computerExecutionService.scroll(a.dx, a.dy); return { success: true, data: { dx: a.dx, dy: a.dy } };
        } catch (error) { return failure(`Computer ${action} failed`, error); }
    });
    inputHandler('computer:click', 'computer_click', 'click');
    inputHandler('computer:key', 'computer_key', 'key');
    inputHandler('computer:scroll', 'computer_scroll', 'scroll');
    ipcMain.handle('computer:type', async event => {
        try { validateSender(event); throw new Error('Text injection is disabled because the OS provider cannot reliably identify password or payment fields.'); }
        catch (error) { return failure('Computer type denied', error); }
    });
    ipcMain.handle('computer:abort', async event => {
        try { validateSender(event); computerExecutionService.abort(); authorizationService.revokeAllDriveSessions(); return { success: true, data: { aborted: true } }; }
        catch (error) { return failure('Computer abort failed', error); }
    });
    ipcMain.handle('computer:get-abort-state', async event => {
        try { validateSender(event); return { success: true, data: { aborted: computerExecutionService.isAborted() } }; }
        catch (error) { return failure('Computer abort state failed', error); }
    });
    ipcMain.handle('computer:allowlist-get', async event => {
        try { validateSender(event); return { success: true, data: { apps: computerAllowlistStore.getAll() } }; }
        catch (error) { return failure('Computer allowlist read failed', error); }
    });
    // No renderer-accessible reset, allowlist mutation, or broad grant endpoints: fail closed.
}
