import { render } from '@testing-library/react';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { vi } from 'vitest';

// Mock motion/react for tests
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('WorkspaceCanvas', () => {
    it('renders empty state when no items provided', () => {
        const { getByText } = render(<WorkspaceCanvas items={[]} />);
        expect(getByText('Canvas ready')).toBeTruthy();
    });

    it('renders an image card when an image item is provided', () => {
        const items = [
            {
                id: 'test-1',
                type: 'image' as const,
                title: 'Test Image',
                createdAt: Date.now(),
                imageUrl: 'https://example.com/image.png',
                imagePrompt: 'A beautiful landscape',
            },
        ];
        const { getByText } = render(<WorkspaceCanvas items={items} />);
        expect(getByText('Test Image')).toBeTruthy();
    });

    it('renders a loading card with custom label', () => {
        const items = [
            {
                id: 'loading-1',
                type: 'loading' as const,
                title: 'Generating artwork',
                createdAt: Date.now(),
                loadingLabel: 'Creating your image…',
            },
        ];
        const { getByText } = render(<WorkspaceCanvas items={items} />);
        expect(getByText('Creating your image…')).toBeTruthy();
    });

    it('calls onDismiss when remove button is clicked', async () => {
        const onDismiss = vi.fn();
        const items = [
            {
                id: 'doc-1',
                type: 'document' as const,
                title: 'Brand Report',
                createdAt: Date.now(),
                content: 'This is brand report content.',
            },
        ];
        const { getByTitle } = render(<WorkspaceCanvas items={items} onDismiss={onDismiss} />);
        // Remove button should exist (visible on hover — rendered in DOM regardless)
        const removeBtn = getByTitle('Remove');
        removeBtn.click();
        expect(onDismiss).toHaveBeenCalledWith('doc-1');
    });
});
