import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PERSONA_FADER_DEFAULT } from '@indii/shared';

const recordSignal = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/services/persona/PersonaInteractionRecorder', () => ({ recordSignal }));

import { PersonaResponseActions } from './PersonaResponseActions';

describe('PersonaResponseActions', () => {
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
        await waitFor(() => expect(recordSignal).toHaveBeenCalledWith('manager', 'response-copy', 'copied'));
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
