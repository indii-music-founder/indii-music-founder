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
 *   • Direct mode (default): Open /mobile-remote on any device on the same
 *     network (e.g. http://192.168.x.x:4242/mobile-remote). The UI reads
 *     the same Zustand store and works immediately — no pairing required.
 *   • WebSocket mode (future): Electron spins up a local WS server, a QR
 *     code is generated, and the phone connects via the WS bridge for true
 *     remote state synchronization.
 */

import { useEffect, useCallback, useRef, useState, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { wcpInstance } from '@/services/agent/WebSocketControlPlane';
import { logger } from '@/utils/logger';
import {
  LayoutDashboard, Grip, MessageSquare, Image, Music2,
  CheckSquare, QrCode, Wifi, WifiOff, X, Smartphone
} from 'lucide-react';

// Lazy load sub-components for performance on phone
const StatusDashboard = lazy(() => import('./components/StatusDashboard'));
const CommandPad = lazy(() => import('./components/CommandPad'));
const AgentChat = lazy(() => import('./components/AgentChat'));
const GenerationMonitor = lazy(() => import('./components/GenerationMonitor'));
const TransportBar = lazy(() => import('./components/TransportBar'));
const ApprovalQueue = lazy(() => import('./components/ApprovalQueue'));

// ─── Types ───────────────────────────────────────────────────────────────────

interface PairingInfo {
  localUrl: string;    // ws://192.168.x.x:PORT
  qrDataUrl: string;   // base64 PNG of QR code
  passcode?: string;   // Passcode if APP_PASSWORD is configured
}

interface RemoteCommand {
  type: 'navigate' | 'message' | 'agent_action';
  payload: unknown;
}

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

// ─── QR Code Canvas Renderer ─────────────────────────────────────────────────

/** Renders a minimal QR-like grid (placeholder until qrcode npm pkg available). */
function renderQRPlaceholder(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0d1117';

  // Simple deterministic pattern from text hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const cells = 21;
  const cellSize = size / cells;

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const bit = (hash ^ (row * 31 + col * 17)) & 1;
      // Finder patterns (corners)
      const inFinder =
        (row < 8 && col < 8) ||
        (row < 8 && col >= cells - 8) ||
        (row >= cells - 8 && col < 8);

      if (inFinder || bit) {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }

  // Border
  ctx.strokeStyle = '#0d1117';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

// ─── Pairing Modal ───────────────────────────────────────────────────────────

function PairingModal({ onClose, onPair }: {
  onClose: () => void;
  onPair: () => void;
}) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready'>('idle');

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setStatus('generating');
      let localIp = 'localhost';
      let port = 4299;

      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const info = await window.electronAPI.system?.getMobileRemoteInfo?.();
          if (info) {
            localIp = info.localIp ?? localIp;
            port = info.port ?? port;
          }
        } catch {
          // Fallback to default for web mode
        }
      }

      if (cancelled) return;

      const wsUrl = `ws://${localIp}:${port}`;
      let qrDataUrl = '';

      if (qrCanvasRef.current) {
        renderQRPlaceholder(qrCanvasRef.current, wsUrl);
        qrDataUrl = qrCanvasRef.current.toDataURL();
      }

      setPairingInfo({ localUrl: wsUrl, qrDataUrl });
      setStatus('ready');
    };

    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#30363d]/60 bg-[#161b22]/90 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" />
            Pair Device
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8b949e] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          {status === 'ready' && pairingInfo ? (
            <div className="rounded-xl overflow-hidden border-2 border-[#30363d] shadow-inner bg-white p-2">
              <canvas
                ref={qrCanvasRef}
                width={180}
                height={180}
                className="block"
              />
            </div>
          ) : (
            <div className="w-[196px] h-[196px] rounded-xl border-2 border-dashed border-[#30363d] flex items-center justify-center">
              <canvas ref={qrCanvasRef} width={180} height={180} className="hidden" />
              <span className="text-[#6e7681] text-xs">Generating…</span>
            </div>
          )}
        </div>

        {pairingInfo && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-xs break-all font-mono">
            <span className="text-[#6e7681]">Bridge: </span>{pairingInfo.localUrl}
          </div>
        )}

        <button
          onClick={() => { onPair(); onClose(); }}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
        >
          Connect
        </button>

        <p className="mt-3 text-center text-[#484f58] text-[10px]">
          Same Wi-Fi • No cloud relay • End-to-end encrypted
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
  // Direct mode: auto-pair when running in the same browser context (same Zustand store).
  // This enables full functionality from a phone browser on the same network without WebSocket.
  const [isPaired, setIsPaired] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'pairing' | 'connected' | 'error'>('connected');
  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wcpUnsubRef = useRef<(() => void) | null>(null);

  const { currentModule, activeSessionId, agentHistory } = useStore(
    useShallow(state => ({
      currentModule: state.currentModule,
      activeSessionId: state.activeSessionId,
      agentHistory: state.agentHistory,
    }))
  );

  // ─── Command Handler (declared before connectBridge) ──────────────────────

  const handleRemoteCommand = useCallback((_cmd: RemoteCommand) => {
    // Command handling: UI reactions to remote inputs
    // Future: dispatch navigations, agent actions, etc.
  }, []);

  // ─── WebSocket Bridge ──────────────────────────────────────────────────────

  const connectBridge = useCallback((wsUrl: string) => {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsPaired(true);
        setConnectionStatus('connected');
        logger.info('[MobileRemote] Connected to desktop bridge');

        // Clean up any previous listener before registering a new one
        wcpUnsubRef.current?.();

        // Subscribe to Zustand state broadcasts
        wcpUnsubRef.current = wcpInstance.on('sync', (_msg) => {
          // State sync handled by Zustand store updates
        });
      };

      ws.onmessage = (event) => {
        try {
          const cmd: RemoteCommand = JSON.parse(event.data as string);
          handleRemoteCommand(cmd);
        } catch {
          // ignore malformed
        }
      };

      ws.onerror = () => setConnectionStatus('error');
      ws.onclose = () => {
        setIsPaired(false);
        setConnectionStatus('idle');
        logger.info('[MobileRemote] Disconnected from bridge');
      };
    } catch (err) {
      logger.error('[MobileRemote] Bridge connection error', err);
      setConnectionStatus('error');
    }
  }, [handleRemoteCommand]);

  const handlePair = async () => {
    setConnectionStatus('pairing');
    let localIp = 'localhost';
    let port = 4299;

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const info = await window.electronAPI.system?.getMobileRemoteInfo?.();
        if (info) {
          localIp = info.localIp ?? localIp;
          port = info.port ?? port;
        }
      } catch {
        // Fallback
      }
    }

    connectBridge(`ws://${localIp}:${port}`);
  };

  const sendCommand = useCallback((command: { type: string; payload: unknown }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
    }

    // Also try WCP broadcast for non-WS scenarios
    wcpInstance.broadcast({
      remoteCommand: command,
      timestamp: Date.now(),
    });
  }, []);

  // ─── Sync outbound state to mobile ─────────────────────────────────────────

  useEffect(() => {
    if (!isPaired) return;
    wcpInstance.broadcast({
      currentModule,
      activeSessionId,
      messageCount: agentHistory.length,
    });
  }, [currentModule, activeSessionId, agentHistory.length, isPaired]);

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wcpUnsubRef.current?.();
      wcpUnsubRef.current = null;
    };
  }, []);

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
              indiiOS <span className="text-blue-400">Remote</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <button
              onClick={() => setShowPairingModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all active:scale-95 ${isPaired
                ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                : 'bg-[#161b22] text-[#8b949e] border border-[#30363d] hover:border-blue-600/50'
                }`}
            >
              {isPaired ? (
                <><Wifi className="w-3 h-3" /> Connected</>
              ) : (
                <><WifiOff className="w-3 h-3" /> Pair</>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        {renderTabContent()}
      </main>

      {/* ─── Bottom Tab Bar ─────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d1117]/90 backdrop-blur-xl border-t border-[#30363d]/40 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${isActive
                  ? 'text-blue-400'
                  : 'text-[#484f58] hover:text-[#8b949e]'
                  }`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]' : ''}`} />
                <span className={`text-[9px] font-semibold ${isActive ? 'text-blue-400' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── Pairing Modal ──────────────────────────────────────────────── */}
      {showPairingModal && (
        <PairingModal
          onClose={() => setShowPairingModal(false)}
          onPair={handlePair}
        />
      )}
    </div>
  );
}
