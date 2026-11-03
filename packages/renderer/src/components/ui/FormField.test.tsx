import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';

describe('FormField relationships', () => {
    it('keeps a child description and invalid state while adding hint and error', () => {
        render(
            <>
                <p id="existing-description">Existing description</p>
                <FormField label="Email" hint="Use your artist email" error="Email is required">
                    <input id="artist-email" aria-describedby="existing-description" aria-invalid="true" />
                </FormField>
            </>,
        );

        const input = screen.getByRole('textbox', { name: 'Email' });
        expect(input).toHaveAttribute('id', 'artist-email');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute(
            'aria-describedby',
            'existing-description artist-email-hint artist-email-error',
        );
        expect(screen.getByText('Email is required')).toHaveAttribute('id', 'artist-email-error');
    });

    it('preserves an existing invalid state when no wrapper error is present', () => {
        render(<FormField label="Artist name"><input aria-invalid="true" /></FormField>);
        expect(screen.getByRole('textbox', { name: 'Artist name' })).toHaveAttribute('aria-invalid', 'true');
    });
});
