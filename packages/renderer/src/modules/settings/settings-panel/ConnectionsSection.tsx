/**
 * Connected Services Settings Section
 *
 * Manages email integrations (Gmail, Outlook) and push notification tokens.
 * Uses OAuth 2.0 flow via EmailService for secure account linking.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Mail,
    Smartphone,
    Bell,
    Check,
    RefreshCw,
    ExternalLink,
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { pushNotificationService } from '@/services/notifications/PushNotificationService';
import { EmailService } from '@/services/email/EmailService';
import type { EmailAccount } from '@/services/email/types';
import { SectionHeader, SettingRow } from './SettingsShared';

const ConnectionsSection: React.FC = () => {
    const { showToast } = useToast();
    const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<string | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            const accounts = await EmailService.getConnectedAccounts();
            setEmailAccounts(accounts);
        } catch {
            // No accounts yet — that's fine
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const handleConnect = async (provider: 'gmail' | 'outlook') => {
        setConnecting(provider);
        try {
            await EmailService.connectAccount(provider);
            await loadAccounts();
            showToast(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} connected`, 'success');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(message || 'Connection failed', 'error');
        } finally {
            setConnecting(null);
        }
    };

    const handleDisconnect = async (provider: 'gmail' | 'outlook') => {
        try {
            await EmailService.disconnectAccount(provider);
            await loadAccounts();
            showToast(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} disconnected`, 'success');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showToast(message || 'Disconnection failed', 'error');
        }
    };

    const isConnected = (provider: string) => emailAccounts.some(a => a.provider === provider);

    return (
        <div>
            <SectionHeader
                title="Connected Services"
                description="Manage email integrations and linked accounts."
            />

            <div className="space-y-1">
                {/* Gmail */}
                <SettingRow
                    icon={Mail}
                    label="Gmail"
                    description={isConnected('gmail')
                        ? emailAccounts.find(a => a.provider === 'gmail')?.email || 'Connected'
                        : 'Not connected'
                    }
                >
                    {isConnected('gmail') ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <Check size={12} /> Connected
                            </span>
                            <button
                                onClick={() => handleDisconnect('gmail')}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('gmail')}
                            disabled={connecting === 'gmail'}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {connecting === 'gmail' ? (
                                <RefreshCw size={12} className="animate-spin" />
                            ) : (
                                <ExternalLink size={12} />
                            )}
                            Connect
                        </button>
                    )}
                </SettingRow>

                {/* Outlook */}
                <SettingRow
                    icon={Mail}
                    label="Outlook"
                    description={isConnected('outlook')
                        ? emailAccounts.find(a => a.provider === 'outlook')?.email || 'Connected'
                        : 'Not connected'
                    }
                >
                    {isConnected('outlook') ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <Check size={12} /> Connected
                            </span>
                            <button
                                onClick={() => handleDisconnect('outlook')}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('outlook')}
                            disabled={connecting === 'outlook'}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {connecting === 'outlook' ? (
                                <RefreshCw size={12} className="animate-spin" />
                            ) : (
                                <ExternalLink size={12} />
                            )}
                            Connect
                        </button>
                    )}
                </SettingRow>

                {/* Push Notifications Token */}
                <SettingRow
                    icon={Smartphone}
                    label="Push Notifications"
                    description="Browser/native push via Firebase Cloud Messaging"
                >
                    <button
                        onClick={async () => {
                            const token = await pushNotificationService.requestPermissionAndGetToken();
                            if (token) {
                                showToast('Push notifications enabled', 'success');
                            } else {
                                showToast('Push notifications blocked or unavailable', 'error');
                            }
                        }}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Bell size={12} /> Enable
                    </button>
                </SettingRow>
            </div>

            <p className="text-xs text-slate-600 mt-4">
                Connected accounts are secured via OAuth 2.0. Refresh tokens are stored server-side and never exposed to the browser.
            </p>
        </div>
    );
};

export default ConnectionsSection;
