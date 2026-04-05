import React from 'react';
import { motion } from 'motion/react';
import {
    Sparkles, Film, Megaphone, Book, GitBranch, Scale,
    DollarSign, Globe, Network, Briefcase, FileText, Users,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getColorForModule } from '@/core/theme/moduleColors';
import type { ModuleId } from '@/core/constants';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickAction {
    id: ModuleId;
    name: string;
    icon: React.ElementType;
    hint: string;
}

/**
 * Quick Actions — compact pill-style module launchers
 * Expanded to cover all key departments with department colors
 */
const ACTIONS: QuickAction[] = [
    { id: 'creative', name: 'Creative', icon: Sparkles, hint: 'AI image generation studio' },
    { id: 'video', name: 'Video', icon: Film, hint: 'AI video production' },
    { id: 'marketing', name: 'Marketing', icon: Megaphone, hint: 'Campaigns & brand copy' },
    { id: 'distribution', name: 'Distribution', icon: Globe, hint: 'Release management' },
    { id: 'finance', name: 'Finance', icon: DollarSign, hint: 'Revenue & royalties' },
    { id: 'legal', name: 'Legal', icon: Scale, hint: 'Contracts & rights' },
    { id: 'publishing', name: 'Publishing', icon: Book, hint: 'Catalog & metadata' },
    { id: 'social', name: 'Social', icon: Network, hint: 'Social media manager' },
    { id: 'workflow', name: 'Workflow', icon: GitBranch, hint: 'Automation builder' },
    { id: 'brand', name: 'Brand', icon: Briefcase, hint: 'Brand identity kit' },
    { id: 'licensing', name: 'Licensing', icon: FileText, hint: 'Sync deals & licensing' },
    { id: 'road', name: 'Road', icon: Users, hint: 'Tour management' },
];

export default function QuickActions() {
    const { setModule } = useStore(useShallow(state => ({
        setModule: state.setModule
    })));

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action, i) => {
                    const Icon = action.icon;
                    const colors = getColorForModule(action.id);

                    return (
                        <Tooltip key={action.id}>
                            <TooltipTrigger asChild>
                                <motion.button
                                    onClick={() => setModule(action.id)}
                                    style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161b22]/60 border border-white/5 hover:border-[--dept-color]/40 hover:bg-[#1c2128] transition-all group text-left"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.02 }}
                                >
                                    <div className={`w-6 h-6 rounded flex items-center justify-center ${colors.bg}`}>
                                        <Icon className={colors.text} size={13} />
                                    </div>
                                    <span className="text-gray-400 font-medium text-[11px] group-hover:text-white transition-colors">
                                        {action.name}
                                    </span>
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-[#1a1a1a] text-white border-white/10 text-xs">
                                {action.hint}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}
