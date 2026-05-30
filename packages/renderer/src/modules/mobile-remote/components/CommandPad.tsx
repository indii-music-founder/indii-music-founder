/**
 * CommandPad — Quick-action button grid for the phone remote.
 * Provides one-tap access to common studio actions: navigate modules,
 * trigger agent commands, start generations, and toggle chat.
 *
 * Expands the vocabulary to map the 10 main dashboard widgets (hub cards)
 * with robust, dual-action execution (navigates + triggers targeted agent telemetry).
 *
 * Every button is explicitly designed to meet or exceed the 44x44px safety grid.
 */

import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';
import { logger } from '@/utils/logger';
import {
  Palette, Video, Music, DollarSign, Calendar, TrendingUp, Bot, Users, Activity,
  CheckSquare, ThumbsUp, ShoppingBag, MapPin, Sparkles, Mic, LucideIcon, Rocket, Zap,
  Cpu, Headphones, Share2, Layers, Settings, FileText, Globe, BarChart3, Shield,
  MessageSquare, Package, Wand2
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

interface DashboardHubCard {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  moduleId: ModuleId;
  agentPrompt: string;
  color: string;
  glow: string;
}

export default function CommandPad({ onSendCommand, isPaired }: CommandPadProps) {
  const { setModule } = useStore(
    useShallow(state => ({
      setModule: state.setModule,
    }))
  );

  const navigateTo = (moduleId: ModuleId) => {
    setModule(moduleId);
    onSendCommand({ type: 'navigate', payload: { module: moduleId } });
  };

  // Dual action: navigate to module + fire targeted agent research query
  const triggerHubAction = (moduleId: ModuleId, prompt: string) => {
    navigateTo(moduleId);
    if (isPaired) {
      remoteRelayService.sendCommand(prompt).catch(err => {
        logger.error(`[CommandPad] Failed to trigger agent action:`, err);
      });
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: 'generate-image',
      icon: Wand2,
      label: 'Gen Visual',
      color: 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20',
      glow: 'shadow-violet-500/15 hover:shadow-violet-500/30',
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
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
      glow: 'shadow-blue-500/15 hover:shadow-blue-500/30',
      action: () => {
        onSendCommand({ type: 'agent_action', payload: { action: 'open_chat' } });
      },
    },
    {
      id: 'voice-note',
      icon: Mic,
      label: 'Voice Note',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
      glow: 'shadow-emerald-500/15 hover:shadow-emerald-500/30',
      action: () => {
        navigateTo('capture' as ModuleId);
      },
    },
    {
      id: 'quick-sparkle',
      icon: Sparkles,
      label: 'Brainstorm',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
      glow: 'shadow-amber-500/15 hover:shadow-amber-500/30',
      action: () => {
        remoteRelayService.sendCommand(
          "Let's brainstorm. Give me 5 creative ideas for my next project based on my profile and recent work."
        ).catch(err => logger.error('[CommandPad] Brainstorm failed:', err));
      },
    },
  ];

  // The 10 Main Dashboard Hub Cards
  const dashboardHubCards: DashboardHubCard[] = [
    {
      id: 'streams_today',
      icon: Music,
      label: 'Streams Today',
      description: 'DSPs daily streams metrics',
      moduleId: 'audio-analyzer',
      agentPrompt: 'Analyze my stream data for today. Provide an overview of organic spikes and highlight where listeners are driving the most velocity.',
      color: 'border-blue-500/25 bg-blue-500/[0.03] text-blue-400 hover:bg-blue-500/[0.08]',
      glow: 'shadow-blue-500/5 hover:shadow-blue-500/15',
    },
    {
      id: 'revenue_aggregated',
      icon: DollarSign,
      label: 'Aggregated Revenue',
      description: 'Royalty & Sales rollups',
      moduleId: 'finance',
      agentPrompt: 'Generate a month-to-date financial summary showing aggregated royalty streams vs merchandise store earnings.',
      color: 'border-green-500/25 bg-green-500/[0.03] text-green-400 hover:bg-green-500/[0.08]',
      glow: 'shadow-green-500/5 hover:shadow-green-500/15',
    },
    {
      id: 'next_release',
      icon: Calendar,
      label: 'Next Release Plan',
      description: 'Single distribution progress',
      moduleId: 'distribution',
      agentPrompt: 'Auditing pre-release readiness checks: verify metadata upload, DSP delivery timeline, and release-week checklists.',
      color: 'border-pink-500/25 bg-pink-500/[0.03] text-pink-400 hover:bg-pink-500/[0.08]',
      glow: 'shadow-pink-500/5 hover:shadow-pink-500/15',
    },
    {
      id: 'top_track',
      icon: TrendingUp,
      label: 'Top Track Focus',
      description: 'Highest velocity releases',
      moduleId: 'marketing',
      agentPrompt: 'Draft an aggressive, target-audience marketing sprint focusing on maximizing playlist placements and TikTok engagement for our top-performing track.',
      color: 'border-purple-500/25 bg-purple-500/[0.03] text-purple-400 hover:bg-purple-500/[0.08]',
      glow: 'shadow-purple-500/5 hover:shadow-purple-500/15',
    },
    {
      id: 'agent_activity',
      icon: Bot,
      label: 'Agent Workspaces',
      description: 'Swarm active jobs feed',
      moduleId: 'dashboard' as ModuleId,
      agentPrompt: 'Report the current status of the active agent swarm. What legal clearances, brand reviews, or marketing copy drafts are currently pending?',
      color: 'border-violet-500/25 bg-violet-500/[0.03] text-violet-400 hover:bg-violet-500/[0.08]',
      glow: 'shadow-violet-500/5 hover:shadow-violet-500/15',
    },
    {
      id: 'audience_growth',
      icon: Users,
      label: 'Audience Metrics',
      description: 'Superfans and new followers',
      moduleId: 'social',
      agentPrompt: 'Check recent audience demographics. Provide recommendations for moving standard listeners into the high-LTV superfan tier based on recent platform engagement.',
      color: 'border-cyan-500/25 bg-cyan-500/[0.03] text-cyan-400 hover:bg-cyan-500/[0.08]',
      glow: 'shadow-cyan-500/5 hover:shadow-cyan-500/15',
    },
    {
      id: 'active_campaigns',
      icon: Activity,
      label: 'Ad Campaigns',
      description: 'Conversion rates & budgets',
      moduleId: 'marketing',
      agentPrompt: 'Audit all active digital campaigns. Flag underperforming creatives and optimize ad spend allocations based on high conversion groups.',
      color: 'border-orange-500/25 bg-orange-500/[0.03] text-orange-400 hover:bg-orange-500/[0.08]',
      glow: 'shadow-orange-500/5 hover:shadow-orange-500/15',
    },
    {
      id: 'pending_tasks',
      icon: CheckSquare,
      label: 'Pending Clearances',
      description: 'Legal & distribution tasks',
      moduleId: 'legal',
      agentPrompt: 'Verify outstanding contract reviews or legal clearance roadblocks. Identify what tasks require my immediate remote approval signature.',
      color: 'border-rose-500/25 bg-rose-500/[0.03] text-rose-400 hover:bg-rose-500/[0.08]',
      glow: 'shadow-rose-500/5 hover:shadow-rose-500/15',
    },
    {
      id: 'social_engagement',
      icon: ThumbsUp,
      label: 'Social Sentiment',
      description: 'Interactive analytics overview',
      moduleId: 'social',
      agentPrompt: 'Review recent fan comment feeds and sentiment trends. Highlight major fan questions and suggest interactive prompt templates to reply.',
      color: 'border-indigo-500/25 bg-indigo-500/[0.03] text-indigo-400 hover:bg-indigo-500/[0.08]',
      glow: 'shadow-indigo-500/5 hover:shadow-indigo-500/15',
    },
    {
      id: 'brand_identity',
      icon: Palette,
      label: 'Brand Compliance',
      description: 'Assets style integrity audit',
      moduleId: 'creative',
      agentPrompt: 'Perform a Brand Identity guidelines audit on recently generated music video moodboards and promotional graphics files.',
      color: 'border-amber-500/25 bg-amber-500/[0.03] text-amber-400 hover:bg-amber-500/[0.08]',
      glow: 'shadow-amber-500/5 hover:shadow-amber-500/15',
    },
  ];

  const moduleButtons = [
    { id: 'creative', icon: Palette, label: 'Creative', accent: 'text-purple-400 border-purple-500/15 hover:bg-purple-500/5' },
    { id: 'video', icon: Video, label: 'Video', accent: 'text-pink-400 border-pink-500/15 hover:bg-pink-500/5' },
    { id: 'audio-analyzer', icon: Music, label: 'Audio', accent: 'text-amber-400 border-amber-500/15 hover:bg-amber-500/5' },
    { id: 'distribution', icon: Globe, label: 'Distro', accent: 'text-blue-400 border-blue-500/15 hover:bg-blue-500/5' },
    { id: 'finance', icon: BarChart3, label: 'Finance', accent: 'text-green-400 border-green-500/15 hover:bg-green-500/5' },
    { id: 'legal', icon: Shield, label: 'Legal', accent: 'text-red-400 border-red-500/15 hover:bg-red-500/5' },
    { id: 'marketing', icon: TrendingUp, label: 'Marketing', accent: 'text-orange-400 border-orange-500/15 hover:bg-orange-500/5' },
    { id: 'social', icon: MessageSquare, label: 'Social', accent: 'text-indigo-400 border-indigo-500/15 hover:bg-indigo-500/5' },
    { id: 'files', icon: FileText, label: 'Files', accent: 'text-teal-400 border-teal-500/15 hover:bg-teal-500/5' },
    { id: 'merch', icon: Package, label: 'Merch', accent: 'text-rose-400 border-rose-500/15 hover:bg-rose-500/5' },
    { id: 'publishing', icon: Globe, label: 'Publish', accent: 'text-lime-400 border-lime-500/15 hover:bg-lime-500/5' },
    { id: 'settings', icon: Settings, label: 'Settings', accent: 'text-gray-400 border-gray-500/15 hover:bg-gray-500/5' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* ─── Section: Express Actions ─── */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e8e93]">Express Actions</h3>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-75" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3.5">
          {quickActions.map((action, idx) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={action.action}
              className={cn(
                "relative overflow-hidden flex flex-col items-start gap-4 p-5 rounded-[28px] border backdrop-blur-xl transition-all duration-300 shadow-xl cursor-pointer",
                action.color,
                action.glow
              )}
              style={{ minHeight: '120px', minWidth: '44px' }}
            >
              <div className="w-10 h-10 rounded-[16px] bg-white/5 flex items-center justify-center border border-white/10">
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-black tracking-tight uppercase mt-1">{action.label}</span>
              
              {/* Premium Background Vector Deco */}
              <div className="absolute -bottom-2 -right-2 opacity-5 pointer-events-none">
                <Rocket className="w-16 h-16 rotate-[25deg] text-white" />
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ─── Section: Dashboard Hub Controls (10 Cards) ─── */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e8e93]">Hub Control Centre</h3>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-extrabold uppercase">10 cards</span>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {dashboardHubCards.map((card, idx) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => triggerHubAction(card.moduleId, card.agentPrompt)}
              className={cn(
                "group relative overflow-hidden flex flex-col items-start p-4.5 rounded-[28px] border bg-white/[0.01] backdrop-blur-xl transition-all duration-300 shadow-xl cursor-pointer text-left",
                card.color,
                card.glow
              )}
              style={{ minHeight: '130px', minWidth: '44px' }}
            >
              {/* Tactile indicator glow */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-current opacity-0 group-hover:opacity-[0.03] group-active:opacity-[0.05] rounded-bl-[100%] transition-opacity duration-300" />
              
              <div className="flex items-center justify-between w-full mb-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform duration-300">
                  <card.icon className="w-4.5 h-4.5" />
                </div>
                <div className="w-2 h-2 rounded-full bg-current opacity-40 shadow-sm" />
              </div>
              
              <span className="text-xs font-black tracking-tight text-white/90 group-hover:text-white transition-colors duration-300">{card.label}</span>
              <span className="text-[9px] text-[#8e8e93] font-medium leading-tight mt-1 line-clamp-2">{card.description}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ─── Section: Module Navigation Grid ─── */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e8e93]">Module Matrix</h3>
          <Layers className="w-3.5 h-3.5 text-[#8e8e93]" />
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {moduleButtons.map((mod, idx) => (
            <motion.button
              key={mod.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + (idx * 0.02) }}
              whileTap={{ scale: 0.92 }}
              onClick={() => navigateTo(mod.id as ModuleId)}
              className={cn(
                "flex flex-col items-center justify-center gap-3 py-4.5 rounded-[24px] bg-white/[0.02] border hover:bg-white/[0.05] border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer shadow-md",
                mod.accent
              )}
              style={{ minHeight: '88px', minWidth: '44px' }}
            >
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors duration-300">
                <mod.icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-[9px] font-extrabold tracking-wider uppercase text-white/70">{mod.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ─── Section: Quick Status / Telemetry ─── */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex items-center justify-center gap-6 px-6 py-4.5 rounded-[32px] bg-white/[0.02] border border-white/5 shadow-inner"
        style={{ minHeight: '52px' }}
      >
        <div className="flex flex-col items-center gap-1">
          <Cpu className="w-4 h-4 text-blue-400/50" />
          <span className="text-[8px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">CPU 12%</span>
        </div>
        <div className="w-px h-6 bg-white/5" />
        <div className="flex flex-col items-center gap-1">
          <Headphones className="w-4 h-4 text-indigo-400/50" />
          <span className="text-[8px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">Audio ON</span>
        </div>
        <div className="w-px h-6 bg-white/5" />
        <div className="flex flex-col items-center gap-1">
          <Share2 className="w-4 h-4 text-emerald-400/50 animate-pulse" />
          <span className="text-[8px] font-bold text-[#8e8e93] uppercase tracking-widest mt-0.5">Sync OK</span>
        </div>
      </motion.div>
    </div>
  );
}
