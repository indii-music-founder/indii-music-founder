import React, { useState } from 'react';
import { CheckCircle2, Clock, Lock, Unlock, DollarSign, Users, AlertTriangle, CreditCard } from 'lucide-react';

/* ================================================================== */
/*  Split Sheet Escrow — Collaborative Funds Release Tool              */
/* ================================================================== */

interface Collaborator {
    id: string;
    name: string;
    role: string;
    splitPct: number;
    signed: boolean;
}

const MOCK_COLLABORATORS: Collaborator[] = [
    { id: '1', name: 'Marcus Webb', role: 'Producer', splitPct: 40, signed: false },
    { id: '2', name: 'Jasmine Cole', role: 'Vocalist', splitPct: 30, signed: false },
    { id: '3', name: 'Devon Park', role: 'Co-Writer', splitPct: 20, signed: false },
    { id: '4', name: 'Tara Singh', role: 'Mixing Engineer', splitPct: 10, signed: false },
];

const ESCROW_AMOUNT = 4800;

export function SplitSheetEscrow() {
    const [collaborators, setCollaborators] = useState<Collaborator[]>(MOCK_COLLABORATORS);
    const [released, setReleased] = useState(false);

    const signedCount = collaborators.filter(c => c.signed).length;
    const totalCount = collaborators.length;
    const allSigned = signedCount === totalCount;
    const progressPct = Math.round((signedCount / totalCount) * 100);

    const handleSimulateSign = (id: string) => {
        setCollaborators(prev =>
            prev.map(c => c.id === id ? { ...c, signed: true } : c)
        );
    };

    const handleReleaseFunds = () => {
        if (allSigned) setReleased(true);
    };

    return (
        <div className="space-y-5 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Lock size={16} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tight">Split Sheet Escrow</h2>
                    <p className="text-[10px] text-gray-500">Funds locked until all collaborators sign off</p>
                </div>
            </div>

            {released ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Unlock size={28} className="text-emerald-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-black text-white">Funds Released!</p>
                        <p className="text-sm text-emerald-400 mt-1">${ESCROW_AMOUNT.toLocaleString()} distributed via Stripe Connect</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
                        {collaborators.map(c => (
                            <div key={c.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                                <p className="text-xs font-bold text-white">{c.name}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{c.role}</p>
                                <p className="text-sm font-black text-emerald-400 mt-1">
                                    ${((ESCROW_AMOUNT * c.splitPct) / 100).toFixed(2)}
                                </p>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => { setReleased(false); setCollaborators(MOCK_COLLABORATORS); }}
                        className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors mt-2"
                    >
                        Reset Demo
                    </button>
                </div>
            ) : (
                <>
                    {/* Escrow Amount Banner */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <DollarSign size={20} className="text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-2xl font-black text-white">${ESCROW_AMOUNT.toLocaleString()}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Total escrowed — locked until all parties sign</p>
                        </div>
                        <div className="text-right">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${allSigned ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
                                {allSigned ? <Unlock size={12} /> : <Lock size={12} />}
                                {allSigned ? 'Ready to Release' : 'In Escrow'}
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Users size={12} />
                                <span>{signedCount} of {totalCount} collaborators signed</span>
                            </div>
                            <span className="text-xs font-bold text-white">{progressPct}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Collaborator List */}
                    <div className="space-y-2">
                        {collaborators.map(c => {
                            const amount = (ESCROW_AMOUNT * c.splitPct) / 100;
                            return (
                                <div
                                    key={c.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${c.signed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/5'}`}
                                >
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${c.signed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400'}`}>
                                        {c.name.split(' ').map(n => n[0]).join('')}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white">{c.name}</p>
                                        <p className="text-[10px] text-gray-500">{c.role}</p>
                                    </div>

                                    {/* Split % */}
                                    <div className="text-right mr-2">
                                        <p className="text-sm font-black text-white">{c.splitPct}%</p>
                                        <p className="text-[10px] text-gray-500">${amount.toFixed(2)}</p>
                                    </div>

                                    {/* Status / Sign */}
                                    {c.signed ? (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex-shrink-0">
                                            <CheckCircle2 size={10} />
                                            Signed
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSimulateSign(c.id)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-400 hover:text-white text-[10px] font-bold flex-shrink-0 transition-colors"
                                        >
                                            <Clock size={10} />
                                            Simulate Sign
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Split visual breakdown */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Split Breakdown</h4>
                        <div className="flex w-full h-3 rounded-full overflow-hidden gap-px">
                            {collaborators.map((c, i) => {
                                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500'];
                                return (
                                    <div
                                        key={c.id}
                                        className={`${colors[i % colors.length]} ${c.signed ? 'opacity-100' : 'opacity-40'} transition-opacity`}
                                        style={{ width: `${c.splitPct}%` }}
                                        title={`${c.name}: ${c.splitPct}%`}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3">
                            {collaborators.map((c, i) => {
                                const colors = ['text-blue-400', 'text-purple-400', 'text-emerald-400', 'text-amber-400'];
                                const dots = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500'];
                                return (
                                    <div key={c.id} className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${dots[i % dots.length]}`} />
                                        <span className={`text-[10px] ${colors[i % colors.length]}`}>{c.name} ({c.splitPct}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Release Funds Button */}
                    <div className="space-y-3">
                        <button
                            onClick={handleReleaseFunds}
                            disabled={!allSigned}
                            className={`w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${allSigned
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-white/[0.02] border border-white/5 text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            {allSigned ? <Unlock size={16} /> : <Lock size={16} />}
                            {allSigned ? 'Release Funds via Stripe Connect' : `Waiting for ${totalCount - signedCount} more signature${totalCount - signedCount !== 1 ? 's' : ''}...`}
                        </button>

                        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                            <CreditCard size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-300/70 leading-relaxed">
                                Funds are held via <strong>Stripe Connect</strong> and automatically distributed to each collaborator's connected payout account upon unanimous sign-off. Standard Stripe processing fees apply.
                            </p>
                        </div>
                    </div>
                </>
            )}

            {!released && !allSigned && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300/70 leading-relaxed">
                        Escrowed funds are non-refundable once distributed. All collaborators must acknowledge and sign their split percentage before funds can be released.
                    </p>
                </div>
            )}
        </div>
    );
}
