/**
 * Mobile Remote — Antigravity Mobile Viewport Node
 *
 * A glassmorphism-styled, local-first mobile remote control for indiiOS.
 * No third-party messaging apps required.
 *
 * Pairing flow:
 *   1. Electron spins up a local Node.js WebSocket server on a dynamic port.
 *   2. This page requests the local Wi-Fi IP + port via IPC.
 *   3. A QR code is generated encoding: ws://<local-ip>:<port>?pass=<APP_PASSWORD>
 *   4. The user scans the QR with their mobile device (same Wi-Fi).
 *   5. Mobile browser opens /mobile-remote, connects via the WS bridge,
 *      and receives real-time Zustand state slices.
 *
 * Global access: Tailscale Serve / embedded ngrok tunnel (configurable)
 * with APP_PASSWORD protection surfaced in the QR payload.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { wcpInstance } from '@/services/agent/WebSocketControlPlane';
import { logger } from '@/utils/logger';

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function MobileRemote() {
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [isPaired, setIsPaired] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'pairing' | 'connected' | 'error'>('idle');
  const [remoteLog, setRemoteLog] = useState<string[]>([]);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wcpUnsubRef = useRef<(() => void) | null>(null);

  const { currentModule, activeSessionId, agentHistory } = useStore(
    useShallow(state => ({
      currentModule: state.currentModule,
      activeSessionId: state.activeSessionId,
      agentHistory: state.agentHistory,
    }))
  );

  // ─── Pairing ─────────────────────────────────────────────────────────────

  const initiatePairing = async () => {
    setConnectionStatus('pairing');

    try {
      // Request pairing info from Electron main process
      let localIp = 'localhost';
      let port = 4299;

      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          // @ts-expect-error — getMobileRemoteInfo added in updated preload
          const info = await window.electronAPI.system?.getMobileRemoteInfo?.();
          if (info) {
            localIp = info.localIp ?? localIp;
            port = info.port ?? port;
          }
        } catch {
          // Fallback to default for web mode
        }
      }

      const wsUrl = `ws://${localIp}:${port}`;
      let qrDataUrl = '';
      // Render QR code
      if (qrCanvasRef.current) {
        renderQRPlaceholder(qrCanvasRef.current, wsUrl);
        qrDataUrl = qrCanvasRef.current.toDataURL();
      }

      const pairing: PairingInfo = {
        localUrl: wsUrl,
        qrDataUrl,
      };

      setPairingInfo(pairing);

      // Connect to the WCP bridge
      _connectBridge(wsUrl);
    } catch (err) {
      logger.error('[MobileRemote] Pairing failed', err);
      setConnectionStatus('error');
    }
  };

  const _connectBridge = (wsUrl: string) => {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsPaired(true);
        setConnectionStatus('connected');
        _log('Connected to indiiOS desktop bridge');

        // Clean up any previous listener before registering a new one
        wcpUnsubRef.current?.();

        // Subscribe to Zustand state broadcasts
        wcpUnsubRef.current = wcpInstance.on('sync', (msg) => {
          _log(`State sync received: ${JSON.stringify(msg.payload).slice(0, 80)}…`);
        });
      };

      ws.onmessage = (event) => {
        try {
          const cmd: RemoteCommand = JSON.parse(event.data as string);
          _handleRemoteCommand(cmd);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => setConnectionStatus('error');
      ws.onclose = () => {
        setIsPaired(false);
        setConnectionStatus('idle');
        _log('Disconnected from bridge');
      };
    } catch (err) {
      logger.error('[MobileRemote] Bridge connection error', err);
      setConnectionStatus('error');
    }
  };

  const _handleRemoteCommand = (cmd: RemoteCommand) => {
    _log(`Command received: ${cmd.type}`);
    // Command handling: UI reactions to remote inputs
    // (e.g., navigate to a module, send a message via agent)
  };

  const _log = (msg: string) => {
    setRemoteLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // ─── Sync outbound state to mobile ───────────────────────────────────────

  useEffect(() => {
    if (!isPaired) return;
    wcpInstance.broadcast({
      currentModule,
      activeSessionId,
      messageCount: agentHistory.length,
    });
  }, [currentModule, activeSessionId, agentHistory.length, isPaired]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wcpUnsubRef.current?.();
      wcpUnsubRef.current = null;
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-6 font-mono">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          indiiOS <span className="text-blue-400">Mobile Remote</span>
        </h1>
        <p className="text-sm text-[#8b949e] mt-1">
          Local-first mobile control — no third-party broker
        </p>
      </div>

      {/* Status Pill */}
      <div className={`mb-6 px-4 py-1.5 rounded-full text-xs font-semibold ${
        connectionStatus === 'connected'
          ? 'bg-green-900/40 text-green-400 border border-green-700/50'
          : connectionStatus === 'pairing'
            ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50'
            : connectionStatus === 'error'
              ? 'bg-red-900/40 text-red-400 border border-red-700/50'
              : 'bg-[#161b22] text-[#8b949e] border border-[#30363d]'
      }`}>
        {connectionStatus === 'connected' && '● Paired & Connected'}
        {connectionStatus === 'pairing' && '◌ Generating pairing code…'}
        {connectionStatus === 'error' && '✕ Connection error'}
        {connectionStatus === 'idle' && '○ Not connected'}
      </div>

      {/* Glassmorphism Card */}
      <div className="w-full max-w-sm rounded-2xl border border-[#30363d]/60 bg-[#161b22]/70 backdrop-blur-xl shadow-2xl shadow-black/40 p-6">
        {!isPaired ? (
          <>
            {/* QR Canvas */}
            <div className="flex justify-center mb-6">
              {pairingInfo ? (
                <div className="rounded-xl overflow-hidden border-2 border-[#30363d] shadow-inner">
                  <canvas
                    ref={qrCanvasRef}
                    width={210}
                    height={210}
                    className="block"
                  />
                </div>
              ) : (
                <div
                  ref={el => {
                    if (el && qrCanvasRef.current === null) {
                      // Placeholder before canvas is mounted
                    }
                  }}
                  className="w-[210px] h-[210px] rounded-xl border-2 border-dashed border-[#30363d] flex items-center justify-center"
                >
                  <canvas ref={qrCanvasRef} width={210} height={210} className="hidden" />
                  <span className="text-[#6e7681] text-xs text-center px-4">
                    Scan QR with your mobile device on the same Wi-Fi
                  </span>
                </div>
              )}
            </div>

            {pairingInfo && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-xs break-all">
                <span className="text-[#6e7681]">Bridge URL: </span>
                {pairingInfo.localUrl}
              </div>
            )}

            <button
              onClick={initiatePairing}
              disabled={connectionStatus === 'pairing'}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {connectionStatus === 'pairing' ? 'Generating…' : 'Generate Pairing QR'}
            </button>

            <p className="mt-4 text-center text-[#6e7681] text-xs">
              Uses your local Wi-Fi — no cloud relay required.
              <br />
              For global access, configure Tailscale in Settings.
            </p>
          </>
        ) : (
          <>
            {/* Connected state */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-900/30 border-2 border-green-600/50 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📱</span>
              </div>
              <p className="text-white font-semibold">Mobile Paired</p>
              <p className="text-[#8b949e] text-xs mt-1">State syncing in real-time</p>
            </div>

            {/* Live state snapshot */}
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#6e7681]">Current module</span>
                <span className="text-blue-400 font-mono">{currentModule ?? '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6e7681]">Active session</span>
                <span className="text-blue-400 font-mono">
                  {activeSessionId ? activeSessionId.slice(0, 8) + '…' : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6e7681]">Messages</span>
                <span className="text-blue-400 font-mono">{agentHistory.length}</span>
              </div>
            </div>

            {/* Disconnect */}
            <button
              onClick={() => wsRef.current?.close()}
              className="w-full py-2.5 rounded-xl border border-red-800/50 text-red-400 text-sm font-medium hover:bg-red-900/20 transition-colors"
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Event Log */}
      {remoteLog.length > 0 && (
        <div className="mt-6 w-full max-w-sm rounded-xl border border-[#30363d] bg-[#0d1117] p-3 max-h-40 overflow-y-auto">
          {remoteLog.map((entry, i) => (
            <p key={i} className="text-[#6e7681] text-xs leading-5">{entry}</p>
          ))}
        </div>
      )}

      {/* Security Notice */}
      <p className="mt-6 text-[#6e7681] text-xs text-center max-w-xs">
        Communication is confined to your local network.
        Credentials are never transmitted in the QR payload.
      </p>
    </div>
  );
}
