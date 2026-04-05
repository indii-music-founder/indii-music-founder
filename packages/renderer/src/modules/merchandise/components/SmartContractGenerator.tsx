/**
 * SmartContractGenerator — Item 127 (PRODUCTION_200)
 * UI form to generate ERC-721/ERC-1155 royalty split smart contracts.
 * Calls SmartContractService.deploySplitContract() (mock Firestore).
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code2, Plus, Trash2, CheckCircle2, Copy, Loader2, AlertCircle } from 'lucide-react';
import { smartContractService, SplitContractConfig } from '@/services/blockchain/SmartContractService';

type TokenType = 'ERC-721' | 'ERC-1155';

interface Payee {
    walletAddress: string;
    percentage: number;
    role: string;
}

export function SmartContractGenerator() {
    const [tokenType, setTokenType] = useState<TokenType>('ERC-1155');
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [isrc, setIsrc] = useState('');
    const [payees, setPayees] = useState<Payee[]>([
        { walletAddress: '', percentage: 50, role: 'Artist' },
        { walletAddress: '', percentage: 50, role: 'Producer' },
    ]);
    const [isDeploying, setIsDeploying] = useState(false);
    const [contractAddress, setContractAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const totalPct = payees.reduce((s, p) => s + Number(p.percentage || 0), 0);
    const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
    const allWalletsSet = payees.every(p => ETH_ADDRESS_RE.test(p.walletAddress.trim()));
    const normalizedName = name.trim();
    const normalizedSymbol = symbol.trim();
    const normalizedIsrc = isrc.trim();
    const hasRequiredMetadata = normalizedName.length > 0 && normalizedSymbol.length > 0 && normalizedIsrc.length > 0;
    const isValid = hasRequiredMetadata && Math.abs(totalPct - 100) < 0.01 && allWalletsSet;

    const addPayee = () => {
        if (payees.length >= 6) return;
        setPayees(prev => [...prev, { walletAddress: '', percentage: 0, role: 'Collaborator' }]);
    };

    const removePayee = (i: number) => {
        setPayees(prev => prev.filter((_, idx) => idx !== i));
    };

    const updatePayee = (i: number, field: keyof Payee, value: string | number) => {
        setPayees(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
    };

    const handleDeploy = async () => {
        if (!isValid || isDeploying) return;
        setIsDeploying(true);
        setError(null);
        try {
            const config: SplitContractConfig = {
                isrc: normalizedIsrc,
                payees: payees.map(p => ({
                    walletAddress: p.walletAddress.trim(),
                    percentage: Number(p.percentage),
                    role: p.role,
                })),
            };
            const address = await smartContractService.deploySplitContract(config);
            setContractAddress(address);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Deployment failed.');
        } finally {
            setIsDeploying(false);
        }
    };

    const handleCopy = async () => {
        if (!contractAddress) return;
        await navigator.clipboard.writeText(contractAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Code2 size={18} className="text-[#FFE135]" />
                    Smart Contract Generator
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">Deploy royalty-splitting contracts for digital collectibles</p>
            </div>

            {/* Token Type Toggle */}
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
                {(['ERC-721', 'ERC-1155'] as TokenType[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTokenType(t)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tokenType === t ? 'bg-[#FFE135] text-black' : 'text-neutral-400 hover:text-white'}`}
                    >
                        {t}
                        <span className="ml-1 font-normal opacity-70">{t === 'ERC-721' ? '(Unique)' : '(Editions)'}</span>
                    </button>
                ))}
            </div>

            {/* Contract Fields */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="sc-token-name" className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1 block">Token Name</label>
                    <input
                        id="sc-token-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Summer EP Rights"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40"
                    />
                </div>
                <div>
                    <label htmlFor="sc-symbol" className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1 block">Symbol</label>
                    <input
                        id="sc-symbol"
                        value={symbol}
                        onChange={e => setSymbol(e.target.value.toUpperCase().slice(0, 8))}
                        placeholder="SUMEP"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40 font-mono"
                    />
                </div>
            </div>
            <div>
                <label htmlFor="sc-isrc" className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1 block">ISRC Code</label>
                <input
                    id="sc-isrc"
                    value={isrc}
                    onChange={e => setIsrc(e.target.value.toUpperCase())}
                    placeholder="USRC17607839"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40 font-mono"
                />
            </div>

            {/* Payee Table */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Split Payees</label>
                    <span className={`text-[10px] font-bold ${Math.abs(totalPct - 100) < 0.01 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {totalPct.toFixed(0)}% / 100%
                    </span>
                </div>
                <div className="space-y-2">
                    {payees.map((payee, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input
                                value={payee.role}
                                onChange={e => updatePayee(i, 'role', e.target.value)}
                                placeholder="Role"
                                className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none"
                            />
                            <input
                                value={payee.walletAddress}
                                onChange={e => updatePayee(i, 'walletAddress', e.target.value)}
                                placeholder="0x... (valid Ethereum address required)"
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-neutral-700 focus:outline-none font-mono"
                            />
                            <input
                                type="number"
                                value={payee.percentage}
                                onChange={e => updatePayee(i, 'percentage', parseFloat(e.target.value) || 0)}
                                min={0}
                                max={100}
                                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none text-center font-bold"
                            />
                            <span className="text-xs text-neutral-600">%</span>
                            <button onClick={() => removePayee(i)} disabled={payees.length <= 2} className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-30">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
                {payees.length < 6 && (
                    <button onClick={addPayee} className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-white transition-colors">
                        <Plus size={11} /> Add Payee
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}

            {/* Result */}
            <AnimatePresence>
                {contractAddress && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl"
                    >
                        <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-green-400 mb-0.5">Contract Deployed!</div>
                            <div className="text-[11px] text-neutral-400 font-mono truncate">{contractAddress}</div>
                        </div>
                        <button onClick={handleCopy} className="text-neutral-500 hover:text-white transition-colors flex-shrink-0">
                            {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Deploy Button */}
            <button
                onClick={handleDeploy}
                disabled={!isValid || isDeploying}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#FFE135] text-black rounded-xl text-sm font-black hover:bg-[#FFD700] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {isDeploying ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Deploying Contract...
                    </>
                ) : (
                    <>
                        <Code2 size={16} />
                        Deploy {tokenType} Contract
                    </>
                )}
            </button>
            {!isValid && (
                <p className="text-center text-[10px] text-neutral-600">
                    {!name || !symbol || !isrc ? 'Fill in all fields.' : `Splits must total 100% (currently ${totalPct.toFixed(0)}%).`}
                </p>
            )}
        </div>
    );
}
