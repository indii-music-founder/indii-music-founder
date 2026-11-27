import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MerchStudio from '@/modules/merchandise/MerchStudio';

vi.mock('@/modules/merchandise/MerchDashboard', () => ({ default: () => <h1>Merchandise dashboard</h1> }));
vi.mock('@/modules/merchandise/MerchDesigner', () => ({ default: () => <h1>Merchandise designer</h1> }));

function NavigationFixture({ destination }: { destination: string }) {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    return (
        <>
            <button type="button" onClick={() => navigate(destination)}>Leave Merchandise</button>
            <div role="status">{pathname}{search}</div>
            <MerchStudio />
        </>
    );
}

describe('MerchStudio routing', () => {
    it.each(['/dashboard', '/project-canvas?view=files'])('preserves a transition to %s while Merchandise is still mounted', async (destination) => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/merch']}>
                <NavigationFixture destination={destination} />
            </MemoryRouter>,
        );
        expect(screen.getByRole('heading', { name: 'Merchandise dashboard' })).toBeVisible();

        await user.click(screen.getByRole('button', { name: 'Leave Merchandise' }));

        expect(screen.getByRole('status')).toHaveTextContent(destination);
        expect(screen.queryByRole('heading', { name: 'Merchandise dashboard' })).not.toBeInTheDocument();
    });

    it('still redirects an unknown Merchandise subpath to the dashboard', () => {
        render(
            <MemoryRouter initialEntries={['/merch/unknown']}>
                <NavigationFixture destination="/" />
            </MemoryRouter>,
        );

        expect(screen.getByRole('status')).toHaveTextContent(/^\/merch$/);
        expect(screen.getByRole('heading', { name: 'Merchandise dashboard' })).toBeVisible();
    });

    it('renders the designer at its direct URL', () => {
        render(
            <MemoryRouter initialEntries={['/merch/design']}>
                <NavigationFixture destination="/" />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Merchandise designer' })).toBeVisible();
    });
});
