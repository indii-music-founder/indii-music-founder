import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GlobalSettings from './GlobalSettings';

vi.mock('@/modules/settings/SettingsPanel', () => ({
    default: () => <div data-testid="settings-panel" />,
}));

describe('GlobalSettings', () => {
    it('renders the authoritative SettingsPanel surface', () => {
        render(<GlobalSettings />);
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    });
});
