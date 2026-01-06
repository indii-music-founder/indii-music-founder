import React from 'react';
import { useStore } from '@/core/store';
import { Layout, Music, MessageSquare, Scale, Workflow, Home, Book, MoreHorizontal, X, DollarSign } from 'lucide-react';

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
        if (tabId === 'more') {
            setShowOverflowMenu(true);
        } else {
            setModule(tabId as any);
            setShowOverflowMenu(false);
        }
    };

    const handleOverflowTabPress = (tabId: string) => {
        setModule(tabId as any);
        setShowOverflowMenu(false);
    };

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-white/10 z-50 pb-safe mobile-safe-bottom">
                <div className="flex justify-around items-center p-2">
                    {primaryTabs.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleTabPress(item.id)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentModule === item.id
                                ? 'text-neon-blue'
                                : 'text-white/40 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Overflow Menu Modal */}
            {showOverflowMenu && (
                <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowOverflowMenu(false)}
                    />

                    {/* Menu Content */}
                    <div className="relative w-full max-w-lg bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl mobile-safe-bottom p-6 animate-slide-up">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">More Features</h2>
                            <button
                                onClick={() => setShowOverflowMenu(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-white" />
                            </button>
                        </div>

                        {/* Overflow Tabs Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            {overflowTabs.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleOverflowTabPress(item.id)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${currentModule === item.id
                                        ? 'bg-white/10 text-neon-blue'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    <item.icon size={24} />
                                    <span className="text-xs font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Footer Note */}
                        <p className="text-center text-gray-500 text-xs mt-6">
                            Use desktop for advanced workflow editing
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};
