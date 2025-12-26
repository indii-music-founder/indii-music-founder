
import React, { useState } from 'react';
import { DistributorId, IDistributorAdapter } from '@/services/distribution/types/distributor';
import { credentialService } from '@/services/security/CredentialService';
import { DistributorService } from '@/services/distribution/DistributorService';
import { X, Lock, Save, Loader2, AlertCircle } from 'lucide-react';

interface ConnectDistributorModalProps {
    isOpen: boolean;
    onClose: () => void;
    adapter: IDistributorAdapter | undefined;
    onSuccess: () => void;
}

export default function ConnectDistributorModal({ isOpen, onClose, adapter, onSuccess }: ConnectDistributorModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // SFTP specific
    const [sftpHost, setSftpHost] = useState('');
    const [sftpPort, setSftpPort] = useState('22');
    const [sftpUser, setSftpUser] = useState('');
    const [sftpPass, setSftpPass] = useState('');

    if (!isOpen || !adapter) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const credentials = {
                apiKey: apiKey || undefined,
                apiSecret: apiSecret || undefined,
                username: username || undefined,
                password: password || undefined,
                sftpHost: sftpHost || undefined,
                sftpPort: sftpPort || undefined,
                sftpUsername: sftpUser || undefined,
                sftpPassword: sftpPass || undefined,
            };

            // 1. Save to secure storage via Service (which also verifies connection)
            await DistributorService.connect(adapter.id, credentials);

            // 2. Close and notify
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to connect');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#161b22] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white">Connect {adapter.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">Enter your credentials to enable distribution.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Standard API Credentials */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Credentials</label>

                        <div className="space-y-1">
                            <span className="text-sm text-gray-300">API Key / Username</span>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={apiKey || username}
                                    onChange={e => { setApiKey(e.target.value); setUsername(e.target.value); }}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-600"
                                    placeholder="Enter key or username"
                                    required
                                />
                                <Lock className="absolute right-3 top-3 text-gray-600" size={14} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-sm text-gray-300">API Secret / Password</span>
                            <input
                                type="password"
                                value={apiSecret || password}
                                onChange={e => { setApiSecret(e.target.value); setPassword(e.target.value); }}
                                className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-600"
                                placeholder="Enter secret or password"
                                required
                            />
                        </div>
                    </div>

                    {/* SFTP Optional Section - Toggle? For now, render always for simplicity or strictly based on known reqs. */}
                    {/* In a real app we'd toggle based on adapter.capabilities or similar. Assuming generic fields for now. */}
                    <div className="pt-2 border-t border-gray-800">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">SFTP Configuration (Optional)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">Host</span>
                                <input
                                    type="text" value={sftpHost} onChange={e => setSftpHost(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    placeholder="sftp.example.com"
                                />
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">Port</span>
                                <input
                                    type="text" value={sftpPort} onChange={e => setSftpPort(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    placeholder="22"
                                />
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-gray-400 block mb-1">SFTP User (if different)</span>
                                <input
                                    type="text" value={sftpUser} onChange={e => setSftpUser(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    placeholder="username"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-750 text-white rounded-lg font-medium transition-colors border border-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {isLoading ? 'Verifying...' : 'Save & Connect'}
                        </button>
                    </div>

                    <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
                        <Lock size={10} />
                        Your credentials are encrypted and stored securely on your device.
                    </p>
                </form>
            </div>
        </div>
    );
}
