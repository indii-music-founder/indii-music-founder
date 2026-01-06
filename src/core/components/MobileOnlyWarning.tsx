import React from 'react';
import { Monitor, Smartphone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';

interface MobileOnlyWarningProps {
    featureName: string;
    reason?: string;
    suggestedModule?: ModuleId | string;
}

export const MobileOnlyWarning: React.FC<MobileOnlyWarningProps> = ({
    featureName,
    reason = 'This feature requires a larger screen for optimal use.',
    suggestedModule = 'creative',
}) => {
    const { setModule } = useStore();

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0d1117]">
            <div className="flex gap-4 mb-6">
                <Smartphone className="w-12 h-12 text-neon-blue opacity-50" />
                <Monitor className="w-12 h-12 text-neon-purple opacity-50" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
                {featureName}
            </h2>

            <p className="text-gray-400 max-w-sm mb-6">
                {reason} Access the full experience on a desktop or tablet device.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                    onClick={() => setModule(suggestedModule as any)}
                    className="w-full bg-gradient-to-r from-neon-blue to-neon-purple hover:opacity-90"
                >
                    <ArrowRight size={16} className="mr-2" />
                    Go to Recommended Feature
                </Button>

                <button
                    onClick={() => window.location.reload()}
                    className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                    Refresh to continue
                </button>
            </div>
        </div>
    );
};
