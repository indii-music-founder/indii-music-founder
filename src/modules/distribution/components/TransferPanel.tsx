/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */

import React, { useState, useEffect } from 'react';
import { Send, Server, Shield, Loader2, CheckCircle, XCircle, Terminal, HardDrive } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { distributionService } from '@/services/distribution/DistributionService';
import { SFTPConfig, SFTPReport } from '@/types/distribution';

export const TransferPanel: React.FC = () => {
    const { success, error, info } = useToast();
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<SFTPReport | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState<number>(0);
    const [authMode, setAuthMode] = useState<'PASSWORD' | 'KEY'>('PASSWORD');
    const [protocol, setProtocol] = useState<'SFTP' | 'ASPERA'>('SFTP');
    const [config, setConfig] = useState<SFTPConfig>({
        host: '',
        port: 22,
        user: '',
        password: '',
        key: '',
        localPath: '',
        remotePath: ''
    });

    useEffect(() => {
        // Handle progress updates from Electron
        const removeListener = window.electronAPI?.on?.('distribution:transmit-progress', (data: any) => {
            setProgress(data.progress);
        });
        return () => removeListener?.();
    }, []);

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 50));
    };

    const selectLocalPath = async () => {
        const path = await window.electronAPI?.selectFile({
            title: 'Select Release Package',
            filters: [{ name: 'Packages', extensions: ['itmsp', 'zip', 'xml'] }]
        });
        if (path) {
            setConfig({ ...config, localPath: path });
            addLog(`Selected local package: ${path}`);
        }
    };

    const selectKeyPath = async () => {
        const path = await window.electronAPI?.selectFile({
            title: 'Select Private Key',
            filters: [{ name: 'Keys', extensions: ['pem', 'key', 'ppk', '*'] }]
        });
        if (path) {
            setConfig({ ...config, key: path });
            addLog(`Selected private key: ${path}`);
        }
    };

    const handleTransmit = async () => {
        if (!config.host || !config.user || !config.localPath) {
            error('Please fill in Host, User, and Local Path.');
            return;
        }

        setLoading(true);
        setReport(null);
        setProgress(0);
        addLog(`Initiating ${protocol} transmission to ${config.host}...`);

        try {
            const result = await window.electronAPI!.distribution.transmit({
                ...config,
                protocol,
                // Ensure only selected auth mode is passed if necessary, 
                // but IPC handler already checks priority
            });

            setReport(result.report || null);
            if (result.success) {
                success(`${protocol} Transmission Complete!`);
                addLog('SUCCESS: All files uploaded and verified.');
            } else {
                error(`${protocol} Transmission Failed. Check logs.`);
                addLog(`ERROR: ${result.report?.error || result.error}`);
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown transmission error';
            error(errMsg);
            addLog(`CRITICAL ERROR: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-dept-distribution/50 transition-colors uppercase tracking-widest font-bold placeholder:text-gray-600 backdrop-blur-sm";
    const labelClasses = "block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration Section */}
                <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-dept-distribution/10 border border-dept-distribution/20 rounded-xl">
                                <Server className="w-5 h-5 text-dept-distribution" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">Bridge Control</h3>
                                <p className="text-xs text-gray-500 font-medium">DSP Gateway Transmission.</p>
                            </div>
                        </div>

                        <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/5 backdrop-blur-sm">
                            <button
                                onClick={() => setProtocol('SFTP')}
                                data-testid="distro-subtab-sftp"
                                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${protocol === 'SFTP' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                SFTP
                            </button>
                            <button
                                onClick={() => setProtocol('ASPERA')}
                                data-testid="distro-subtab-aspera"
                                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${protocol === 'ASPERA' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Aspera
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 text-left">
                                <label className={labelClasses}>Hostname / IP</label>
                                <input
                                    data-testid="transfer-input-host"
                                    type="text"
                                    className={inputClasses}
                                    placeholder="sftp.gateway.com"
                                    value={config.host}
                                    onChange={e => setConfig({ ...config, host: e.target.value })}
                                />
                            </div>
                            <div className="text-left">
                                <label className={labelClasses}>Port</label>
                                <input
                                    data-testid="transfer-input-port"
                                    type="number"
                                    className={inputClasses}
                                    placeholder="22"
                                    value={config.port}
                                    onChange={e => setConfig({ ...config, port: parseInt(e.target.value) || 22 })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-left">
                                <label className={labelClasses}>Username</label>
                                <input
                                    data-testid="transfer-input-username"
                                    type="text"
                                    className={inputClasses}
                                    placeholder="gateway_user"
                                    value={config.user}
                                    onChange={e => setConfig({ ...config, user: e.target.value })}
                                />
                            </div>
                            <div className="text-left">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Authentication</label>
                                    <button
                                        onClick={() => setAuthMode(authMode === 'PASSWORD' ? 'KEY' : 'PASSWORD')}
                                        className="text-[9px] font-bold text-dept-distribution hover:text-dept-distribution/80 uppercase tracking-tighter"
                                    >
                                        Use {authMode === 'PASSWORD' ? 'Private Key' : 'Password'}
                                    </button>
                                </div>
                                {authMode === 'PASSWORD' ? (
                                    <input
                                        data-testid="transfer-input-password"
                                        type="password"
                                        className={inputClasses}
                                        placeholder="Secret Key/Password"
                                        value={config.password || ''}
                                        onChange={e => setConfig({ ...config, password: e.target.value })}
                                    />
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className={`${inputClasses} pr-10`}
                                            placeholder="id_rsa"
                                            value={config.key || ''}
                                            readOnly
                                            onClick={selectKeyPath}
                                        />
                                        <button
                                            onClick={selectKeyPath}
                                            className="absolute right-3 top-2.5 text-gray-500 hover:text-white transition-colors"
                                        >
                                            <Shield className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-800/50">
                            <div className="text-left">
                                <label className={labelClasses}>Local Source Path</label>
                                <div className="relative">
                                    <input
                                        data-testid="transfer-input-local-path"
                                        type="text"
                                        className={`${inputClasses} pl-10`}
                                        placeholder="/path/to/release.itmsp"
                                        value={config.localPath}
                                        onChange={e => setConfig({ ...config, localPath: e.target.value })}
                                    />
                                    <button
                                        data-testid="transfer-select-local-path"
                                        onClick={selectLocalPath}
                                        className="absolute left-3 top-2.5 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <HardDrive className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="text-left">
                                <label className={labelClasses}>Remote Destination</label>
                                <div className="relative">
                                    <input
                                        data-testid="transfer-input-remote-path"
                                        type="text"
                                        className={`${inputClasses} pl-10`}
                                        placeholder="/dropbox/inbound/"
                                        value={config.remotePath}
                                        onChange={e => setConfig({ ...config, remotePath: e.target.value })}
                                    />
                                    <Send className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                </div>
                            </div>
                        </div>


                        <button
                            data-testid="transfer-launch-button"
                            onClick={handleTransmit}
                            disabled={loading}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] transition-all
                                ${loading
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-white text-black hover:bg-gray-200 active:scale-[0.98]'}`}
                        >
                            {loading ? (
                                <div className="w-full space-y-2">
                                    <div className="flex items-center justify-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Transmitting {progress.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                                        <div
                                            className="bg-white h-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Shield className="w-5 h-5" />
                                    Launch Transmission
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Status Section */}
                <div className="flex flex-col gap-6">
                    {/* Status Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                        <h4 className={labelClasses}>Transmission Status</h4>
                        {report ? (
                            <div className="flex items-start gap-4 p-4 bg-black/20 border border-white/5 rounded-xl italic">
                                {report.status === 'SUCCESS' ? (
                                    <CheckCircle className="w-6 h-6 text-dept-publishing flex-shrink-0" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-dept-marketing flex-shrink-0" />
                                )}
                                <div>
                                    <p className="text-sm font-bold text-white uppercase tracking-widest leading-tight">
                                        {report.status === 'SUCCESS' ? 'BRIDGE VERIFIED: DATA DELIVERED' : 'BRIDGE FAILED: TRANSMISSION ABORTED'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 font-medium">{report.message}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 border border-dashed border-white/10 rounded-xl text-center">
                                <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Awaiting Bridge Initialization</p>
                            </div>
                        )}
                    </div>

                    {/* Console Log */}
                    <div className="flex-1 bg-black border border-gray-800 rounded-2xl flex flex-col overflow-hidden min-h-[300px]">
                        <div className="px-4 py-2 bg-black/40 border-b border-white/10 flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Secure Transport Log</span>
                        </div>
                        <div className="p-4 font-mono text-[10px] space-y-1.5 overflow-y-auto max-h-[350px]">
                            {logs.length === 0 && <p className="text-gray-700">STDOUT EMPTY...</p>}
                            {logs.map((log, i) => (
                                <p key={i} className={`${log.includes('ERROR') ? 'text-red-500' : log.includes('SUCCESS') ? 'text-green-500' : 'text-gray-400'}`}>
                                    {log}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
