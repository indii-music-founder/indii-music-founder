import React, { useState, useEffect, useCallback } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveLayoutContextType {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

const ResponsiveLayoutContext = React.createContext<
  ResponsiveLayoutContextType | undefined
>(undefined);

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
}

/**
 * Responsive breakpoints:
 * - mobile: 0-640px (small phones, portrait)
 * - tablet: 641-1024px (tablets, landscape phones)
 * - desktop: 1025px+ (desktops, wide screens)
 */
export const ResponsiveLayoutProvider: React.FC<
  ResponsiveLayoutProviderProps
> = ({ children }) => {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [height, setHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  const getBreakpoint = useCallback((w: number): Breakpoint => {
    if (w <= 640) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }, []);

  const breakpoint = getBreakpoint(width);
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop';

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const value: ResponsiveLayoutContextType = {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    width,
    height,
  };

  return (
    <ResponsiveLayoutContext.Provider value={value}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
};

/**
 * Hook to access responsive layout context
 */
export const useResponsiveLayout = (): ResponsiveLayoutContextType => {
  const context = React.useContext(ResponsiveLayoutContext);
  if (context === undefined) {
    throw new Error(
      'useResponsiveLayout must be used within ResponsiveLayoutProvider'
    );
  }
  return context;
};
