import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildContractHTML, MicroLicensingPortal, type LeaseForm } from './MicroLicensingPortal';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ error: vi.fn() }),
}));

const form: LeaseForm = {
    trackTitle: '<img src=x onerror=alert(1)>',
    isrc: '<script>alert(1)</script>',
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

    it('offers a draft but keeps checkout disabled until agreement infrastructure exists', () => {
        render(<MicroLicensingPortal />);

        fireEvent.change(screen.getByPlaceholderText('e.g. Midnight Blaze'), {
            target: { value: 'Midnight Blaze' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Generate Draft' }));

        expect(screen.getByText('Contract Draft Preview')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Checkout Setup Required' })).toBeDisabled();
        expect(screen.getByText(/versioned agreement/i)).toBeInTheDocument();
    });
});
