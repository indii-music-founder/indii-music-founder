import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RightPanel from './RightPanel';
import { useStore } from '../store';

// Mock the store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

// Mock sub-components
vi.mock('./right-panel/CreativePanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="creative-panel">
            Creative Panel Content
            <button onClick={toggleRightPanel} data-testid="close-creative">Close</button>
        </div>
    ),
}));

describe('RightPanel', () => {
    const mockSetModule = vi.fn();
    const mockToggleRightPanel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Default store state
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'dashboard',
            setModule: mockSetModule,
            isRightPanelOpen: false,
            toggleRightPanel: mockToggleRightPanel,
        });
    });

    it('renders collapsed state correctly', () => {
        render(<RightPanel />);

        // Should show expand button
        expect(screen.getByTitle('Expand Panel')).toBeInTheDocument();

        // Should show module shortcuts
        expect(screen.getByTitle('Image Studio')).toBeInTheDocument();

        // Should NOT show panels
        expect(screen.queryByTestId('creative-panel')).not.toBeInTheDocument();
    });

    it('toggles panel when expand button is clicked', () => {
        render(<RightPanel />);

        fireEvent.click(screen.getByTitle('Expand Panel'));
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('switches to Creative module when Image Studio icon is clicked', () => {
        render(<RightPanel />);

        fireEvent.click(screen.getByTitle('Image Studio'));
        expect(mockSetModule).toHaveBeenCalledWith('creative');
    });

    it('renders CreativePanel when open and module is creative', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'creative',
            setModule: mockSetModule,
            isRightPanelOpen: true,
            toggleRightPanel: mockToggleRightPanel,
        });

        render(<RightPanel />);

        expect(screen.getByTestId('creative-panel')).toBeInTheDocument();
        expect(screen.queryByTitle('Expand Panel')).not.toBeInTheDocument();
    });

    it('renders placeholder when open but no tool selected', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'dashboard',
            setModule: mockSetModule,
            isRightPanelOpen: true,
            toggleRightPanel: mockToggleRightPanel,
        });

        render(<RightPanel />);

        expect(screen.getByText('No Tool Selected')).toBeInTheDocument();
        expect(screen.getByText(/Select a tool from the sidebar/)).toBeInTheDocument();
    });
});
