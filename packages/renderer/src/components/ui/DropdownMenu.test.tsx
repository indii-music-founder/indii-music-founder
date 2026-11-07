import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    DropdownMenu,
    DropdownMenuTriggerButton,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from './DropdownMenu';

describe('DropdownMenu Component', () => {
    it('renders trigger button and opens content with submenus', async () => {
        const user = userEvent.setup();
        render(
            <DropdownMenu>
                <DropdownMenuTriggerButton data-testid="test-trigger">
                    Options
                </DropdownMenuTriggerButton>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Header</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => {}}>Action 1</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger data-testid="sub-trigger">
                            More Actions
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onSelect={() => {}}>Sub Action 1</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                </DropdownMenuContent>
            </DropdownMenu>
        );

        expect(screen.getByTestId('test-trigger')).toBeInTheDocument();
        await user.click(screen.getByTestId('test-trigger'));

        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByText('Action 1')).toBeInTheDocument();
        expect(screen.getByTestId('sub-trigger')).toBeInTheDocument();

        await user.hover(screen.getByTestId('sub-trigger'));
        expect(await screen.findByText('Sub Action 1')).toBeInTheDocument();
    });
});
