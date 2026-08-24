/**
 * Mobile Remote — Mobile Control Interface for indii
 *
 * A glassmorphism-styled, touch-optimized remote control for the indii studio.
 * Functions as a companion device — not a full app rebuild.
 *
 * Features:
 *   • Status Dashboard — at-a-glance system status
 *   • Command Pad — quick-action module navigation
 *   • Agent Chat — simplified mobile chat with indii Conductor
 *   • Generation Monitor — real-time Autonomous generation progress
 *   • Transport Bar — audio playback controls
 *   • Approval Queue — swipeable approve/reject cards
 *   • Automatic Reconnection — handles unexpected disconnections gracefully
 *
 * Access modes:
 *   • Cloud Relay mode: Subscribes to Firestore for true remote
 *     state synchronization anywhere on the internet.
 */

import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import {
  isFreshStudioState,
  remoteRelayService,
  studioStateFreshnessRemainingMs,
  type DesktopState,
} from '@/services/agent/RemoteRelayService';
import { auth } from '@/services/firebase';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { logger } from '@/utils/logger';
import {
  LayoutDashboard, LayoutGrid, Grip, MessageSquare, Navigation,
  CheckSquare, Smartphone, LucideIcon, WifiOff, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { getRemoteConnectionPhase } from './RemoteConnectionState';
import { isRemoteSurfaceDevice } from './routing';
import { useMobile } from '@/hooks/useMobile';

// Helper for haptic feedback
// eslint-disable-next-line react-refresh/only-export-components
export const triggerHaptic = (pattern: number | number[] = 50) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Lazy load sub-components for performance on remote devices
const StatusDashboard = lazy(() => import('./components/StatusDashboard'));
const QuickCaptureView = lazy(() => import('./components/QuickCaptureView'));
const StreamView = lazy(() => import('./components/StreamView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AgentChat = lazy(() => import('./components/AgentChat'));
const RoadMode = lazy(() =>
  import('@/modules/touring/components/RoadMode').then(module => ({ default: module.RoadMode }))
);

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = 'home' | 'capture' | 'boardroom' | 'road' | 'stream' | 'settings';

interface Tab {
  id: TabId;
  icon: LucideIcon;
  label: string;
}

const TABS: Tab[] = [
  { id: 'home', icon: LayoutDashboard, label: 'Home' },
  { id: 'capture', icon: MessageSquare, label: 'Capture' },
  { id: 'boardroom', icon: LayoutGrid, label: 'Boardroom' },
  { id: 'road', icon: Navigation, label: 'Road' },
  { id: 'stream', icon: CheckSquare, label: 'Stream' },
  { id: 'settings', icon: Grip, label: 'Settings' },
];

const TRANSIENT_HEARTBEAT_GRACE_MS = 10_000;

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
  const mobile = useMobile();
  const looksLikeRemoteDevice = isRemoteSurfaceDevice(mobile);
  const [isPaired, setIsPaired] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'pairing' | 'connected' | 'error'>(() =>
    remoteRelayService.isAuthenticated() ? 'pairing' : 'idle'
  );
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const controllerBuild = (import.meta.env.VITE_BUILD_SHA || 'development').slice(0, 9);

  // Reconnection state machine
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [subscriptionEpoch, setSubscriptionEpoch] = useState(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stalePresenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transientHeartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pairingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track auth readiness to re-subscribe when auth becomes available
  const [isAuth, setIsAuth] = useState(() => remoteRelayService.isAuthenticated());

  // Listen to Auth State changes reactively
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const authenticated = !!user;
      setIsAuth(authenticated);
      if (authenticated) {
        setConnectionStatus(prev => prev === 'idle' ? 'pairing' : prev);
      } else {
        setConnectionStatus('idle');
        setIsPaired(false);
      }
    });
    return unsub;
  }, []);

  // Redeem handoff code on mount if present in URL query string
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (!code) return;

    // Validate 64-hex format for security (ISSUE-376)
    if (!/^[a-fA-F0-9]{64}$/.test(code)) {
      logger.warn('[MobileRemote] Invalid handoff code format');
      setHandoffError('This pairing link is invalid. Generate a new link from Desktop Studio → Settings → Mobile Remote.');
      setConnectionStatus('error');
      return;
    }

    logger.info('[MobileRemote] Found handoff code in URL, redeeming...');
    setConnectionStatus('pairing');
    setHandoffError(null);

    const redeem = async () => {
      try {
        const { endpointService } = await import('@/core/config/EndpointService');
        const redeemUrl = endpointService.getFunctionUrl('redeemHandoffCode');
        const response = await fetch(redeemUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json();
        if (data.customToken) {
          logger.info('[MobileRemote] Redeem success, signing in with custom token...');
          await signInWithCustomToken(auth, data.customToken);
          logger.info('[MobileRemote] Signed in successfully!');
          setHandoffError(null);
        } else {
          throw new Error('No customToken returned');
        }

        // Clean up URL query parameters
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (err) {
        logger.error('[MobileRemote] Failed to redeem handoff code:', err);
        setHandoffError('This pairing link expired or could not be redeemed. Generate a new link from Desktop Studio → Settings → Mobile Remote.');
        setConnectionStatus('error');
      }
    };

    redeem();
  }, []);

  // Keep refs of connection status to avoid tearing down subscription in useEffect
  const isPairedRef = useRef(isPaired);
  const connectionStatusRef = useRef(connectionStatus);
  const desktopStateRef = useRef<DesktopState | null>(null);
  const gracePeriodUntilRef = useRef<number>(0);

  useEffect(() => {
    isPairedRef.current = isPaired;
    connectionStatusRef.current = connectionStatus;
  }, [isPaired, connectionStatus]);

  // Subscribe to Cloud Relay State
  useEffect(() => {
    // Wait for auth to be fully realized
    if (!isAuth) return;

    logger.info('[MobileRemote] Subscribing to desktop state updates…');

    const markDesktopOffline = () => {
      const currentIsPaired = isPairedRef.current;
      const currentStatus = connectionStatusRef.current;

      // If the page is hidden, do NOT mark desktop offline yet, as the timer is throttled
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        logger.info('[MobileRemote] Page is hidden. Deferring offline state transition.');
        return;
      }

      if (currentIsPaired || currentStatus === 'connected') {
        if (transientHeartbeatTimeoutRef.current) return;

        logger.info('[MobileRemote] Desktop heartbeat stale. Holding paired state during transient grace window…');
        setConnectionStatus('pairing');
        transientHeartbeatTimeoutRef.current = setTimeout(() => {
          transientHeartbeatTimeoutRef.current = null;
          if (isFreshStudioState(desktopStateRef.current)) {
            setConnectionStatus('connected');
            setIsReconnecting(false);
            setReconnectAttempts(0);
            scheduleStalePresenceCheck(desktopStateRef.current);
            return;
          }

          logger.warn('[MobileRemote] Desktop heartbeat still stale after grace window. Initiating auto-reconnect sequence…');
          // Pairing is an authenticated relationship, not a heartbeat. Keep the
          // controls available in Standby so a durable command can wake Studio.
          setIsReconnecting(true);
          setConnectionStatus('pairing');
          setReconnectAttempts(1);
        }, TRANSIENT_HEARTBEAT_GRACE_MS);
      } else {
        setConnectionStatus('idle');
        setIsReconnecting(false);
      }
    };

    const scheduleStalePresenceCheck = (state: DesktopState | null) => {
      if (stalePresenceTimeoutRef.current) {
        clearTimeout(stalePresenceTimeoutRef.current);
        stalePresenceTimeoutRef.current = null;
      }

      const remainingMs = studioStateFreshnessRemainingMs(state);
      if (remainingMs <= 0) {
        markDesktopOffline();
        return;
      }

      stalePresenceTimeoutRef.current = setTimeout(() => {
        stalePresenceTimeoutRef.current = null;
        // Timers can fire a few milliseconds early. Re-check the canonical
        // freshness predicate and reschedule instead of losing the stale edge.
        if (isFreshStudioState(desktopStateRef.current)) {
          scheduleStalePresenceCheck(desktopStateRef.current);
          return;
        }
        markDesktopOffline();
      }, remainingMs);
    };

    const unsub = remoteRelayService.onDesktopState((state) => {
      setDesktopState(state);
      desktopStateRef.current = state;

      if (stalePresenceTimeoutRef.current) {
        clearTimeout(stalePresenceTimeoutRef.current);
        stalePresenceTimeoutRef.current = null;
      }

      const isVisible = typeof document === 'undefined' || document.visibilityState === 'visible';

      if (isFreshStudioState(state)) {
        if (transientHeartbeatTimeoutRef.current) {
          clearTimeout(transientHeartbeatTimeoutRef.current);
          transientHeartbeatTimeoutRef.current = null;
        }
        setIsPaired(true);
        setConnectionStatus('connected');
        setIsReconnecting(false);
        setReconnectAttempts(0);
        
        if (isVisible) scheduleStalePresenceCheck(state);
      } else {
        // If state is not fresh, only trigger offline/standby transition if visible AND we are past the grace period
        if (isVisible && Date.now() > gracePeriodUntilRef.current) {
          markDesktopOffline();
        }
      }
    }, (error) => {
      logger.error('[MobileRemote] Desktop state subscription failed:', error);
      setConnectionStatus('error');
      setIsReconnecting(false);
    });

    // Visibility change listener to handle remote sleep/wake
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      
      if (document.visibilityState === 'visible') {
        logger.info('[MobileRemote] App regained visibility. Refreshing connection state...');
        if (stalePresenceTimeoutRef.current) {
          clearTimeout(stalePresenceTimeoutRef.current);
          stalePresenceTimeoutRef.current = null;
        }
        
        setIsReconnecting(false);
        setReconnectAttempts(0);
        
        // Set the grace period for 15 seconds
        gracePeriodUntilRef.current = Date.now() + 15000;
        
        // Wait 15 seconds for Firestore sync before checking presence
        stalePresenceTimeoutRef.current = setTimeout(() => {
          stalePresenceTimeoutRef.current = null;
          logger.info('[MobileRemote] Delayed visibility check running...');
          if (isFreshStudioState(desktopStateRef.current)) {
            scheduleStalePresenceCheck(desktopStateRef.current);
          } else {
            markDesktopOffline();
          }
        }, 15000);
      } else {
        if (stalePresenceTimeoutRef.current) {
          clearTimeout(stalePresenceTimeoutRef.current);
          stalePresenceTimeoutRef.current = null;
        }
        if (transientHeartbeatTimeoutRef.current) {
          clearTimeout(transientHeartbeatTimeoutRef.current);
          transientHeartbeatTimeoutRef.current = null;
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      unsub();
      if (stalePresenceTimeoutRef.current) {
        clearTimeout(stalePresenceTimeoutRef.current);
        stalePresenceTimeoutRef.current = null;
      }
      if (transientHeartbeatTimeoutRef.current) {
        clearTimeout(transientHeartbeatTimeoutRef.current);
        transientHeartbeatTimeoutRef.current = null;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [isAuth, subscriptionEpoch]);

  // Handle active retry polling for reconnects
  useEffect(() => {
    if (!isReconnecting) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    if (reconnectAttempts > maxReconnectAttempts) {
      logger.warn('[MobileRemote] Active reconnection window ended. Remaining in Standby.');
      queueMicrotask(() => {
        setIsReconnecting(false);
        setConnectionStatus(isPairedRef.current ? 'pairing' : 'idle');
      });
      return;
    }

    // Schedule next reconnection attempt after progressive backoff
    const delay = Math.min(2000 + reconnectAttempts * 1000, 6000);
    logger.info(`[MobileRemote] Auto-reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms…`);

    reconnectTimeoutRef.current = setTimeout(() => {
      setSubscriptionEpoch(epoch => epoch + 1);
      setReconnectAttempts(prev => prev + 1);
    }, delay);

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isReconnecting, reconnectAttempts]);

  // Safety timeout: if stuck in 'pairing' for >10s initially, fall back to 'idle'
  useEffect(() => {
    if (connectionStatus === 'pairing' && !isReconnecting && !isPaired) {
      pairingTimeoutRef.current = setTimeout(() => {
        setConnectionStatus('idle');
        setIsPaired(false);
        // ISSUE-1290: this used to drop silently back to 'idle' with the reason only
        // in a log line the user never sees — the phone just bounced back to the
        // pairing screen as if nothing had happened, which is indistinguishable from
        // "the code didn't work". By this point the code HAS worked and sign-in HAS
        // succeeded; the one missing piece is a Studio publishing executor presence,
        // so say exactly that instead of leaving the user to guess.
        setHandoffError(
          'Paired successfully, but no Studio is online to connect to. Open the indii desktop app on your computer and sign in — a browser tab cannot act as the Studio.'
        );
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
  }, [connectionStatus, isReconnecting, isPaired]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendCommand = useCallback((command: { type: string; payload: any }) => {
    if (!isPaired) {
      logger.warn('[MobileRemote] Cannot send command: Remote not paired or reconnecting');
      return;
    }

    let commandStr = '';

    if (command.type === 'navigate') {
      commandStr = `[NAVIGATE] ${command.payload.module || ''}`;
    } else if (command.type === 'agent_action') {
      commandStr = `[AGENT_ACTION] ${command.payload.action || ''}`;
    } else if (command.type === 'daw_control') {
      commandStr = `[DAW_CONTROL] ${command.payload.action || ''}`;
    } else if (command.type === 'media_playback') {
      commandStr = `[MEDIA_PLAYBACK] ${command.payload.action || ''}`;
    } else {
      commandStr = `[RAW] ${JSON.stringify(command)}`;
    }

    remoteRelayService.sendCommand(commandStr, undefined, undefined, 'studio').catch(err => {
      logger.error('[MobileRemote] Failed to send command to relay:', err);
    });
  }, [isPaired]);

  const handleManualRetry = () => {
    triggerHaptic(50);
    logger.info('[MobileRemote] Manual reconnect triggered by user');
    if (stalePresenceTimeoutRef.current) {
      clearTimeout(stalePresenceTimeoutRef.current);
      stalePresenceTimeoutRef.current = null;
    }
    if (transientHeartbeatTimeoutRef.current) {
      clearTimeout(transientHeartbeatTimeoutRef.current);
      transientHeartbeatTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    gracePeriodUntilRef.current = 0;
    setSubscriptionEpoch(epoch => epoch + 1);
    setReconnectAttempts(1);
    setIsReconnecting(true);
    setConnectionStatus('pairing');
  };

  // Pull-to-refresh logic
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mainRef.current && mainRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current > 0) {
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) {
        setPullProgress(Math.min(delta / 2, 80));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullProgress > 60 && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic([50, 100, 50]);
      handleManualRetry();
      if (refreshFeedbackTimeoutRef.current) {
        clearTimeout(refreshFeedbackTimeoutRef.current);
      }
      refreshFeedbackTimeoutRef.current = setTimeout(() => {
         setIsRefreshing(false);
         setPullProgress(0);
         refreshFeedbackTimeoutRef.current = null;
      }, 1500);
    } else {
      setPullProgress(0);
    }
    touchStartY.current = 0;
  };

  useEffect(() => {
    return () => {
      if (refreshFeedbackTimeoutRef.current) {
        clearTimeout(refreshFeedbackTimeoutRef.current);
        refreshFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  const connectionPhase = getRemoteConnectionPhase({
    authenticated: isAuth,
    paired: isPaired,
    reconnecting: isReconnecting,
    status: connectionStatus,
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Suspense fallback={<TabFallback />}>
            <div className="space-y-6 pt-4">
              <StatusDashboard connectionStatus={connectionStatus} isPaired={isPaired} onTabChange={setActiveTab} />
            </div>
          </Suspense>
        );
      case 'capture':
        return (
          <Suspense fallback={<TabFallback />}>
            <QuickCaptureView isPaired={isPaired} />
          </Suspense>
        );
      case 'boardroom':
        return (
          <Suspense fallback={<TabFallback />}>
            <AgentChat onSendCommand={sendCommand} isPaired={isPaired} />
          </Suspense>
        );
      case 'road':
        return (
          <Suspense fallback={<TabFallback />}>
            <RoadMode />
          </Suspense>
        );
      case 'stream':
        return (
          <Suspense fallback={<TabFallback />}>
            <StreamView />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<TabFallback />}>
            <SettingsView desktopState={desktopState} isPaired={isPaired} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-connection-phase={connectionPhase}
      className="h-[100dvh] min-h-[100dvh] bg-black text-white flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden relative"
    >
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
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay indii-noise-overlay" />
      </div>

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-black/40 backdrop-blur-2xl border-b border-white/5"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">
              indii<span className="font-light opacity-60 uppercase tracking-widest text-[10px] ml-1">CONTROLLER</span>
            </h1>
          </motion.div>

          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {isPaired ? (
                connectionStatus === 'connected' ? (
                  desktopState?.sleepMode ? (
                    <motion.div
                      key="sleeping"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.15em]">
                        Sleeping
                      </span>
                    </motion.div>
                  ) : (
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
                  )
                ) : (
                  <motion.div
                    key="standby"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-500/10 border border-zinc-500/20"
                  >
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em]">
                      Standby
                    </span>
                  </motion.div>
                )
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20"
                >
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-[0.15em]">
                    Unpaired
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ─── Body ───────────────────────────────────────────────────────── */}
      <main 
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth relative z-10 custom-scrollbar"
      >
        <div
          className="p-6 max-w-md mx-auto w-full relative"
          style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom))' }}
        >
          
          {/* Pull-to-refresh visualizer */}
          <div 
            className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-opacity duration-300"
            style={{ 
              height: `${Math.max(0, pullProgress)}px`,
              opacity: pullProgress > 10 ? 1 : 0
            }}
          >
            <div 
              className={cn(
                "rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md shadow-lg border border-white/20 transition-all",
                isRefreshing ? "size-10 animate-spin" : "size-8"
              )}
              style={{
                transform: `scale(${Math.min(1, pullProgress / 60)}) rotate(${pullProgress * 3}deg)`
              }}
            >
              <RefreshCw className={cn("text-white", isRefreshing ? "w-5 h-5" : "w-4 h-4")} />
            </div>
          </div>

          {/* Glassmorphic Auto-Reconnecting Indicator */}
          <AnimatePresence>
            {isReconnecting && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 rounded-[24px] bg-linear-to-r from-amber-500/10 via-[#1c1c1e] to-amber-500/5 border border-amber-500/20 shadow-[0_15px_30px_rgba(245,158,11,0.08)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Session Connection Interrupted</h4>
                    <p className="text-[10px] text-[#8e8e93] font-medium mt-0.5">Attempting seamless handshake recovery…</p>
                  </div>
                </div>
                <div className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                  {reconnectAttempts}/{maxReconnectAttempts}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isPaired && (connectionStatus === 'idle' || connectionStatus === 'error') && !isReconnecting ? (
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
              
              <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                {handoffError ? 'Pairing Failed' : 'Studio Disconnected'}
              </h2>
              <p className="text-base text-[#a1a1a6] mb-10 leading-relaxed px-6 font-medium">
                {handoffError ?? 'Your indii studio is currently offline. Launch the desktop application to restore control, or click below to manually retry.'}
              </p>
              
              {!handoffError && (
                <div className="flex flex-col gap-4 w-full px-6">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleManualRetry}
                  className="group flex items-center justify-center gap-3 w-full h-14 rounded-[20px] bg-white/5 border border-white/10 text-white font-bold transition-all hover:bg-white/10 shadow-lg cursor-pointer"
                  style={{ minHeight: '56px' }}
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Reconnecting Now
                </motion.button>
                </div>
              )}
              
              <p
                data-testid="controller-build"
                className="mt-12 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300"
              >
                Controller build {controllerBuild}
              </p>

              {!looksLikeRemoteDevice && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="mt-4 text-xs font-medium text-[#8e8e93] underline underline-offset-4 hover:text-white transition-colors cursor-pointer"
                >
                  Not on your phone? Continue to indii Studio
                </button>
              )}
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

      <nav
        aria-label="Mobile Remote rooms"
        className="fixed bottom-0 inset-x-0 z-40 px-6 pointer-events-none"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-md mx-auto h-[72px] bg-white/3 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-around px-2 pointer-events-auto relative overflow-hidden">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-linear-to-b from-white/2 to-transparent pointer-events-none" />
          
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
                <button
                key={tab.id}
                onClick={() => {
                  if (isPaired) {
                    triggerHaptic(40);
                    setActiveTab(tab.id);
                  }
                }}
                disabled={!isPaired}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 cursor-pointer",
                  !isPaired ? "opacity-20 grayscale cursor-not-allowed" : "active:scale-90",
                  isActive ? "text-white" : "text-[#636366] hover:text-[#8e8e93]"
                )}
                style={{ minHeight: '56px' }}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-bg"
                      className="absolute inset-1.5 rounded-2xl bg-white/5"
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
    </div>
  );
}
