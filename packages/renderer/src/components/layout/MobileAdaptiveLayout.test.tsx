import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileAdaptiveLayout, ResponsiveGrid } from './MobileAdaptiveLayout';

const useMobileMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useMobile', () => ({ useMobile: useMobileMock }));

function mobileState(deviceType: 'phone' | 'tablet' | 'desktop') {
    return {
        isPhone: deviceType === 'phone',
        isPhoneLg: false,
        isAnyPhone: deviceType === 'phone',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        isDesktopXl: false,
        deviceType,
        orientation: 'portrait',
        isKeyboardOpen: false,
        prefersReducedMotion: false,
        isTouchDevice: deviceType !== 'desktop',
        isStandalone: false,
    };
}

describe('MobileAdaptiveLayout', () => {
    beforeEach(() => useMobileMock.mockReturnValue(mobileState('phone')));

    it('applies hide flags only to their named device class', () => {
        const { rerender } = render(
            <MobileAdaptiveLayout hideOnTablet>Visible on phone</MobileAdaptiveLayout>,
        );
        expect(screen.getByText('Visible on phone')).toBeInTheDocument();

        useMobileMock.mockReturnValue(mobileState('tablet'));
        rerender(<MobileAdaptiveLayout hideOnTablet>Visible on phone</MobileAdaptiveLayout>);
        expect(screen.queryByText('Visible on phone')).not.toBeInTheDocument();
    });

    it('uses production-discoverable grid classes for each device', () => {
        const { container, rerender } = render(
            <ResponsiveGrid cols={{ phone: 2, tablet: 4, desktop: 6 }}>Grid</ResponsiveGrid>,
        );
        expect(container.firstChild).toHaveClass('grid-cols-2');

        useMobileMock.mockReturnValue(mobileState('tablet'));
        rerender(<ResponsiveGrid cols={{ phone: 2, tablet: 4, desktop: 6 }}>Grid</ResponsiveGrid>);
        expect(container.firstChild).toHaveClass('grid-cols-4');

        useMobileMock.mockReturnValue(mobileState('desktop'));
        rerender(<ResponsiveGrid cols={{ phone: 2, tablet: 4, desktop: 6 }}>Grid</ResponsiveGrid>);
        expect(container.firstChild).toHaveClass('grid-cols-6');
    });
});
