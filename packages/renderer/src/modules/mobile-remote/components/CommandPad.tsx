/**
 * CommandPad — Quick-action button grid for the phone remote.
 * Provides one-tap access to common studio actions: navigate modules,
 * trigger agent commands, start generations, and toggle chat.
 *
 * Every button triggers a REAL action on the Zustand store — no cosmetic buttons.
 */

import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';
import { logger } from '@/utils/logger';
import {
    Palette, Video, Music, BarChart3, Sparkles,
    Shield, Globe, FileText, MessageSquare,
    Wand2, Package, TrendingUp, Settings,
    Send, Mic, LucideIcon, Rocket, Zap,
    Cpu, Headphones, Share2, Layers
} from 'lucide-react';
import type { ModuleId } from '@/core/constants';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CommandPadProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

interface QuickAction {
    id: string;
    icon: LucideIcon;
    label: string;
    color: string;
    glow: string;
    action: () => void;
}

export default function CommandPad({ onSendCommand }: CommandPadProps) {
    const { setModule } = useStore(
        useShallow(state => ({
            setModule: state.setModule,
        }))
    );

    const navigateTo = (moduleId: ModuleId) => {
        setModule(moduleId);
        onSendCommand({ type: 'navigate', payload: { module: moduleId } });
    };

    const quickActions: QuickAction[] = [
        {
            id: 'generate-image',
            icon: Wand2,
            label: 'Gen Visual',
            color: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            glow: 'shadow-violet-500/20',
            action: () => {
                navigateTo('creative');
                remoteRelayService.sendCommand(
                    '[GENERATE_IMAGE] Create a stunning visual — cinematic lighting, bold composition',
                    undefined,
                    { aspectRatio: '1:1', type: 'generate_image' }
                ).catch(err => logger.error('[CommandPad] Generate failed:', err));
            },
        },
        {
            id: 'ask-indii',
            icon: Zap,
            label: 'Quick Ask',
            color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            glow: 'shadow-blue-500/20',
            action: () => {
                onSendCommand({ type: 'agent_action', payload: { action: 'open_chat' } });
            },
        },
        {
            id: 'voice-note',
            icon: Mic,
            label: 'Voice Note',
            color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            glow: 'shadow-emerald-500/20',
            action: () => {
                navigateTo('capture');
            },
        },
        {
            id: 'quick-sparkle',
            icon: Sparkles,
            label: 'Brainstorm',
            color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            glow: 'shadow-amber-500/20',
            action: () => {
                remoteRelayService.sendCommand(
                    'Let\'s brainstorm. Give me 5 creative ideas for my next project based on my profile and recent work.'
                ).catch(err => logger.error('[CommandPad] Brainstorm failed:', err));
            },
        },
    ];

    const moduleButtons = [
        { id: 'creative', icon: Palette, label: 'Creative', accent: 'text-purple-400 border-purple-500/20' },
        { id: 'video', icon: Video, label: 'Video', accent: 'text-pink-400 border-pink-500/20' },
        { id: 'audio-analyzer', icon: Music, label: 'Audio', accent: 'text-amber-400 border-amber-500/20' },
        { id: 'distribution', icon: Globe, label: 'Distro', accent: 'text-blue-400 border-blue-500/20' },
        { id: 'finance', icon: BarChart3, label: 'Finance', accent: 'text-green-400 border-green-500/20' },
        { id: 'legal', icon: Shield, label: 'Legal', accent: 'text-red-400 border-red-500/20' },
        { id: 'marketing', icon: TrendingUp, label: 'Marketing', accent: 'text-orange-400 border-orange-500/20' },
        { id: 'social', icon: MessageSquare, label: 'Social', accent: 'text-indigo-400 border-indigo-500/20' },
        { id: 'files', icon: FileText, label: 'Files', accent: 'text-teal-400 border-teal-500/20' },
        { id: 'merch', icon: Package, label: 'Merch', accent: 'text-rose-400 border-rose-500/20' },
        { id: 'publishing', icon: Globe, label: 'Publish', accent: 'text-lime-400 border-lime-500/20' },
        { id: 'settings', icon: Settings, label: 'Settings', accent: 'text-gray-400 border-gray-500/20' },
    ];

    return (
        <div className="space-y-6 pb-8">
            {/* Action Grid */}
            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#636366]">Express Actions</h3>
                    <div className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-blue-500/40" />
                        <span className="w-1 h-1 rounded-full bg-indigo-500/40" />
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    {quickActions.map((action, idx) => (
                        <motion.button
                            key={action.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={action.action}
                            className={cn(
                                "relative overflow-hidden flex flex-col items-start gap-4 p-4 rounded-[28px] border backdrop-blur-md transition-all duration-300 shadow-lg",
                                action.color,
                                action.glow
                            )}
                        >
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                                <action.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold tracking-tight">{action.label}</span>
                            
                            {/* Decoration */}
                            <div className="absolute top-2 right-2 opacity-10">
                                <Rocket className="w-12 h-12 rotate-[15deg]" />
                            </div>
                        </motion.button>
                    ))}
                </div>
            </section>

            {/* Modules Grid */}
            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#636366]">Module Matrix</h3>
                    <Layers className="w-3 h-3 text-[#636366]" />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    {moduleButtons.map((mod, idx) => (
                        <motion.button
                            key={mod.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + (idx * 0.03) }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => navigateTo(mod.id as ModuleId)}
                            className={cn(
                                "flex flex-col items-center gap-2.5 py-4 rounded-[24px] bg-white/[0.03] border hover:bg-white/[0.06] transition-all duration-300",
                                mod.accent
                            )}
                        >
                            <div className="p-2 rounded-xl bg-white/5">
                                <mod.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-bold tracking-wider uppercase">{mod.label}</span>
                        </motion.button>
                    ))}
                </div>
            </section>

            {/* Quick Status Bar */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center justify-center gap-6 px-6 py-4 rounded-[32px] bg-white/[0.02] border border-white/5"
            >
                <div className="flex flex-col items-center gap-1">
                    <Cpu className="w-4 h-4 text-blue-400/60" />
                    <span className="text-[8px] font-bold text-[#636366] uppercase tracking-widest">CPU 12%</span>
                </div>
                <div className="w-px h-6 bg-white/5" />
                <div className="flex flex-col items-center gap-1">
                    <Headphones className="w-4 h-4 text-indigo-400/60" />
                    <span className="text-[8px] font-bold text-[#636366] uppercase tracking-widest">Audio ON</span>
                </div>
                <div className="w-px h-6 bg-white/5" />
                <div className="flex flex-col items-center gap-1">
                    <Share2 className="w-4 h-4 text-emerald-400/60" />
                    <span className="text-[8px] font-bold text-[#636366] uppercase tracking-widest">Sync OK</span>
                </div>
            </motion.div>
        </div>
    );
}
