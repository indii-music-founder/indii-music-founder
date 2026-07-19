import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AdminLockScreen } from './AdminLockScreen';

describe('AdminLockScreen', () => {
    it('renders the dashboard content without a fake PIN gate', () => {
        render(
            <AdminLockScreen>
                <div>Dashboard Content</div>
            </AdminLockScreen>
        );

        expect(screen.getByText('Founder telemetry surface')).toBeInTheDocument();
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Enter PIN')).not.toBeInTheDocument();
    });
});
