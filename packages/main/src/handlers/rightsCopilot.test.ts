import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    rightsCopilotController,
    PORTAL_ALLOWED_DOMAINS,
    PORTAL_DEFAULT_URLS,
} from './rightsCopilot';
import type { PortalTarget } from '@indii/shared';

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

describe('RightsCopilotController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
