/**
 * Mobile Remote — Phone Control Interface for indii
 *
 * A glassmorphism-styled, phone-optimized remote control for the indii studio.
 * Functions as a companion device — not a full app rebuild.
 *
 * Features:
 *   • Status Dashboard — at-a-glance system status
 *   • Command Pad — quick-action module navigation
 *   • Agent Chat — simplified mobile chat with indii Conductor
 *   • Generation Monitor — real-time AI generation progress
 *   • Transport Bar — audio playback controls
 *   • Approval Queue — swipeable approve/reject cards
 *
 * Access modes:
 *   • Cloud Relay mode: Subscribes to Firestore for true remote
 *     state synchronization anywhere on the internet.
 */

import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import { remoteRelayService, type DesktopState } from '@/services/agent/RemoteRelayService';
import { logger } from '@/utils/logger';
import {
  LayoutDashboard, Grip, MessageSquare, Image, Music2,
  CheckSquare, QrCode, Smartphone, LucideIcon, Wifi, WifiOff, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Lazy load sub-components for performance on phone
const StatusDashboard = lazy(() => import('./components/StatusDashboard'));
const CommandPad = lazy(() => import('./components/CommandPad'));
const AgentChat = lazy(() => import('./components/AgentChat'));
const GenerationMonitor = lazy(() => import('./components/GenerationMonitor'));
const TransportBar = lazy(() => import('./components/TransportBar'));
const ApprovalQueue = lazy(() => import('./components/ApprovalQueue'));

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = 'status' | 'control' | 'chat' | 'generate' | 'transport' | 'approve';

interface Tab {
  id: TabId;
  icon: LucideIcon;
  label: string;
}

const TABS: Tab[] = [
  { id: 'status', icon: LayoutDashboard, label: 'Status' },
  { id: 'control', icon: Grip, label: 'Control' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'generate', icon: Image, label: 'Create' },
  { id: 'transport', icon: Music2, label: 'Audio' },
  { id: 'approve', icon: CheckSquare, label: 'Approve' },
];

// We import QRCodeRenderer dynamically so it doesn't inflate load times if not used
import { QRCodeSVG } from 'qrcode.react';

// ─── Pairing Modal (Cloud Relay version) ─────────────────────────────────────

function PairingModal({ onClose }: { onClose: () => void }) {
  const [qrUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.');
      return isDev ? window.location.origin + '/mobile-remote' : 'https://indii.music/mobile-remote';
    }
    return 'https://indii.music/mobile-remote';
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1c1c1e] border border-white/10 rounded-[32px] p-8 max-w-sm w-full flex flex-col items-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20">
          <QrCode className="w-7 h-7 text-blue-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">Connect Remote</h2>
        <p className="text-[#a1a1a6] text-center text-sm mb-8 leading-relaxed">
          Scan this code to link your phone. Once connected, you can control your studio from anywhere in the world.
        </p>

        <div className="bg-white p-5 rounded-3xl mb-8 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center justify-center w-[220px] h-[220px]">
          {qrUrl ? (
            <QRCodeSVG value={qrUrl} size={180} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
               <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-base font-semibold transition-all active:scale-[0.98]"
        >
          Close
        </button>

        <div className="mt-6 flex items-center gap-2 text-[#636366] text-[10px] font-medium uppercase tracking-[0.2em]">
          <span className="w-1 h-1 rounded-full bg-[#636366]" />
          Powered by indii Cloud Relay
          <span className="w-1 h-1 rounded-full bg-[#636366]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Tab Content Fallback ────────────────────────────────────────────────────

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MobileRemote() {
  const [isPaired, setIsPaired] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'pairing' | 'connected' | 'error'>(() =>
    remoteRelayService.isAuthenticated() ? 'pairing' : 'idle'
  );
  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [desktopState, setDesktopState] = useState<DesktopState | null>(null);

  // Track auth readiness to re-subscribe when auth becomes available
  const isAuth = remoteRelayService.isAuthenticated();

  // Subscribe to Cloud Relay State
  useEffect(() => {
    // Wait for auth to be fully realized
    if (!isAuth) return;

    const unsub = remoteRelayService.onDesktopState((state) => {
      setDesktopState(state);
      if (state && state.online) {
        setIsPaired(true);
        setConnectionStatus('connected');
      } else {
        setIsPaired(false);
        setConnectionStatus('idle'); // Desktop is offline
      }
    });

    return () => unsub();
  }, [isAuth]);

  // Safety timeout: if stuck in 'pairing' for >10s, fall back to 'idle'
  // This prevents the infinite spinner when the desktop state doc doesn't exist
  const pairingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (connectionStatus === 'pairing') {
      pairingTimeoutRef.current = setTimeout(() => {
        setConnectionStatus('idle');
        logger.info('[MobileRemote] Pairing timeout — desktop not found, falling back to idle');
      }, 10_000);
    } else {
      if (pairingTimeoutRef.current) {
        clearTimeout(pairingTimeoutRef.current);
        pairingTimeoutRef.current = null;
      }
    }
    return () => {
      if (pairingTimeoutRef.current) clearTimeout(pairingTimeoutRef.current);
    };
  }, [connectionStatus]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendCommand = useCallback((command: { type: string; payload: any }) => {
    if (!isPaired) return;

    let commandStr = '';

    if (command.type === 'navigate') {
      commandStr = `[NAVIGATE] ${command.payload.module || ''}`;
    } else if (command.type === 'agent_action') {
      commandStr = `[AGENT_ACTION] ${command.payload.action || ''}`;
    } else {
      commandStr = `[RAW] ${JSON.stringify(command)}`;
    }

    remoteRelayService.sendCommand(commandStr).catch(err => {
      logger.error('[MobileRemote] Failed to send command to relay:', err);
    });
  }, [isPaired]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'status':
        return (
          <Suspense fallback={<TabFallback />}>
            <StatusDashboard connectionStatus={connectionStatus} isPaired={isPaired} />
          </Suspense>
        );
      case 'control':
        return (
          <Suspense fallback={<TabFallback />}>
            <CommandPad onSendCommand={sendCommand} isPaired={isPaired} />
          </Suspense>
        );
      case 'chat':
        return (
          <Suspense fallback={<TabFallback />}>
            <AgentChat onSendCommand={sendCommand} isPaired={isPaired} />
          </Suspense>
        );
      case 'generate':
        return (
          <Suspense fallback={<TabFallback />}>
            <GenerationMonitor />
          </Suspense>
        );
      case 'transport':
        return (
          <Suspense fallback={<TabFallback />}>
            <TransportBar onSendCommand={sendCommand} isPaired={isPaired} />
          </Suspense>
        );
      case 'approve':
        return (
          <Suspense fallback={<TabFallback />}>
            <ApprovalQueue onSendCommand={sendCommand} isPaired={isPaired} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden relative">
      {/* ─── Premium Background ────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#0a0a0c]" />
        <div 
          className="absolute inset-0 opacity-40 mix-blend-soft-light"
          style={{ 
            backgroundImage: `radial-gradient(circle at 50% -20%, #1e293b 0%, transparent 50%), 
                              radial-gradient(circle at 0% 100%, #0c1117 0%, transparent 50%),
                              radial-gradient(circle at 100% 100%, #111827 0%, transparent 50%)`
          }} 
        />
        {/* Grain Texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-2xl border-b border-white/5 safe-top">
        <div className="flex items-center justify-between px-6 py-4">
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">
              indii<span className="font-light opacity-60 uppercase tracking-widest text-[10px] ml-1">CONTROLLER</span>
            </h1>
          </motion.div>

          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {isPaired && connectionStatus === 'connected' ? (
                <motion.div 
                  key="connected"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                >
                  <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" />
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-[0.15em]">
                    Active
                  </span>
                </motion.div>
              ) : connectionStatus === 'pairing' ? (
                <motion.div 
                  key="pairing"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20"
                >
                  <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.15em]">
                    Linking
                  </span>
                </motion.div>
              ) : (
                <motion.button
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setShowPairingModal(true)}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/20"
                >
                  <QrCode className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Link
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ─── Body ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative z-10 custom-scrollbar">
        <div className="p-6 pb-32 max-w-md mx-auto w-full">
          {!isPaired && connectionStatus === 'idle' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center mt-20 text-center"
            >
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative w-24 h-24 rounded-3xl bg-[#1c1c1e] border border-white/10 flex items-center justify-center shadow-2xl">
                  <WifiOff className="w-10 h-10 text-white/20" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Studio Disconnected</h2>
              <p className="text-base text-[#a1a1a6] mb-10 leading-relaxed px-6 font-medium">
                Your indii studio is currently offline. Please launch the app on your desktop to resume control.
              </p>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPairingModal(true)}
                className="group flex items-center gap-3 px-8 py-4 rounded-[20px] bg-white text-black font-bold transition-all hover:bg-[#f2f2f7] shadow-xl shadow-white/5"
              >
                <QrCode className="w-5 h-5" />
                Show Pairing Code
              </motion.button>
              
              <p className="mt-12 text-[#48484a] text-xs font-bold uppercase tracking-[0.2em]">
                Secure Cloud Relay v1.59
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderTabContent()}
            </motion.div>
          )}
        </div>
      </main>

      {/* ─── Premium Bottom Navigation ──────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 px-6 pb-safe-bottom mb-6 pointer-events-none">
        <div className="max-w-md mx-auto h-[72px] bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-around px-2 pointer-events-auto relative overflow-hidden">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => isPaired && setActiveTab(tab.id)}
                disabled={!isPaired}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300",
                  !isPaired ? "opacity-20 grayscale" : "active:scale-90",
                  isActive ? "text-white" : "text-[#636366] hover:text-[#8e8e93]"
                )}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-bg"
                      className="absolute inset-1.5 rounded-2xl bg-white/[0.05]"
                      initial={false}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </AnimatePresence>

                <div className={cn(
                  "relative z-10 transition-transform duration-300",
                  isActive && "-translate-y-0.5 scale-110"
                )}>
                  <tab.icon className={cn(
                    "w-6 h-6",
                    isActive ? "text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.4)]" : "text-inherit"
                  )} />
                </div>
                
                <span className={cn(
                  "relative z-10 text-[9px] font-bold uppercase tracking-widest transition-all duration-300",
                  isActive ? "opacity-100 scale-100" : "opacity-60 scale-90"
                )}>
                  {tab.label}
                </span>

                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute bottom-1.5 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" 
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── Modals ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPairingModal && (
          <PairingModal
            onClose={() => setShowPairingModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
