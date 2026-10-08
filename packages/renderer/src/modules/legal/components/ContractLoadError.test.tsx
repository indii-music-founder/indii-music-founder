import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ContractLoadError } from './ContractLoadError';

// Presentation check only: no authenticated or persisted contract path is simulated.
describe('ContractLoadError', () => {
    it('distinguishes unavailable data from an empty list and offers retry', () => {
        let retries = 0;
        render(<ContractLoadError onRetry={() => { retries += 1; }} />);
        expect(screen.getByRole('alert').textContent).toContain('Unable to Load Contracts');
        expect(screen.queryByText('No Contracts Yet')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(retries).toBe(1);
    });
});
