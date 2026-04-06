/**
 * Mobile Remote — Phone Control Interface for indiiOS
 *
 * A glassmorphism-styled, phone-optimized remote control for the indiiOS studio.
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

import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { remoteRelayService, type DesktopState } from '@/services/agent/RemoteRelayService';
import { logger } from '@/utils/logger';
import {
  LayoutDashboard, Grip, MessageSquare, Image, Music2,
  CheckSquare, QrCode, Smartphone
} from 'lucide-react';

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
  icon: React.ElementType;
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
      return isDev ? window.location.origin + '/remote' : 'https://indiios-studio.web.app/remote';
    }
    return 'https://indiios-studio.web.app/remote';
  });

  useEffect(() => {
    // Only used to trigger side effects if needed, avoiding setState
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-3xl p-8 max-w-sm w-full flex flex-col items-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-6">
          <QrCode className="w-6 h-6 text-blue-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2 text-center">Mobile Remote</h2>
        <p className="text-[#8b949e] text-center text-sm mb-8 leading-relaxed">
          Scan this code with your phone. Since you are logged into indiiOS, it works from anywhere. No local Wi-Fi required.
        </p>

        <div className="bg-white p-4 rounded-2xl mb-8 shadow-inner flex items-center justify-center w-[200px] h-[200px]">
          {qrUrl ? (
            <QRCodeSVG value={qrUrl} size={168} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white text-sm font-semibold transition-colors active:scale-[0.98]"
        >
          Cancel
        </button>

        <p className="mt-4 text-center text-[#484f58] text-[10px]">
          Powered by indiiOS Cloud Relay
        </p>
      </div>
    </div>
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

  // Subscribe to Cloud Relay State
  useEffect(() => {
    // Wait for auth to be fully realized
    if (!remoteRelayService.isAuthenticated()) return;

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
  }, []);

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
    <div className="min-h-screen bg-[#0d1117] flex flex-col font-sans">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0d1117]/80 backdrop-blur-xl border-b border-[#30363d]/40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <h1 className="text-sm font-bold text-white tracking-tight">
              indii<span className="font-light">CONTROLLER</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isPaired && connectionStatus === 'connected' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-medium text-green-400 uppercase tracking-widest">
                  Online
                </span>
              </div>
            ) : connectionStatus === 'pairing' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span className="text-[10px] font-medium text-amber-400 uppercase tracking-widest">
                  Locating
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowPairingModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                  Link
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Body ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="p-4 pb-24 max-w-md mx-auto w-full">
          {!isPaired && connectionStatus === 'idle' ? (
            <div className="flex flex-col items-center justify-center mt-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-6">
                <Smartphone className="w-8 h-8 text-[#8b949e]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">Desktop Offline</h2>
              <p className="text-sm text-[#8b949e] mb-8 leading-relaxed px-4">
                Your indiiOS studio is offline. Launch the app on your computer to connect.
              </p>
              <button
                onClick={() => setShowPairingModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all active:scale-95 shadow-lg shadow-blue-900/20"
              >
                <QrCode className="w-5 h-5" />
                Show QR Code
              </button>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </main>

      {/* ─── Bottom Navigation Bar ──────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0d1117]/80 backdrop-blur-xl border-t border-[#30363d]/40 pb-safe">
        <div className="flex items-center justify-around px-2 min-h-[64px] max-w-md mx-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => isPaired && setActiveTab(tab.id)}
                disabled={!isPaired}
                className={`flex flex-col items-center justify-center w-14 h-12 gap-1.5 transition-all
                  ${!isPaired ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}
                  ${isActive ? 'text-blue-400' : 'text-[#8b949e] hover:text-[#c9d1d9]'}
                `}
              >
                <div className={`relative ${isActive ? 'scale-110 transition-transform' : ''}`}>
                  <tab.icon className={`w-[22px] h-[22px] ${isActive ? 'drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : ''}`} />
                  {isActive && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                  )}
                </div>
                <span className="text-[9px] font-medium tracking-wide">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── Modals ─────────────────────────────────────────────────────── */}
      {showPairingModal && (
        <PairingModal
          onClose={() => setShowPairingModal(false)}
        />
      )}
    </div>
  );
}
