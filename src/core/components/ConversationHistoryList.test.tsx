import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConversationHistoryList } from './ConversationHistoryList';
import { useStore } from '@/core/store';

expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('@/core/store');
vi.mock('motion/react', () => ({
    motion: {
        li: ({ children, className, ...props }: any) => <li className={className} {...props}>{children}</li>,
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
}));

describe('ConversationHistoryList', () => {
    const mockDeleteSession = vi.fn();
    const mockSetActiveSession = vi.fn();
    const mockOnClose = vi.fn();

    const mockSessions = {
        's1': {
            id: 's1',
            title: 'Session 1',
            updatedAt: 1000,
            messages: [{}, {}]
        },
        's2': {
            id: 's2',
            title: 'Session 2',
            updatedAt: 2000,
            messages: []
        }
    };

    const mockStoreState = {
        sessions: mockSessions,
        activeSessionId: 's1',
        setActiveSession: mockSetActiveSession,
        deleteSession: mockDeleteSession,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });
    });

    it('should have no accessibility violations', async () => {
        const { container } = render(<ConversationHistoryList onClose={mockOnClose} />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should have accessible list structure', () => {
        render(<ConversationHistoryList onClose={mockOnClose} />);

        const list = screen.getByRole('list');
        expect(list).toBeInTheDocument();
        expect(list).toHaveAttribute('aria-labelledby', 'history-title');

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
    });

    it('should have accessible close button', () => {
        render(<ConversationHistoryList onClose={mockOnClose} />);

        const closeBtn = screen.getByLabelText('Close history panel');
        expect(closeBtn).toBeInTheDocument();
        fireEvent.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have accessible delete buttons', () => {
        render(<ConversationHistoryList onClose={mockOnClose} />);

        const deleteBtns = screen.getAllByRole('button', { name: /Delete session:/ });
        expect(deleteBtns).toHaveLength(2);

        expect(deleteBtns[0]).toHaveAttribute('aria-label', 'Delete session: Session 2'); // Sorted by date desc
    });

    it('should indicate active session', () => {
        render(<ConversationHistoryList onClose={mockOnClose} />);

        // Find the main button for Session 1.
        // We filter out the delete button.
        const buttons = screen.getAllByRole('button');
        const activeBtn = buttons.find(b =>
            b.textContent?.includes('Session 1') &&
            !b.getAttribute('aria-label')?.includes('Delete')
        );

        expect(activeBtn).toBeInTheDocument();
        expect(activeBtn).toHaveAttribute('aria-current', 'true');

        const inactiveBtn = buttons.find(b =>
            b.textContent?.includes('Session 2') &&
            !b.getAttribute('aria-label')?.includes('Delete')
        );
        expect(inactiveBtn).not.toHaveAttribute('aria-current');
    });

    it('should be interactive', () => {
         render(<ConversationHistoryList onClose={mockOnClose} />);

         const buttons = screen.getAllByRole('button');
         const sessionBtn = buttons.find(b =>
             b.textContent?.includes('Session 2') &&
             !b.getAttribute('aria-label')?.includes('Delete')
         );

         fireEvent.click(sessionBtn!);
         expect(mockSetActiveSession).toHaveBeenCalledWith('s2');
    });
});
