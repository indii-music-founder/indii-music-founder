import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { getColorForModule } from '@/core/theme/moduleColors';
import {
    Briefcase, Users, Megaphone, Network, Mic, Palette, Film, Image,
    Scale, Book, DollarSign, FileText, ShoppingBag, Radio, Globe,
    Menu, X, Layout
} from 'lucide-react';
import { haptic } from '@/lib/mobile';
import { type ModuleId } from '@/core/constants';

interface NavItem {
    id: ModuleId;
    icon: React.ElementType;
    label: string;
}

export const MobileNav = () => {
    const { currentModule, setModule } = useStore();
    const [isOpen, setIsOpen] = useState(false);

    // Grouped navigation items (mirrored from Sidebar.tsx)
    const managerItems: NavItem[] = [
        { id: 'brand', icon: Briefcase, label: 'Brand Manager' },
        { id: 'road', icon: Users, label: 'Road Manager' },
        { id: 'campaign', icon: Megaphone, label: 'Campaign Manager' },
        { id: 'agent', icon: Network, label: 'Agent Tools' },
        { id: 'publicist', icon: Mic, label: 'Publicist' },
        { id: 'creative', icon: Palette, label: 'Creative Director' },
        { id: 'video', icon: Film, label: 'Video Producer' },
        { id: 'reference-manager', icon: Image, label: 'Reference Assets' },
    ];

    const departmentItems: NavItem[] = [
        { id: 'marketing', icon: Megaphone, label: 'Marketing Department' },
        { id: 'social', icon: Network, label: 'Social Media Department' },
        { id: 'legal', icon: Scale, label: 'Legal Department' },
        { id: 'publishing', icon: Book, label: 'Publishing Department' },
        { id: 'finance', icon: DollarSign, label: 'Finance Department' },
        { id: 'licensing', icon: FileText, label: 'Licensing Department' },
    ];

    const toolItems: NavItem[] = [
        { id: 'merch', icon: ShoppingBag, label: 'Merch Tool' },
        { id: 'audio-analyzer', icon: Radio, label: 'Audio Analyzer' },
        { id: 'workflow', icon: Network, label: 'Workflow Builder' },
        { id: 'knowledge', icon: Book, label: 'Knowledge Base' },
    ];

    const handleItemClick = (id: ModuleId) => {
        haptic('light');
        setModule(id);
        setIsOpen(false);
    };

    const MenuItem = ({ item }: { item: NavItem }) => {
        const isActive = currentModule === item.id;
        const colors = getColorForModule(item.id);

        return (
            <button
                onClick={() => handleItemClick(item.id)}
                className={`
                    w-full flex items-center gap-3 p-3 rounded-xl transition-all
                    ${isActive
                        ? `${colors.bg} ${colors.text} ring-1 ${colors.border}`
                        : `text-gray-300 ${colors.hoverBg} ${colors.hoverText}`
                    }
                `}
            >
                <item.icon size={20} className={isActive ? 'drop-shadow-sm' : ''} />
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <>
            {/* FAB Trigger - Replaces Bottom Bar */}
            <button
                onClick={() => {
                    haptic('medium');
                    setIsOpen(true);
                }}
                className="md:hidden fixed bottom-24 right-6 z-[102] p-3.5 bg-background border border-white/10 rounded-full shadow-lg shadow-black/50 active:scale-95 transition-transform hover:bg-white/10 text-white"
                aria-label="Open Navigation"
            >
                <Menu size={24} />
            </button>

            {/* Full Screen Drawer */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-[103] flex items-end justify-center animate-in fade-in duration-200">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            haptic('light');
                            setIsOpen(false);
                        }}
                    />

                    {/* Menu Content */}
                    <div className="relative w-full max-w-lg bg-background border-t border-white/10 rounded-t-3xl mobile-safe-bottom flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300 shadow-2xl">
                        {/* Drag Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-12 h-1 bg-white/20 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <h2 className="text-lg font-semibold text-white">Navigation</h2>
                            <button
                                onClick={() => {
                                    haptic('light');
                                    setIsOpen(false);
                                }}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95 text-white/60 hover:text-white"
                                aria-label="Close menu"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">

                            {/* Return to HQ */}
                            <button
                                onClick={() => handleItemClick('dashboard')}
                                className={`
                                    w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-4
                                    ${currentModule === 'dashboard'
                                        ? 'bg-white/10 text-white ring-1 ring-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                    }
                                `}
                            >
                                <Layout size={20} />
                                <span className="text-sm font-semibold">Return to HQ</span>
                            </button>

                            {/* Manager's Office */}
                            <div className="space-y-1">
                                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Manager's Office</h3>
                                {managerItems.map(item => (
                                    <MenuItem key={item.id} item={item} />
                                ))}
                            </div>

                            {/* Departments */}
                            <div className="space-y-1">
                                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Departments</h3>
                                {departmentItems.map(item => (
                                    <MenuItem key={item.id} item={item} />
                                ))}
                            </div>

                            {/* Tools */}
                            <div className="space-y-1">
                                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tools</h3>
                                {toolItems.map(item => (
                                    <MenuItem key={item.id} item={item} />
                                ))}
                            </div>

                            {/* Bottom Padding for scroll */}
                            <div className="h-6" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
