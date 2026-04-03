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
    Send, Mic
} from 'lucide-react';
import type { ModuleId } from '@/core/constants';

interface CommandPadProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

interface QuickAction {
    id: string;
    icon: React.ElementType;
    label: string;
    color: string;
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
            label: 'Generate',
            color: 'from-violet-600/40 to-violet-800/20 border-violet-500/40 text-violet-300',
            action: () => {
                // Navigate to Creative module + send prompt through relay
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
            icon: Send,
            label: 'Ask indii',
            color: 'from-fuchsia-600/40 to-fuchsia-800/20 border-fuchsia-500/40 text-fuchsia-300',
            action: () => {
                // Open the agent chat panel on desktop via relay
                // (Desktop handles RightPanel logic in the listener)
                onSendCommand({ type: 'agent_action', payload: { action: 'open_chat' } });
            },
        },
        {
            id: 'voice-note',
            icon: Mic,
            label: 'Voice',
            color: 'from-emerald-600/40 to-emerald-800/20 border-emerald-500/40 text-emerald-300',
            action: () => {
                // Navigate to the capture module for voice recording
                navigateTo('capture');
            },
        },
        {
            id: 'quick-sparkle',
            icon: Sparkles,
            label: 'Brainstorm',
            color: 'from-cyan-600/40 to-cyan-800/20 border-cyan-500/40 text-cyan-300',
            action: () => {
                // Send brainstorm request through the relay to the desktop agent
                remoteRelayService.sendCommand(
                    'Let\'s brainstorm. Give me 5 creative ideas for my next project based on my profile and recent work.'
                ).catch(err => logger.error('[CommandPad] Brainstorm failed:', err));
            },
        },
    ];

    // Module navigation grid — every button calls setModule() directly
    const moduleButtons: QuickAction[] = [
        {
            id: 'creative',
            icon: Palette,
            label: 'Creative',
            color: 'from-purple-600/30 to-purple-800/20 border-purple-600/30 text-purple-400',
            action: () => navigateTo('creative'),
        },
        {
            id: 'video',
            icon: Video,
            label: 'Video',
            color: 'from-pink-600/30 to-pink-800/20 border-pink-600/30 text-pink-400',
            action: () => navigateTo('video'),
        },
        {
            id: 'audio-analyzer',
            icon: Music,
            label: 'Audio',
            color: 'from-amber-600/30 to-amber-800/20 border-amber-600/30 text-amber-400',
            action: () => navigateTo('audio-analyzer'),
        },
        {
            id: 'distribution',
            icon: Globe,
            label: 'Distro',
            color: 'from-blue-600/30 to-blue-800/20 border-blue-600/30 text-blue-400',
            action: () => navigateTo('distribution'),
        },
        {
            id: 'finance',
            icon: BarChart3,
            label: 'Finance',
            color: 'from-green-600/30 to-green-800/20 border-green-600/30 text-green-400',
            action: () => navigateTo('finance'),
        },
        {
            id: 'legal',
            icon: Shield,
            label: 'Legal',
            color: 'from-red-600/30 to-red-800/20 border-red-600/30 text-red-400',
            action: () => navigateTo('legal'),
        },
        {
            id: 'marketing',
            icon: TrendingUp,
            label: 'Marketing',
            color: 'from-orange-600/30 to-orange-800/20 border-orange-600/30 text-orange-400',
            action: () => navigateTo('marketing'),
        },
        {
            id: 'social',
            icon: MessageSquare,
            label: 'Social',
            color: 'from-indigo-600/30 to-indigo-800/20 border-indigo-600/30 text-indigo-400',
            action: () => navigateTo('social'),
        },
        {
            id: 'files',
            icon: FileText,
            label: 'Files',
            color: 'from-teal-600/30 to-teal-800/20 border-teal-600/30 text-teal-400',
            action: () => navigateTo('files'),
        },
        {
            id: 'merch',
            icon: Package,
            label: 'Merch',
            color: 'from-rose-600/30 to-rose-800/20 border-rose-600/30 text-rose-400',
            action: () => navigateTo('merch'),
        },
        {
            id: 'publishing',
            icon: Globe,
            label: 'Publish',
            color: 'from-lime-600/30 to-lime-800/20 border-lime-600/30 text-lime-400',
            action: () => navigateTo('publishing'),
        },
        {
            id: 'settings',
            icon: Settings,
            label: 'Settings',
            color: 'from-gray-600/30 to-gray-800/20 border-gray-600/30 text-gray-400',
            action: () => navigateTo('settings'),
        },
    ];

    return (
        <div className="space-y-4">
            {/* Agent Quick Actions */}
            <div>
                <p className="text-[10px] uppercase tracking-wider text-[#6e7681] font-semibold mb-2 px-1">
                    Quick Actions
                </p>
                <div className="grid grid-cols-4 gap-2">
                    {quickActions.map(action => (
                        <button
                            key={action.id}
                            onClick={action.action}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gradient-to-b ${action.color} border backdrop-blur-sm transition-all active:scale-95`}
                        >
                            <action.icon className="w-5 h-5" />
                            <span className="text-[10px] font-semibold">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Module Navigation Grid */}
            <div>
                <p className="text-[10px] uppercase tracking-wider text-[#6e7681] font-semibold mb-2 px-1">
                    Modules
                </p>
                <div className="grid grid-cols-4 gap-2">
                    {moduleButtons.map(action => (
                        <button
                            key={action.id}
                            onClick={action.action}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gradient-to-b ${action.color} border backdrop-blur-sm transition-all active:scale-95`}
                        >
                            <action.icon className="w-4 h-4" />
                            <span className="text-[10px] font-medium">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
