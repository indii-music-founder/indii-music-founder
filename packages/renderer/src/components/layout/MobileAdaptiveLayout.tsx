import React from 'react';
import { useMobile } from '@/hooks/useMobile';
import { useResponsiveLayout } from '@/providers/ResponsiveLayoutProvider';
import { cn } from '@/lib/utils';

interface MobileAdaptiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  hideOnPhone?: boolean;
  hideOnTablet?: boolean;
  hideOnDesktop?: boolean;
  showOnlyOn?: 'phone' | 'tablet' | 'desktop';
}

/**
 * MobileAdaptiveLayout
 *
 * Wraps content with responsive constraints and visibility rules.
 * Automatically hides/shows content based on breakpoint.
 */
export const MobileAdaptiveLayout: React.FC<MobileAdaptiveLayoutProps> = ({
  children,
  className,
  hideOnPhone,
  hideOnTablet,
  hideOnDesktop,
  showOnlyOn,
}) => {
  const mobile = useMobile();
  const layout = useResponsiveLayout();

  // Determine visibility
  const isHidden =
    hideOnPhone ||
    hideOnTablet ||
    hideOnDesktop ||
    (showOnlyOn === 'phone' && !mobile.isAnyPhone) ||
    (showOnlyOn === 'tablet' && mobile.deviceType !== 'tablet') ||
    (showOnlyOn === 'desktop' && !mobile.isDesktop);

  if (isHidden) {
    return null;
  }

  // Mobile-specific padding/spacing
  const mobilePadding = mobile.isAnyPhone ? 'px-4 py-3' : 'px-6 py-4';

  return (
    <div
      className={cn(
        'w-full transition-all duration-200',
        mobilePadding,
        // Responsive max-width
        mobile.isPhone && 'max-w-full',
        mobile.isPhoneLg && 'max-w-xl',
        mobile.isTablet && 'max-w-2xl',
        mobile.isDesktop && 'max-w-4xl',
        mobile.isDesktopXl && 'max-w-6xl',
        className
      )}
    >
      {children}
    </div>
  );
};

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ResponsiveContainer
 *
 * Applies adaptive layout with proper spacing for all breakpoints.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className,
}) => {
  const mobile = useMobile();

  return (
    <div
      className={cn(
        'w-full h-full',
        // Grid spacing based on breakpoint
        mobile.isPhone && 'gap-2',
        mobile.isPhoneLg && 'gap-3',
        mobile.isTablet && 'gap-4',
        mobile.isDesktop && 'gap-6',
        className
      )}
    >
      {children}
    </div>
  );
};

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    phone?: number;
    tablet?: number;
    desktop?: number;
  };
}

/**
 * ResponsiveGrid
 *
 * Grid layout that adapts column count by breakpoint.
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className,
  cols = {
    phone: 1,
    tablet: 2,
    desktop: 3,
  },
}) => {
  const mobile = useMobile();

  let colClass = 'grid-cols-1';
  if (mobile.isPhone) {
    colClass = `grid-cols-${cols.phone}`;
  } else if (mobile.isTablet) {
    colClass = `grid-cols-${cols.tablet}`;
  } else {
    colClass = `grid-cols-${cols.desktop}`;
  }

  return (
    <div className={cn('grid gap-4', colClass, className)}>{children}</div>
  );
};
