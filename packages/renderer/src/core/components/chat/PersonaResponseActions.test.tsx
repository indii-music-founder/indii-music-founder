import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONA_FADER_DEFAULT } from '@indii/shared';

const recordSignalWithResult = vi.hoisted(() => vi.fn().mockResolvedValue('recorded'));
const warn = vi.hoisted(() => vi.fn());

vi.mock('@/services/persona/PersonaInteractionRecorder', () => ({ recordSignalWithResult }));
vi.mock('@/utils/logger', () => ({ logger: { warn } }));

import { PersonaResponseActions } from './PersonaResponseActions';

describe('PersonaResponseActions', () => {
    beforeEach(() => {
        recordSignalWithResult.mockReset().mockResolvedValue('recorded');
        warn.mockReset();
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: vi.fn().mockReturnValue(false),
        });
    });

    it('copies the served response and records a response-correlated implicit signal', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        render(
            <PersonaResponseActions
                text="Served treatment response"
                metadata={{
                    personaResponse: {
                        personaId: 'manager',
                        responseId: 'response-copy',
                        isControlGroup: false,
                        effectiveFaderValues: PERSONA_FADER_DEFAULT,
                        measurementStatus: 'recorded',
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('Served treatment response'));
        await waitFor(() => expect(recordSignalWithResult).toHaveBeenCalledWith('manager', 'response-copy', 'copied'));
        expect(screen.getByRole('button', { name: 'Response copied' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Feedback saved');
    });

    it('records feedback even when clipboard access fails', async () => {
        const writeText = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: vi.fn().mockReturnValue(true),
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        render(
            <PersonaResponseActions
                text="Displayed response"
                metadata={{
                    personaResponse: {
                        personaId: 'manager',
                        responseId: 'response-clipboard-denied',
                        isControlGroup: true,
                        effectiveFaderValues: PERSONA_FADER_DEFAULT,
                        measurementStatus: 'recorded',
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));

        await waitFor(() =>
            expect(recordSignalWithResult).toHaveBeenCalledWith(
                'manager',
                'response-clipboard-denied',
                'copied',
            ),
        );
        expect(screen.getByRole('button', { name: 'Response copied' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Feedback saved');
    });

    it('records feedback even when the clipboard API is unavailable', async () => {
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: vi.fn().mockReturnValue(true),
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: undefined,
        });

        render(
            <PersonaResponseActions
                text="Displayed response"
                metadata={{
                    personaResponse: {
                        personaId: 'manager',
                        responseId: 'response-no-clipboard',
                        isControlGroup: false,
                        effectiveFaderValues: PERSONA_FADER_DEFAULT,
                        measurementStatus: 'recorded',
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));

        await waitFor(() =>
            expect(recordSignalWithResult).toHaveBeenCalledWith('manager', 'response-no-clipboard', 'copied'),
        );
        expect(screen.getByRole('button', { name: 'Response copied' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Feedback saved');
    });

    it('does not record a copied signal when all clipboard methods fail', async () => {
        const writeText = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        render(
            <PersonaResponseActions
                text="Displayed response"
                metadata={{
                    personaResponse: {
                        personaId: 'manager',
                        responseId: 'response-copy-failed',
                        isControlGroup: false,
                        effectiveFaderValues: PERSONA_FADER_DEFAULT,
                        measurementStatus: 'recorded',
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Response copy failed' })).toBeInTheDocument());
        expect(recordSignalWithResult).not.toHaveBeenCalled();
        expect(screen.getByRole('status')).toHaveTextContent('Feedback not recorded');
    });

    it('does not report feedback as saved when the persistence write fails', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        recordSignalWithResult.mockRejectedValueOnce(new Error('Firestore unavailable'));
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        render(
            <PersonaResponseActions
                text="Displayed response"
                metadata={{
                    personaResponse: {
                        personaId: 'manager',
                        responseId: 'response-write-failed',
                        isControlGroup: false,
                        effectiveFaderValues: PERSONA_FADER_DEFAULT,
                        measurementStatus: 'recorded',
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Feedback not saved'));
        expect(screen.getByRole('button', { name: 'Response copied' })).toBeInTheDocument();
    });

    it('does not report feedback as saved when authentication has expired', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        recordSignalWithResult.mockResolvedValueOnce('skipped-unauthenticated');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        render(
            <PersonaResponseActions
                text="Displayed response"
                metadata={{
                    personaResponse: {
                        personaId: 'manager',
                        responseId: 'response-auth-expired',
                        isControlGroup: false,
                        effectiveFaderValues: PERSONA_FADER_DEFAULT,
                        measurementStatus: 'recorded',
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Copy response' }));

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sign in to save feedback'));
        expect(screen.getByRole('button', { name: 'Response copied' })).toBeInTheDocument();
    });

    it('does not render an instrumented action for malformed tracking metadata', () => {
        render(
            <PersonaResponseActions
                text="Untracked response"
                metadata={{ personaResponse: { personaId: 'manager' } }}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Copy response' })).not.toBeInTheDocument();
    });
});
