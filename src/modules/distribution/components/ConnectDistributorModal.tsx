
import React, { useState } from 'react';
import { DistributorId, IDistributorAdapter } from '@/services/distribution/types/distributor';
import { DistributorService } from '@/services/distribution/DistributorService';
import { X, Lock, Save, Loader2, AlertCircle, Globe, Terminal, ShieldCheck, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectDistributorModalProps {
    isOpen: boolean;
    onClose: () => void;
    adapter: IDistributorAdapter | undefined;
    onSuccess: () => void;
}

type ConfigTab = 'identity' | 'technical';

export default function ConnectDistributorModal({ isOpen, onClose, adapter, onSuccess }: ConnectDistributorModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ConfigTab>('identity');

    // Form state - grouped by intent
    const [auth, setAuth] = useState({
        username: '',
        password: '',
        apiKey: '',
        apiSecret: ''
    });

    const [sftp, setSftp] = useState({
        host: '',
        port: '22',
        username: '',
        password: '',
        privateKey: ''
    });

    if (!isOpen || !adapter) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const credentials = {
                apiKey: auth.apiKey || undefined,
                apiSecret: auth.apiSecret || undefined,
                username: auth.username || undefined,
                password: auth.password || undefined,
                sftpHost: sftp.host || undefined,
                sftpPort: sftp.port || undefined,
                sftpUsername: sftp.username || undefined,
                sftpPassword: sftp.password || undefined,
                privateKey: sftp.privateKey || undefined
            };

            // This will attempt the real connection via the adapter's connect method (which uses sftp IPC)
            await DistributorService.connect(adapter.id, credentials);

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 20 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: 'spring' as const,
                damping: 25,
                stiffness: 300
            }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: 20,
            transition: {
                duration: 0.2
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-lg bg-[#0D0D0D] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header Section */}
                        <div className="p-8 pb-4">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral-500 to-magenta-600 flex items-center justify-center text-white shadow-lg shadow-coral-500/20">
                                        <ShieldCheck size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                                            Authorize {adapter.name}
                                        </h2>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/80">Secure Connection (FIPS-140)</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-10 h-10 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex p-1 bg-white/5 rounded-2xl mb-4 border border-white/5">
                                <button
                                    onClick={() => setActiveTab('identity')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'identity' ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <Globe size={14} />
                                    Identity
                                </button>
                                <button
                                    onClick={() => setActiveTab('technical')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'technical' ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <Terminal size={14} />
                                    Technical
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Form Body */}
                        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                            <form id="connect-form" onSubmit={handleSubmit} className="space-y-6">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'identity' ? (
                                        <motion.div
                                            key="identity"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-4"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Account Identifier (Username/Email)</label>
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        value={auth.username}
                                                        onChange={e => setAuth({ ...auth, username: e.target.value })}
                                                        placeholder="email@example.com"
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-coral-500/50 focus:ring-4 focus:ring-coral-500/10 transition-all placeholder:text-gray-700"
                                                        required={activeTab === 'identity' && !auth.apiKey}
                                                    />
                                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-coral-500/10 to-magenta-600/10 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Access Token / Password</label>
                                                <div className="relative group">
                                                    <input
                                                        type="password"
                                                        value={auth.password}
                                                        onChange={e => setAuth({ ...auth, password: e.target.value })}
                                                        placeholder="••••••••••••"
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-magenta-500/50 focus:ring-4 focus:ring-magenta-500/10 transition-all placeholder:text-gray-700"
                                                        required={activeTab === 'identity' && !auth.apiSecret}
                                                    />
                                                    <div className="absolute right-4 top-4 text-gray-600">
                                                        <Lock size={18} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2">
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-1 flex items-center gap-2">
                                                        <ShieldCheck size={12} className="text-green-500" />
                                                        Encryption Active
                                                    </h4>
                                                    <p className="text-[11px] text-gray-500 leading-relaxed">
                                                        Credentials are stored in your system's secure keychain and never transmitted in plain-text.
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="technical"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-5"
                                        >
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-2 space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">SFTP Host</label>
                                                    <input
                                                        type="text"
                                                        value={sftp.host}
                                                        onChange={e => setSftp({ ...sftp, host: e.target.value })}
                                                        placeholder="sftp.provider.com"
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-coral-500/50 transition-all placeholder:text-gray-800"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Port</label>
                                                    <input
                                                        type="text"
                                                        value={sftp.port}
                                                        onChange={e => setSftp({ ...sftp, port: e.target.value })}
                                                        placeholder="22"
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-coral-500/50 transition-all placeholder:text-gray-800"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">SFTP Username (If different)</label>
                                                <input
                                                    type="text"
                                                    value={sftp.username}
                                                    onChange={e => setSftp({ ...sftp, username: e.target.value })}
                                                    placeholder="distro_user_01"
                                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-coral-500/50 transition-all placeholder:text-gray-800"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">SFTP Password</label>
                                                <div className="relative group">
                                                    <input
                                                        type="password"
                                                        value={sftp.password}
                                                        onChange={e => setSftp({ ...sftp, password: e.target.value })}
                                                        placeholder="••••••••••••"
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-coral-500/50 transition-all placeholder:text-gray-800"
                                                    />
                                                    <div className="absolute right-4 top-4 text-gray-600">
                                                        <Lock size={18} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Private Key (OpenSSH Format)</label>
                                                <textarea
                                                    value={sftp.privateKey}
                                                    onChange={e => setSftp({ ...sftp, privateKey: e.target.value })}
                                                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                                    rows={3}
                                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-coral-500/50 transition-all placeholder:text-gray-800 font-mono text-[10px] resize-none"
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                                            <AlertCircle size={18} />
                                        </div>
                                        <div>
                                            <h5 className="text-[10px] font-black uppercase text-red-400 mb-0.5">Authentication Error</h5>
                                            <p className="text-[11px] text-red-200/80 leading-relaxed font-medium">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </form>
                        </div>

                        {/* Footer Action */}
                        <div className="p-8 pt-4 border-t border-white/5 bg-white/[0.02]">
                            <button
                                form="connect-form"
                                type="submit"
                                disabled={isLoading}
                                className="w-full group relative overflow-hidden py-4 px-6 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-xs transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 shadow-2xl shadow-white/10"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Establishing Secure Tunnel...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Finalize Connection
                                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-r from-coral-500 to-magenta-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
