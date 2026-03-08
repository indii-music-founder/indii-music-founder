/**
 * DistributorCredentialsPanel
 *
 * Settings-accessible panel for configuring SFTP / API credentials for
 * each distributor adapter. Surfaces DistroKid-specific onboarding guidance
 * with step-by-step SFTP setup instructions.
 *
 * Item 214: DistroKid credential onboarding UI.
 */

import React, { useState, useEffect } from 'react';
import { Server, Key, Lock, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { DistributorService } from '@/services/distribution/DistributorService';
import { logger } from '@/utils/logger';

interface DistributorEntry {
    id: string;
    name: string;
    sftpHost: string;
    sftpPath: string;
    docsUrl: string;
    requiresApiKey: boolean;
    sftpGuide?: string[];
}

const SFTP_DISTRIBUTORS: DistributorEntry[] = [
    {
        id: 'distrokid',
        name: 'DistroKid',
        sftpHost: 'sftp.distrokid.com',
        sftpPath: '/incoming/{upc}',
        docsUrl: 'https://distrokid.com/help/sftp',
        requiresApiKey: false,
        sftpGuide: [
            'Log into your DistroKid account at distrokid.com',
            'Go to Account → Extras → Developer API',
            'Enable SFTP Access and copy your SFTP username',
            'Generate a new SFTP password and paste it below',
            'Enter the host: sftp.distrokid.com, Port: 22',
        ],
    },
    {
        id: 'symphonic',
        name: 'Symphonic',
        sftpHost: 'sftp.symphonicms.com',
        sftpPath: '/deliveries/{releaseId}',
        docsUrl: 'https://symphonicms.com/label-services',
        requiresApiKey: false,
        sftpGuide: [
            'Contact your Symphonic label manager for SFTP credentials',
            'They will provide: Host, Username, and Password',
            'Use Port 22 unless advised otherwise',
        ],
    },
    {
        id: 'cdbaby',
        name: 'CD Baby',
        sftpHost: 'sftp.cdbaby.com',
        sftpPath: '/upload/{releaseId}',
        docsUrl: 'https://support.cdbaby.com/hc/en-us',
        requiresApiKey: true,
        sftpGuide: [
            'Log into CD Baby Pro at members.cdbaby.com',
            'Navigate to Account Settings → API & Delivery',
            'Copy your API Key and SFTP credentials',
        ],
    },
    {
        id: 'onerpm',
        name: 'ONErpm',
        sftpHost: 'api.onerpm.com',
        sftpPath: '/v1/releases',
        docsUrl: 'https://developers.onerpm.com',
        requiresApiKey: true,
        sftpGuide: [
            'Log into ONErpm at onerpm.com',
            'Go to Settings → API Access',
            'Request API access from your label manager if not enabled',
            'Copy your API key from the Developer section',
        ],
    },
    {
        id: 'believe',
        name: 'Believe Digital',
        sftpHost: 'sftp.believe.fr',
        sftpPath: '/deliveries/{releaseId}',
        docsUrl: 'https://www.believe.com',
        requiresApiKey: true,
    },
];

interface CredentialFormState {
    apiKey: string;
    sftpUsername: string;
    sftpPassword: string;
    sftpPort: string;
}

export default function DistributorCredentialsPanel() {
    const [expanded, setExpanded] = useState<string | null>('distrokid');
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [forms, setForms] = useState<Record<string, CredentialFormState>>({});

    useEffect(() => {
        const initial: Record<string, CredentialFormState> = {};
        SFTP_DISTRIBUTORS.forEach(d => {
            initial[d.id] = { apiKey: '', sftpUsername: '', sftpPassword: '', sftpPort: '22' };
        });
        setForms(initial);
    }, []);

    const updateForm = (id: string, field: keyof CredentialFormState, value: string) => {
        setForms(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const handleSave = async (dist: DistributorEntry) => {
        const form = forms[dist.id];
        if (!form) return;

        setSaving(dist.id);
        setErrors(prev => ({ ...prev, [dist.id]: '' }));

        try {
            const credentials: Record<string, string | undefined> = {
                sftpHost: dist.sftpHost,
                sftpPort: form.sftpPort || '22',
                sftpUsername: form.sftpUsername || undefined,
                sftpPassword: form.sftpPassword || undefined,
                apiKey: form.apiKey || undefined,
            };

            await DistributorService.connect(dist.id as any, credentials);
            setSaved(prev => new Set([...prev, dist.id]));
            logger.info(`[DistributorCredentialsPanel] Saved credentials for ${dist.name}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save credentials';
            setErrors(prev => ({ ...prev, [dist.id]: msg }));
            logger.error(`[DistributorCredentialsPanel] Save failed for ${dist.name}:`, err);
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Server size={16} className="text-blue-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Distributor SFTP / API Credentials</h3>
                    <p className="text-[11px] text-gray-500">Configure secure delivery credentials. Stored in your system keychain.</p>
                </div>
            </div>

            {SFTP_DISTRIBUTORS.map((dist) => {
                const isExpanded = expanded === dist.id;
                const isSaved = saved.has(dist.id);
                const isSaving = saving === dist.id;
                const error = errors[dist.id];
                const form = forms[dist.id] || { apiKey: '', sftpUsername: '', sftpPassword: '', sftpPort: '22' };

                return (
                    <div
                        key={dist.id}
                        className={`border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-white/15 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01]'}`}
                    >
                        {/* Header row */}
                        <button
                            onClick={() => setExpanded(isExpanded ? null : dist.id)}
                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${isSaved ? 'bg-green-500' : 'bg-gray-600'}`} />
                                <span className="text-sm font-semibold text-white">{dist.name}</span>
                                {isSaved && (
                                    <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold uppercase tracking-wider">
                                        <CheckCircle2 size={10} />
                                        Connected
                                    </span>
                                )}
                            </div>
                            {isExpanded ? (
                                <ChevronDown size={16} className="text-gray-500" />
                            ) : (
                                <ChevronRight size={16} className="text-gray-600" />
                            )}
                        </button>

                        {/* Expanded form */}
                        {isExpanded && (
                            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                                {/* Step-by-step guide for DistroKid */}
                                {dist.sftpGuide && dist.sftpGuide.length > 0 && (
                                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Setup Guide</p>
                                        <ol className="space-y-1.5">
                                            {dist.sftpGuide.map((step, i) => (
                                                <li key={i} className="flex gap-2 text-[11px] text-gray-400">
                                                    <span className="text-blue-500 font-bold shrink-0">{i + 1}.</span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ol>
                                        <a
                                            href={dist.docsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 mt-2 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            Official Docs <ExternalLink size={9} />
                                        </a>
                                    </div>
                                )}

                                {/* SFTP connection info (read-only) */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 ml-1 block mb-1">Host</label>
                                        <div className="px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-[11px] text-gray-500 font-mono">
                                            {dist.sftpHost}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 ml-1 block mb-1">Port</label>
                                        <input
                                            type="text"
                                            value={form.sftpPort}
                                            onChange={e => updateForm(dist.id, 'sftpPort', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 ml-1 block mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={form.sftpUsername}
                                        onChange={e => updateForm(dist.id, 'sftpUsername', e.target.value)}
                                        placeholder="sftp_username"
                                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 ml-1 block mb-1 flex items-center gap-1">
                                        <Lock size={9} className="text-gray-600" />
                                        Password / Private Key
                                    </label>
                                    <input
                                        type="password"
                                        value={form.sftpPassword}
                                        onChange={e => updateForm(dist.id, 'sftpPassword', e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-700"
                                    />
                                </div>

                                {dist.requiresApiKey && (
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 ml-1 block mb-1 flex items-center gap-1">
                                            <Key size={9} className="text-gray-600" />
                                            API Key
                                        </label>
                                        <input
                                            type="password"
                                            value={form.apiKey}
                                            onChange={e => updateForm(dist.id, 'apiKey', e.target.value)}
                                            placeholder="••••••••••••"
                                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-700"
                                        />
                                    </div>
                                )}

                                {error && (
                                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                        <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-red-300">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleSave(dist)}
                                    disabled={isSaving}
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <><Loader2 size={13} className="animate-spin" /> Saving…</>
                                    ) : isSaved ? (
                                        <><CheckCircle2 size={13} className="text-green-400" /> Credentials Saved</>
                                    ) : (
                                        'Save Credentials'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
