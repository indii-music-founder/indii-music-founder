import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RightsRegistrationWalkthroughModal, RIGHTS_GUIDES } from './RightsRegistrationWalkthroughModal';

describe('RightsRegistrationWalkthroughModal', () => {
    const mockOnClose = vi.fn();
    const mockOnUpdate = vi.fn();
    const defaultData = {
        pro_affiliation: { completed: false, value: '', provenance: 'user_reported' as const },
        mlc_membership: { completed: false, value: '', provenance: 'user_reported' as const },
        usco_org: { completed: false, value: '', provenance: 'user_reported' as const },
        soundexchange: { completed: false, value: '', provenance: 'user_reported' as const },
    };

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <RightsRegistrationWalkthroughModal
                isOpen={false}
                onClose={mockOnClose}
                readinessData={defaultData}
                onUpdatePrerequisite={mockOnUpdate}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders U.S. Copyright Office (Library of Congress) guide when opened with usco_org', () => {
        render(
            <RightsRegistrationWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPrerequisite="usco_org"
                readinessData={defaultData}
                onUpdatePrerequisite={mockOnUpdate}
            />
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Rights & Royalty Copilot')).toBeInTheDocument();
        expect(screen.getByText('U.S. Copyright Office eCO Registration')).toBeInTheDocument();
        expect(screen.getByText('Establish eCO Electronic Organization Account')).toBeInTheDocument();
        expect(screen.getAllByText(/Library of Congress/i).length).toBeGreaterThan(0);
    });

    it('renders The MLC guide when mlc tab is clicked', () => {
        render(
            <RightsRegistrationWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPrerequisite="pro_affiliation"
                readinessData={defaultData}
                onUpdatePrerequisite={mockOnUpdate}
            />
        );

        const mlcTab = screen.getByRole('button', { name: /The MLC/i });
        fireEvent.click(mlcTab);

        expect(screen.getByText('The Mechanical Licensing Collective')).toBeInTheDocument();
        expect(screen.getByText('Create Member Profile on The MLC Portal')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. MLC-1029384')).toBeInTheDocument();
    });

    it('renders PRO (BMI / ASCAP / SESAC) guide and toggles steps', () => {
        render(
            <RightsRegistrationWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPrerequisite="pro_affiliation"
                readinessData={defaultData}
                onUpdatePrerequisite={mockOnUpdate}
            />
        );

        expect(screen.getByText('PRO Writer & Publisher Affiliation')).toBeInTheDocument();
        expect(screen.getByText('Select Your PRO & Apply as Songwriter')).toBeInTheDocument();

        const step1Btn = screen.getByLabelText('Mark step 1 as complete');
        fireEvent.click(step1Btn);
        expect(screen.getByLabelText('Mark step 1 as incomplete')).toBeInTheDocument();
    });

    // Structural-only: the callback below is a test double, not provider verification.
    it('allows entering an identifier and saving self-reported completion', () => {
        render(
            <RightsRegistrationWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPrerequisite="pro_affiliation"
                readinessData={defaultData}
                onUpdatePrerequisite={mockOnUpdate}
            />
        );

        const input = screen.getByLabelText('Authoritative Writer / Publisher IPI Number');
        fireEvent.change(input, { target: { value: '00987654321' } });

        const saveBtn = screen.getByRole('button', { name: /Save as Completed/i });
        fireEvent.click(saveBtn);

        expect(mockOnUpdate).toHaveBeenCalledWith('pro_affiliation', '00987654321', true);
    });

    it('closes when close button is clicked', () => {
        render(
            <RightsRegistrationWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPrerequisite="soundexchange"
                readinessData={defaultData}
                onUpdatePrerequisite={mockOnUpdate}
            />
        );

        const closeBtn = screen.getByLabelText('Close walkthrough guide');
        fireEvent.click(closeBtn);

        expect(mockOnClose).toHaveBeenCalled();
    });
});
