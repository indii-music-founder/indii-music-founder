import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

it('opens disabled-action help on focus and dismisses it with Escape', async () => {
    render(
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div tabIndex={0} aria-label="Optimization help">
                        <button disabled>Optimize</button>
                    </div>
                </TooltipTrigger>
                <TooltipContent>Add at least two cities.</TooltipContent>
            </Tooltip>
        </TooltipProvider>,
    );
    const trigger = screen.getByLabelText('Optimization help');
    fireEvent.focus(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Add at least two cities.');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
});
