import React from 'react';
import { useStore } from '@/core/store';
import { Layout, Music, MessageSquare, Scale, Workflow, Home, Book, MoreHorizontal, X, DollarSign } from 'lucide-react';
import { haptic } from '@/lib/mobile';

export const MobileNav = () => {
    const { currentModule, setModule } = useStore();
    const [showOverflowMenu, setShowOverflowMenu] = React.useState(false);

    // Primary tabs (5 max per UX best practices)
    const primaryTabs = [
        { id: 'dashboard', icon: Home, label: 'Home' },
        { id: 'creative', icon: Layout, label: 'Studio' },
        { id: 'marketing', icon: MessageSquare, label: 'Market' },
        { id: 'knowledge', icon: Book, label: 'Brain' },
        { id: 'more', icon: MoreHorizontal, label: 'More' },
    ] as const;

    // Overflow tabs for the "More" menu
    const overflowTabs = [
        { id: 'music', icon: Music, label: 'Analysis' },
        { id: 'workflow', icon: Workflow, label: 'Flow' },
        { id: 'legal', icon: Scale, label: 'Legal' },
        { id: 'publishing', icon: Book, label: 'Publish' },
        { id: 'finance', icon: DollarSign, label: 'Finance' },
    ] as const;

    const handleTabPress = (tabId: string) => {
        // Haptic feedback for tab press
        haptic('light');

        if (tabId === 'more') {
            setShowOverflowMenu(true);
        } else {
            setModule(tabId as any);
            setShowOverflowMenu(false);
        }
    };

    const handleOverflowTabPress = (tabId: string) => {
        // Haptic feedback for overflow tab
        haptic('medium');
        setModule(tabId as any);
        setShowOverflowMenu(false);
    };

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-white/10 z-50 pb-safe mobile-safe-bottom">
                <div className="flex justify-around items-center px-2 py-1.5">
                    {primaryTabs.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleTabPress(item.id)}
                            className={`
                                flex flex-col items-center gap-1 p-2.5 rounded-xl
                                transition-all duration-200 min-w-[64px] min-h-[48px]
                                active:scale-95 active:bg-white/5
                                ${currentModule === item.id
                                    ? 'text-neon-blue bg-neon-blue/10'
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                                }
                            `}
                            aria-label={item.label}
                            aria-current={currentModule === item.id ? 'page' : undefined}
                        >
                            <item.icon size={22} strokeWidth={currentModule === item.id ? 2.5 : 2} />
                            <span className={`text-[10px] font-medium transition-all ${currentModule === item.id ? 'font-semibold' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Overflow Menu Modal */}
            {showOverflowMenu && (
                <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center animate-in fade-in duration-200">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            haptic('light');
                            setShowOverflowMenu(false);
                        }}
                    />

                    {/* Menu Content */}
                    <div className="relative w-full max-w-lg bg-[#1a1a1a] border-t border-white/10 rounded-t-3xl mobile-safe-bottom p-6 animate-in slide-in-from-bottom duration-300">
                        {/* Drag Handle */}
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-1 bg-white/20 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">More Features</h2>
                            <button
                                onClick={() => {
                                    haptic('light');
                                    setShowOverflowMenu(false);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                                aria-label="Close menu"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>

                        {/* Overflow Tabs Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            {overflowTabs.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleOverflowTabPress(item.id)}
                                    className={`
                                        flex flex-col items-center gap-3 p-4 rounded-2xl
                                        transition-all duration-200 min-h-[88px]
                                        active:scale-95
                                        ${currentModule === item.id
                                            ? 'bg-neon-blue/10 text-neon-blue ring-1 ring-neon-blue/20'
                                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                        }
                                    `}
                                    aria-label={item.label}
                                >
                                    <item.icon size={28} strokeWidth={currentModule === item.id ? 2.5 : 2} />
                                    <span className={`text-xs font-medium ${currentModule === item.id ? 'font-semibold' : ''}`}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Footer Note */}
                        <p className="text-center text-gray-500 text-xs mt-6 leading-relaxed">
                            Use desktop for advanced workflow editing
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};
