import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildContractHTML, MicroLicensingPortal, type LeaseForm } from './MicroLicensingPortal';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ error: vi.fn() }),
}));

const form: LeaseForm = {
    trackTitle: '<img src=x onerror=alert(1)>',
    isrc: '<script>alert(1)</script>',
    licensorLegalName: 'Nia Rook Music LLC',
    licenseeLegalName: 'Example Licensee LLC',
    masterOwner: 'Nia Rook Music LLC',
    compositionOwner: 'Nia Rook Music LLC',
    producerPublishingShare: '25',
    governingJurisdiction: 'Michigan, USA',
    rightsEvidenceReference: 'Signed split sheet dated 2026-08-14',
    rightsAttested: true,
    leaseType: 'non-exclusive',
    territory: 'Worldwide',
    term: '1yr',
    price: '100',
    syncRights: true,
    masterRights: false,
    performanceRights: true,
    streamingRights: true,
};

describe('MicroLicensingPortal', () => {
    it('escapes user-supplied contract fields in downloaded HTML', () => {
        const html = buildContractHTML(form);

        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('rejects incomplete terms instead of inventing parties, ownership, rights, or splits', () => {
        const incomplete = {
            ...form,
            licensorLegalName: '',
            rightsAttested: false,
            syncRights: false,
            performanceRights: false,
            streamingRights: false,
        };

        expect(() => buildContractHTML(incomplete)).toThrow(/requires complete parties/i);
    });

    it('keeps generation disabled when only title and price are provided', () => {
        render(<MicroLicensingPortal />);

        fireEvent.change(screen.getByPlaceholderText('e.g. Midnight Blaze'), {
            target: { value: 'Midnight Blaze' },
        });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '75' } });

        expect(screen.getByRole('button', { name: 'Generate Draft' })).toBeDisabled();
        expect(screen.queryByTitle('Rendered contract draft')).not.toBeInTheDocument();
    });

    it('renders a sandboxed draft from explicit facts and keeps checkout disabled', () => {
        render(<MicroLicensingPortal />);

        const values: Array<[string, string]> = [
            ['e.g. Midnight Blaze', 'Eight Mile Shift'],
            ['0.00', '75'],
            ['Legal name granting rights', 'Nia Rook Music LLC'],
            ['Legal name receiving rights', 'Example Licensee LLC'],
            ['Verified master owner', 'Nia Rook Music LLC'],
            ['Verified composition owner', 'Nia Rook Music LLC'],
            ['No inferred split', '25'],
            ['e.g. Michigan, USA', 'Michigan, USA'],
            ['Agreement, split sheet, registration, or source record', 'Signed split sheet dated 2026-08-14'],
        ];
        values.forEach(([placeholder, value]) => {
            fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
        });
        fireEvent.click(screen.getByRole('button', { name: 'Non-Exclusive' }));
        const [territory, term] = screen.getAllByRole('combobox');
        fireEvent.change(territory, { target: { value: 'Worldwide' } });
        fireEvent.change(term, { target: { value: '1yr' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Sync (Film/TV/Ads)' }));
        fireEvent.click(screen.getByRole('checkbox', { name: /I confirm the named parties/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Generate Draft' }));

        const preview = screen.getByTitle('Rendered contract draft');
        expect(preview).toHaveAttribute('sandbox', '');
        expect(preview).toHaveAttribute('srcdoc', expect.stringContaining('Nia Rook Music LLC'));
        expect(preview).toHaveAttribute('srcdoc', expect.not.stringContaining('retains 100% ownership'));
        expect(preview).toHaveAttribute('srcdoc', expect.not.stringContaining('binding arbitration'));
        expect(screen.getByRole('button', { name: 'Checkout Setup Required' })).toBeDisabled();
        expect(screen.getByText(/versioned agreement/i)).toBeInTheDocument();
    });
});
