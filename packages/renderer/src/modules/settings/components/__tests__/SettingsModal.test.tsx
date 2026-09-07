import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../SettingsModal';

vi.mock('@/modules/settings/SettingsPanel', () => ({
    default: () => <div data-testid="mock-settings-panel">Settings Panel Content</div>,
}));

describe('SettingsModal', () => {
    it('does not render content when isOpen is false', () => {
        render(<SettingsModal isOpen={false} onClose={vi.fn()} />);
        expect(screen.queryByTestId('mock-settings-panel')).not.toBeInTheDocument();
    });

    it('renders SettingsPanel when isOpen is true', () => {
        render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByTestId('mock-settings-panel')).toBeInTheDocument();
        expect(screen.getByText('Settings Panel Content')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={onClose} />);

        const closeBtn = screen.getByRole('button', { name: /close settings/i });
        fireEvent.click(closeBtn);

        expect(onClose).toHaveBeenCalled();
    });
});
