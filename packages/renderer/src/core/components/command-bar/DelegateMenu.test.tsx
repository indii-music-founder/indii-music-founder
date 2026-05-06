import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { DelegateMenu } from './DelegateMenu';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(
            (
                { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
                ref: React.Ref<HTMLDivElement>
            ) => {
                const domProps = filterDomProps(props);
                return <div ref={ref} {...domProps}>{children}</div>;
            }
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap'];
    return Object.fromEntries(Object.entries(props).filter(([k]) => !invalid.includes(k)));
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const MANAGER_AGENTS = [
    { id: 'manager-1', name: 'Tour Manager', color: 'bg-amber-500', description: 'Handles touring logistics' },
    { id: 'manager-2', name: 'Business Manager', color: 'bg-blue-500', description: 'Handles business affairs' },
];

const DEPARTMENT_AGENTS = [
    { id: 'dept-legal', name: 'Legal', color: 'bg-red-500', description: 'Legal and contracts' },
    { id: 'dept-marketing', name: 'Marketing', color: 'bg-green-500', description: 'Promo and marketing' },
];

function renderMenu(overrides: {
    isOpen?: boolean;
    isIndiiMode?: boolean;
    onSelect?: (id: string) => void;
    onSelectIndii?: () => void;
    onClose?: () => void;
} = {}) {
    const defaults = {
        isOpen: true,
        currentModule: 'creative',
        isIndiiMode: false,
        managerAgents: MANAGER_AGENTS,
        departmentAgents: DEPARTMENT_AGENTS,
        onSelect: vi.fn(),
        onSelectIndii: vi.fn(),
        onClose: vi.fn(),
    };
    const props = { ...defaults, ...overrides };
    return { ...render(<DelegateMenu {...props} />), ...props };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DelegateMenu — Keyboard Shortcuts & Navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Visibility ---

    it('renders the menu when isOpen is true', () => {
        renderMenu({ isOpen: true });
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('does NOT render the menu when isOpen is false', () => {
        renderMenu({ isOpen: false });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // --- Content Rendering ---

    it('renders the indii orchestrator button', () => {
        renderMenu();
        expect(screen.getByText('indii')).toBeInTheDocument();
        expect(screen.getByText('Orchestrator')).toBeInTheDocument();
    });

    it('renders Manager\'s Office section', () => {
        renderMenu();
        expect(screen.getByText("Manager's Office")).toBeInTheDocument();
    });

    it('renders Departments section', () => {
        renderMenu();
        expect(screen.getByText('Departments')).toBeInTheDocument();
    });

    it('renders all manager agents', () => {
        renderMenu();
        MANAGER_AGENTS.forEach(agent => {
            expect(screen.getByText(agent.name)).toBeInTheDocument();
        });
    });

    it('renders all department agents', () => {
        renderMenu();
        DEPARTMENT_AGENTS.forEach(dept => {
            expect(screen.getByText(dept.name)).toBeInTheDocument();
        });
    });

    // --- Agent Selection ---

    it('calls onSelect with the agent ID when a manager agent is clicked', () => {
        const onSelect = vi.fn();
        renderMenu({ onSelect });
        fireEvent.click(screen.getByText('Tour Manager'));
        expect(onSelect).toHaveBeenCalledWith('manager-1');
    });

    it('calls onSelect with the agent ID when a department agent is clicked', () => {
        const onSelect = vi.fn();
        renderMenu({ onSelect });
        fireEvent.click(screen.getByText('Legal'));
        expect(onSelect).toHaveBeenCalledWith('dept-legal');
    });

    it('calls onSelectIndii when the indii button is clicked', () => {
        const onSelectIndii = vi.fn();
        renderMenu({ onSelectIndii });
        // The indii button text is "indii"
        fireEvent.click(screen.getByText('indii').closest('button')!);
        expect(onSelectIndii).toHaveBeenCalledOnce();
    });

    // --- Backdrop Close ---

    it('calls onClose when the backdrop is clicked', () => {
        const onClose = vi.fn();
        renderMenu({ onClose });
        // The backdrop is a fixed full-screen div with aria-hidden
        const backdrop = document.querySelector('[aria-hidden="true"]');
        expect(backdrop).toBeInTheDocument();
        fireEvent.click(backdrop!);
        expect(onClose).toHaveBeenCalledOnce();
    });

    // --- Keyboard: Escape ---

    it('calls onClose when Escape key is pressed (keyboard shortcut)', () => {
        const onClose = vi.fn();
        renderMenu({ isOpen: true, onClose });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('does NOT call onClose when other keys are pressed', () => {
        const onClose = vi.fn();
        renderMenu({ isOpen: true, onClose });
        fireEvent.keyDown(document, { key: 'Enter' });
        fireEvent.keyDown(document, { key: 'Tab' });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT add keydown listener when menu is closed', () => {
        const onClose = vi.fn();
        renderMenu({ isOpen: false, onClose });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('removes keydown listener when menu closes', () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <DelegateMenu
                isOpen={true}
                currentModule="creative"
                managerAgents={MANAGER_AGENTS}
                departmentAgents={DEPARTMENT_AGENTS}
                onSelect={vi.fn()}
                onSelectIndii={vi.fn()}
                onClose={onClose}
            />
        );

        // Close the menu
        rerender(
            <DelegateMenu
                isOpen={false}
                currentModule="creative"
                managerAgents={MANAGER_AGENTS}
                departmentAgents={DEPARTMENT_AGENTS}
                onSelect={vi.fn()}
                onSelectIndii={vi.fn()}
                onClose={onClose}
            />
        );

        // Now pressing Escape should NOT fire onClose (listener removed)
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    // --- Indii Mode Active State ---

    it('shows indii button with active styling when isIndiiMode is true', () => {
        renderMenu({ isIndiiMode: true });
        const indiiBtn = screen.getByText('indii').closest('button');
        expect(indiiBtn).toHaveClass('bg-purple-600/20');
        expect(indiiBtn).toHaveClass('text-purple-200');
    });

    it('shows indii button with inactive styling when isIndiiMode is false', () => {
        renderMenu({ isIndiiMode: false });
        const indiiBtn = screen.getByText('indii').closest('button');
        expect(indiiBtn).not.toHaveClass('bg-purple-600/20');
        expect(indiiBtn).toHaveClass('text-gray-400');
    });

    // --- Accessibility ---

    it('menu has role="menu" attribute', () => {
        renderMenu();
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('menu has an accessible label', () => {
        renderMenu();
        expect(screen.getByRole('menu')).toHaveAttribute('aria-label', 'Delegate to agent');
    });

    it('agent buttons have role="menuitem"', () => {
        renderMenu();
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThan(0);
    });

    it('manager group has an accessible label', () => {
        renderMenu();
        expect(screen.getByRole('group', { name: "Manager's Office" })).toBeInTheDocument();
    });

    it('departments group has an accessible label', () => {
        renderMenu();
        expect(screen.getByRole('group', { name: 'Departments' })).toBeInTheDocument();
    });
});
