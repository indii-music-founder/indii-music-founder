import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    rightsCopilotController,
    PORTAL_ALLOWED_DOMAINS,
    PORTAL_DEFAULT_URLS,
} from './rightsCopilot';
import type { CopilotAction, PortalTarget } from '@indii/shared';

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('electron', () => ({
    BrowserWindow: class BrowserWindow {},
    ipcMain: { handle: vi.fn() },
    shell: { openExternal: vi.fn() },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

describe('RightsCopilotController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        (rightsCopilotController as unknown as { activeSession: unknown }).activeSession = null;
    });

    describe('isUrlAllowedForPortal (Security Gate)', () => {
        it('allows official US Copyright Office eCO URLs', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://eco.copyright.gov/eService_enu/',
                    'loc_copyright'
                )
            ).toBe(true);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://copyright.gov/registration/',
                    'loc_copyright'
                )
            ).toBe(true);
        });

        it('rejects phishing or cross-domain URLs for loc_copyright', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://evil-copyright.gov.attacker.com',
                    'loc_copyright'
                )
            ).toBe(false);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://portal.themlc.com',
                    'loc_copyright'
                )
            ).toBe(false);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'http://insecure-http.com',
                    'loc_copyright'
                )
            ).toBe(false);
        });

        it('allows official The MLC portal URLs', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://portal.themlc.com/catalog',
                    'the_mlc'
                )
            ).toBe(true);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://themlc.com/membership',
                    'the_mlc'
                )
            ).toBe(true);
        });

        it('allows official BMI portal URLs', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://online.bmi.com/works',
                    'bmi'
                )
            ).toBe(true);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://bmi.com/creators',
                    'bmi'
                )
            ).toBe(true);
        });

        it('allows official ASCAP member URLs', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://members.ascap.com/my-catalog',
                    'ascap'
                )
            ).toBe(true);
        });

        it('allows official SoundExchange portal URLs', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://sportal.soundexchange.com/',
                    'soundexchange'
                )
            ).toBe(true);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://licensee.soundexchange.com/',
                    'soundexchange'
                )
            ).toBe(true);
        });

        it('allows official Harry Fox Agency URLs', () => {
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://www.harryfox.com/portal',
                    'hfa'
                )
            ).toBe(true);
            expect(
                rightsCopilotController.isUrlAllowedForPortal(
                    'https://songfile.com/license',
                    'hfa'
                )
            ).toBe(true);
        });

        it('rejects malformed URLs gracefully without throwing', () => {
            expect(rightsCopilotController.isUrlAllowedForPortal('not-a-url', 'bmi')).toBe(false);
            expect(rightsCopilotController.isUrlAllowedForPortal('', 'the_mlc')).toBe(false);
        });
    });

    describe('Default Portals Registry', () => {
        const portals: PortalTarget[] = ['loc_copyright', 'the_mlc', 'bmi', 'ascap', 'soundexchange', 'hfa'];

        it('defines canonical official default URLs for all 6 target portals', () => {
            for (const portal of portals) {
                expect(PORTAL_DEFAULT_URLS[portal]).toBeDefined();
                expect(PORTAL_DEFAULT_URLS[portal]).toMatch(/^https:\/\//);
                expect(rightsCopilotController.isUrlAllowedForPortal(PORTAL_DEFAULT_URLS[portal], portal)).toBe(true);
            }
        });

        it('defines allowed domain patterns for all portals', () => {
            for (const portal of portals) {
                expect(PORTAL_ALLOWED_DOMAINS[portal].length).toBeGreaterThan(0);
            }
        });
    });

    describe('Session Management', () => {
        it('reports isActive: false when no session has been launched', () => {
            const status = rightsCopilotController.getSessionStatus();
            expect(status.isActive).toBe(false);
        });

        it('closes cleanly without error even when no session is active', () => {
            const result = rightsCopilotController.closeSession();
            expect(result.success).toBe(true);
        });
    });

    describe('isSafeCopilotSelector (Credential Isolation Gate)', () => {
        it('allows legitimate metadata and confirmation selectors', () => {
            expect(rightsCopilotController.isSafeCopilotSelector('input#workTitle')).toBe(true);
            expect(rightsCopilotController.isSafeCopilotSelector('select#typeOfWork')).toBe(true);
            expect(rightsCopilotController.isSafeCopilotSelector('.confirmation-number, #serviceRequestNumber')).toBe(true);
            expect(rightsCopilotController.isSafeCopilotSelector('input#mlcWorkTitle')).toBe(true);
        });

        it('rejects password, 2FA, CAPTCHA, SSN, and payment card selectors', () => {
            expect(rightsCopilotController.isSafeCopilotSelector('input#userPassword')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('#totpCode')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('#captchaResponse')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('input#ssn')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('input#creditCardNumber')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('input#cvv')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('input#routingNumber')).toBe(false);
        });

        it('rejects selectors containing script injection characters or empty strings', () => {
            expect(rightsCopilotController.isSafeCopilotSelector('')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('   ')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('input#workTitle"; alert(1);//')).toBe(false);
            expect(rightsCopilotController.isSafeCopilotSelector('<script>alert(1)</script>')).toBe(false);
        });
    });

    describe('buildCopilotOverlayScript (Interactive HUD)', () => {
        it('embeds work metadata, truncated SHA-256 deposit checksum, and privacy notice safely', () => {
            const script = rightsCopilotController.buildCopilotOverlayScript({
                portalTarget: 'loc_copyright',
                workTitle: 'Midnight Sun',
                artistLegalName: 'Jane Doe',
                isrc: 'USIND2600001',
                depositFilename: 'midnight_sun.wav',
                depositChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                stepDescription: 'Populate Title of Work: "Midnight Sun"',
                status: 'filling_fields',
            });

            expect(script).toContain('indii-rights-copilot-hud');
            expect(script).toContain('LOC COPYRIGHT');
            expect(script).toContain('Midnight Sun');
            expect(script).toContain('Jane Doe');
            expect(script).toContain('USIND2600001');
            expect(script).toContain('midnight_sun.wav');
            expect(script).toContain('e3b0c44298fc...');
            expect(script).toContain('Zero-Credential Isolation');
        });
    });

    describe('executeActionStep', () => {
        const activeStep = (action: CopilotAction, outcomes: unknown[]) => {
            const executeJavaScript = vi.fn();
            for (const outcome of outcomes) executeJavaScript.mockResolvedValueOnce(outcome);
            const sender = { id: 17, isDestroyed: () => false, send: vi.fn() };
            (rightsCopilotController as unknown as { activeSession: unknown }).activeSession = {
                sessionId: 'session-1', senderId: 17, portalTarget: 'loc_copyright',
                status: 'idle', awaitingUser: false, actions: [action],
                overlayContext: { portalTarget: 'loc_copyright' },
                window: { isDestroyed: () => false, webContents: { executeJavaScript } },
            };
            return { executeJavaScript, sender, input: { sessionId: 'session-1', action } };
        };

        it('rejects a missing portal field instead of reporting a completed step', async () => {
            const action: CopilotAction = { id: 'title', type: 'autofill_input', description: 'Title', targetSelector: '#workTitle', value: 'Midnight Sun', requiresUserAction: false };
            const { sender, input } = activeStep(action, [undefined, { found: false }]);
            await expect(rightsCopilotController.executeActionStep({ sender } as never, input)).rejects.toThrow('Metadata field was not verified');
        });

        it('rejects a portal option that did not retain the reviewed value', async () => {
            const action: CopilotAction = { id: 'form', type: 'select_option', description: 'Form', targetSelector: '#formType', value: 'Form_SR', requiresUserAction: false };
            const { sender, input } = activeStep(action, [undefined, { found: true, currentValue: 'Form_PA' }]);
            await expect(rightsCopilotController.executeActionStep({ sender } as never, input)).rejects.toThrow('Field value does not match');
        });

        it('uses the native value setter for controlled portal inputs', async () => {
            const action: CopilotAction = { id: 'title', type: 'autofill_input', description: 'Title', targetSelector: '#workTitle', value: 'Midnight Sun', requiresUserAction: false };
            const { executeJavaScript, sender, input } = activeStep(action, [undefined, { found: true, currentValue: 'Midnight Sun' }]);
            await expect(rightsCopilotController.executeActionStep({ sender } as never, input)).resolves.toMatchObject({ success: true });
            expect(executeJavaScript.mock.calls[1][0]).toContain("Object.getOwnPropertyDescriptor(prototype, 'value')?.set");
        });

        it('requires a user to attach the deposit instead of claiming an upload', async () => {
            const action: CopilotAction = { id: 'deposit', type: 'stage_deposit_upload', description: 'Attach deposit', value: 'master.wav', requiresUserAction: true };
            const { sender, input } = activeStep(action, [undefined]);
            await expect(rightsCopilotController.executeActionStep({ sender } as never, input)).resolves.toMatchObject({ success: false, requiresUserAction: true });
        });
        it('fails closed immediately if a step targets a sensitive credential or payment selector', async () => {
            await expect(
                rightsCopilotController.executeActionStep(null, {
                    action: {
                        id: 'bad-step',
                        type: 'autofill_input',
                        description: 'Attempt to touch password',
                        targetSelector: 'input#userPassword',
                        value: 'secret',
                        requiresUserAction: false,
                    },
                })
            ).rejects.toThrow('Refusing to interact with credential, authentication, or payment selector');
        });

        it('fails closed when no active browser session is running', async () => {
            await expect(
                rightsCopilotController.executeActionStep(null, {
                    action: {
                        id: 'loc-3',
                        type: 'autofill_input',
                        description: 'Populate Title of Work',
                        targetSelector: 'input#workTitle',
                        value: 'Midnight Sun',
                        requiresUserAction: false,
                    },
                })
            ).rejects.toThrow('No active Rights Copilot browser session');
        });
    });
});

