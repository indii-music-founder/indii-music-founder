import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getColorForModule } from '@/core/theme/moduleColors';
import { ChevronLeft } from 'lucide-react';
import { haptic } from '@/lib/mobile';
import { type ModuleId } from '@/core/constants';
import { useMobile } from '@/hooks/useMobile';

/**
 * MobileHeader — Compact header bar for phone-class viewports.
 *
 * Shows:
 *   - Left: Back/Home button (navigates to Dashboard)
 *   - Center: Current module name with department color accent
 *   - Right: Placeholder for module-specific actions
 *
 * Height: 48px. Respects safe-area-inset-top for notch/Dynamic Island.
 * Only renders on phone-class viewports — hidden on tablet/desktop.
 */

// Module display names for the header
const MODULE_DISPLAY_NAMES: Partial<Record<ModuleId, string>> = {
    'dashboard': 'Home',
    'creative': 'Creative Director',
    'video': 'Video Producer',
    'legal': 'Legal',
    'marketing': 'Marketing',
    'workflow': 'Workflow Lab',
    'knowledge': 'Knowledge Base',
    'road': 'Road Manager',
    'social': 'Social Media',
    'brand': 'Brand Manager',
    'campaign': 'Campaign Manager',
    'publicist': 'Publicist',
    'publishing': 'Publishing',
    'finance': 'Finance',
    'licensing': 'Licensing',
    'agent': 'Booking Agent',
    'distribution': 'Distribution',
    'files': 'Files',
    'merch': 'Merchandise',
    'marketplace': 'Marketplace',
    'audio-analyzer': 'Audio Analyzer',
    'observability': 'Observability',
    'history': 'History',
    'debug': 'Debug',
    'investor': 'Investor',
    'capture': 'Capture',
    'memory': 'Memory',
};

export const MobileHeader: React.FC = () => {
    const { isAnyPhone } = useMobile();
    const { currentModule, setModule } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            setModule: state.setModule,
        }))
    );

    // Only render on phone-class viewports
    if (!isAnyPhone) return null;

    const isDashboard = currentModule === 'dashboard';
    const colors = getColorForModule(currentModule as ModuleId);
    const displayName = MODULE_DISPLAY_NAMES[currentModule as ModuleId] || currentModule;

    const handleBack = () => {
        haptic('light');
        setModule('dashboard');
    };

    return (
        <header
            className="sticky top-0 z-[100] bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-white/[0.04]"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            <div className="flex items-center h-[48px] px-3">
                {/* Left: Back button (hidden on Dashboard) */}
                <div className="w-10 flex-shrink-0">
                    {!isDashboard && (
                        <button
                            onClick={handleBack}
                            className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors active:scale-90"
                            aria-label="Back to Home"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                </div>

                {/* Center: Module name with accent */}
                <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.text}`}
                        style={{ backgroundColor: 'currentColor' }}
                    />
                    <h1 className="text-sm font-semibold text-white truncate">
                        {displayName}
                    </h1>
                </div>

                {/* Right: placeholder for module-specific action */}
                <div className="w-10 flex-shrink-0" />
            </div>
        </header>
    );
};
