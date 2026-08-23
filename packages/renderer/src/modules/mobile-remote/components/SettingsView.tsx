/**
 * SettingsView — Mobile remote Settings tab.
 *
 * Surfaces desktop sleep/wake control:
 *   • Live desktop status (Active / Sleeping / Offline)
 *   • "Wake INDII" button (sends a [WAKE] command when the desktop is sleeping)
 *   • Sleep-mode toggle + auto-sleep timeout, persisted to
 *     users/{uid}/settings/remoteSettings (read by the desktop's useAutoSleep)
 *
 * Honest offline state: when the desktop process isn't running, there's no fake
 * wake — we tell the user to open INDII on their Mac.
 */

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Moon, Sun, Power, MonitorSmartphone, Check } from 'lucide-react';
import { auth, db } from '@/services/firebase';
import {
    isFreshStudioState,
    remoteRelayService,
    type DesktopState,
} from '@/services/agent/RemoteRelayService';
import {
    AUTO_SLEEP_TIMEOUT_OPTIONS,
    DEFAULT_REMOTE_SLEEP_SETTINGS,
    type RemoteSleepSettings,
} from '@/hooks/useAutoSleep';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../MobileRemote';

interface SettingsViewProps {
    desktopState: DesktopState | null;
    isPaired: boolean;
}

type DesktopStatus = 'active' | 'sleeping' | 'offline';

function resolveStatus(state: DesktopState | null): DesktopStatus {
    if (!isFreshStudioState(state)) return 'offline';
    return state?.sleepMode ? 'sleeping' : 'active';
}

function timeoutLabel(minutes: number): string {
    return minutes <= 0 ? 'Never' : `${minutes} min`;
}

export default function SettingsView({ desktopState, isPaired }: SettingsViewProps) {
    const [settings, setSettings] = useState<RemoteSleepSettings>(DEFAULT_REMOTE_SLEEP_SETTINGS);
    const [isWaking, setIsWaking] = useState(false);
    const wakeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const status = resolveStatus(desktopState);

    // Load settings reactively (desktop writes nothing here, but other devices might).
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const ref = doc(db, 'users', uid, 'settings', 'remoteSettings');
        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = snap.data();
                if (data) {
                    setSettings({
                        sleepEnabled: typeof data.sleepEnabled === 'boolean'
                            ? data.sleepEnabled
                            : DEFAULT_REMOTE_SLEEP_SETTINGS.sleepEnabled,
                        autoSleepMinutes: typeof data.autoSleepMinutes === 'number'
                            ? data.autoSleepMinutes
                            : DEFAULT_REMOTE_SLEEP_SETTINGS.autoSleepMinutes,
                    });
                }
            },
            (err) => logger.warn('[SettingsView] settings snapshot failed:', err)
        );
        return unsub;
    }, []);

    useEffect(() => {
        return () => {
            if (wakeResetTimeoutRef.current) {
                clearTimeout(wakeResetTimeoutRef.current);
                wakeResetTimeoutRef.current = null;
            }
        };
    }, []);

    const persist = async (next: RemoteSleepSettings) => {
        setSettings(next); // optimistic
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            await setDoc(
                doc(db, 'users', uid, 'settings', 'remoteSettings'),
                { ...next, updatedAt: serverTimestamp() },
                { merge: true }
            );
        } catch (err) {
            logger.error('[SettingsView] Failed to persist remote settings:', err);
        }
    };

    const handleWake = async () => {
        if (status !== 'sleeping' || isWaking) return;
        triggerHaptic(50);
        setIsWaking(true);
        try {
            await remoteRelayService.sendCommand('[WAKE]', undefined, undefined, 'studio');
            if (wakeResetTimeoutRef.current) clearTimeout(wakeResetTimeoutRef.current);
            // Heartbeat clears sleepMode within ~5s; release the button after a beat.
            wakeResetTimeoutRef.current = setTimeout(() => {
                setIsWaking(false);
                wakeResetTimeoutRef.current = null;
            }, 6000);
        } catch (err) {
            logger.error('[SettingsView] Wake command failed:', err);
            setIsWaking(false);
        }
    };

    const statusMeta: Record<DesktopStatus, { label: string; dot: string; copy: string }> = {
        active: {
            label: 'Active',
            dot: 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]',
            copy: 'INDII is awake and ready.',
        },
        sleeping: {
            label: 'Sleeping',
            dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
            copy: 'INDII is resting in the tray. Wake it to bring the window back.',
        },
        offline: {
            label: 'Offline',
            dot: 'bg-red-400',
            copy: "INDII isn't running — open it on your Mac.",
        },
    };
    const meta = statusMeta[status];

    return (
        <div className="space-y-6 pb-8 pt-4">
            <div className="px-2">
                <h2 className="text-2xl font-bold text-[#F0F0F0] tracking-tight mb-1">Settings</h2>
                <p className="text-sm text-[#a1a1a6] font-medium">Control how <span className="indii-name">indii</span> sleeps and wakes.</p>
            </div>

            {/* ─── Desktop Status + Wake ─────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[24px] bg-[#030303] border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2E2EFE]/10 text-[#2E2EFE] flex items-center justify-center">
                        <MonitorSmartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full', meta.dot)} />
                            <span className="text-sm font-bold text-[#F0F0F0]">{meta.label}</span>
                        </div>
                        <p className="text-[11px] text-[#8e8e93] font-medium leading-tight mt-0.5">{meta.copy}</p>
                    </div>
                </div>

                {status === 'sleeping' && (
                    <button
                        onClick={handleWake}
                        disabled={isWaking || !isPaired}
                        className={cn(
                            'w-full mt-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-300',
                            isWaking
                                ? 'bg-[#2E2EFE]/40 text-white/70 cursor-wait'
                                : 'bg-[#2E2EFE] text-white hover:bg-[#2E2EFE]/90 shadow-[0_4px_20px_rgba(46,46,254,0.3)]'
                        )}
                    >
                        <Power className="w-4 h-4" />
                        {isWaking ? 'Waking INDII…' : 'Wake INDII'}
                    </button>
                )}
            </motion.div>

            {/* ─── Studio Capabilities (Phase 5) ──────────────────────── */}
            {status !== 'offline' && desktopState?.capabilities && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 }}
                    className="rounded-[24px] bg-[#030303] border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                >
                    <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest mb-3">
                        Studio capabilities
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {([
                            ['agent', 'Agents'],
                            ['computer', 'Computer control'],
                            ['audio', 'Local audio'],
                            ['daw', 'DAW'],
                            ['ui', 'Screen'],
                        ] as const).map(([key, label]) => {
                            const available = desktopState.capabilities![key];
                            return (
                                <span
                                    key={key}
                                    className={cn(
                                        'px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                                        available
                                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                            : 'text-[#636366] bg-white/[0.03] border-white/5 line-through'
                                    )}
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-[#636366] leading-relaxed mt-3">
                        Unavailable capabilities stay greyed out — your Studio is reachable but that
                        operation needs the desktop app or isn't supported here.
                    </p>
                </motion.div>
            )}

            {/* ─── Sleep Mode ─────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-[24px] bg-[#030303] border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            >
                <button
                    onClick={() => { triggerHaptic(40); persist({ ...settings, sleepEnabled: !settings.sleepEnabled }); }}
                    className="w-full flex items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2E2EFE]/10 text-[#2E2EFE] flex items-center justify-center">
                            {settings.sleepEnabled ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-[#F0F0F0]">Auto-sleep</p>
                            <p className="text-[11px] text-[#8e8e93] font-medium leading-tight mt-0.5">
                                Rest to the tray after a quiet stretch
                            </p>
                        </div>
                    </div>
                    <span
                        className={cn(
                            'relative w-12 h-7 rounded-full transition-colors duration-300 flex-shrink-0',
                            settings.sleepEnabled ? 'bg-[#2E2EFE]' : 'bg-white/10'
                        )}
                    >
                        <span
                            className={cn(
                                'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform duration-300',
                                settings.sleepEnabled ? 'translate-x-6' : 'translate-x-1'
                            )}
                        />
                    </span>
                </button>

                {settings.sleepEnabled && (
                    <div className="mt-5 pt-5 border-t border-white/5">
                        <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest mb-3">
                            Sleep after
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                            {AUTO_SLEEP_TIMEOUT_OPTIONS.map((minutes) => {
                                const selected = settings.autoSleepMinutes === minutes;
                                return (
                                    <button
                                        key={minutes}
                                        onClick={() => { triggerHaptic(30); persist({ ...settings, autoSleepMinutes: minutes }); }}
                                        className={cn(
                                            'relative px-2 py-3 rounded-xl text-xs font-bold transition-all duration-200 border',
                                            selected
                                                ? 'bg-[#2E2EFE]/15 border-[#2E2EFE]/50 text-[#2E2EFE]'
                                                : 'bg-white/[0.02] border-white/10 text-[#a1a1a6] hover:border-white/20'
                                        )}
                                    >
                                        {selected && <Check className="w-3 h-3 absolute top-1.5 right-1.5" />}
                                        {timeoutLabel(minutes)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </motion.div>

            <p className="px-3 text-[11px] text-[#636366] leading-relaxed">
                Waking works while INDII is running in the background on your Mac. If you fully quit it,
                open it on the Mac to reconnect.
            </p>
        </div>
    );
}
