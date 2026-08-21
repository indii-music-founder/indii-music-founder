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
    // rAF-coalesce: dragging a window edge fires resize events far faster
    // than frames, and every handler ran setState before — re-rendering the
    // ENTIRE provider subtree (all useResponsiveLayout consumers) per event.
    // At most one state write per animation frame now.
    let frame: number | null = null;
    const handleResize = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setWidth(window.innerWidth);
        setHeight(window.innerHeight);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frame !== null) cancelAnimationFrame(frame);
    };
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
// eslint-disable-next-line react-refresh/only-export-components
export const useResponsiveLayout = (): ResponsiveLayoutContextType => {
  const context = React.useContext(ResponsiveLayoutContext);
  if (context === undefined) {
    throw new Error(
      'useResponsiveLayout must be used within ResponsiveLayoutProvider'
    );
  }
  return context;
};
