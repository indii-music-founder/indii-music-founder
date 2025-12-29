import React, { useEffect } from 'react';
import { FileText, Clock, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { licensingService } from '@/services/licensing/LicensingService';
import { LicenseRequest } from '@/services/licensing/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';

import { useLicensing } from './hooks/useLicensing';

export default function LicensingDashboard() {
    const { licenses, requests, isLoading, actions } = useLicensing();
    const { currentModule } = useStore();

    // Global exposed service for agent interaction (Development Only)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            (window as any).licensingService = licensingService;
        }
    }, []);

    const handleDraftAction = async (request: LicenseRequest) => {
        await actions.draftAgreement(request);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-10">
            {/* Premium Header */}
            <header className="relative overflow-hidden bg-gradient-to-br from-[#1c2128] to-[#161b22] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-inner">
                            <ShieldCheck size={40} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-extrabold text-white tracking-tight">Licensing Department</h1>
                            <p className="text-indigo-300/60 font-medium mt-1">Alpha Release • Real-time Rights & Clearances</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-center">
                            <div className="text-2xl font-bold text-white">{licenses.length}</div>
                            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Active Licenses</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-center">
                            <div className="text-2xl font-bold text-yellow-500">{requests.length}</div>
                            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Pending Clearances</div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {/* Pending Clearances Section */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Clock className="w-6 h-6 text-yellow-500" />
                            Pending Clearances
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {requests.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-white/5 p-12 rounded-3xl border border-dashed border-white/10 text-center"
                                >
                                    <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium italic">All quiet on the licensing front.</p>
                                </motion.div>
                            ) : (
                                requests.map((request, idx) => (
                                    <motion.div
                                        key={request.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group relative bg-[#1c2128] p-5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all hover:shadow-[0_0_30px_rgba(79,70,229,0.05)]"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1">
                                                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{request.title}</h3>
                                                <p className="text-sm font-medium text-gray-400">{request.artist}</p>
                                                <div className="flex items-center gap-3 pt-2">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold tracking-wider uppercase">
                                                        {request.status}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/5 font-bold tracking-wider uppercase">
                                                        {request.usage}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-3">
                                                <button
                                                    onClick={() => handleDraftAction(request)}
                                                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-4 py-2 rounded-xl border border-indigo-400/20 shadow-lg shadow-indigo-600/10 transition-all scale-95 group-hover:scale-100 hover:shadow-indigo-500/20"
                                                >
                                                    <FileText size={14} />
                                                    DRAFT AGREEMENT
                                                </button>
                                                <span className="text-[10px] font-medium text-gray-600">
                                                    Requested • {request.requestedAt instanceof Date ? request.requestedAt.toLocaleDateString() : request.requestedAt.toDate().toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                {/* Active Portfolio Section */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        Active Portfolio
                    </h2>

                    <div className="grid gap-4">
                        <AnimatePresence mode="popLayout">
                            {licenses.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-white/5 p-12 rounded-3xl border border-dashed border-white/10 text-center"
                                >
                                    <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium italic">No finalized licenses in the portfolio yet.</p>
                                </motion.div>
                            ) : (
                                licenses.map((license, idx) => (
                                    <motion.div
                                        key={license.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="relative bg-gradient-to-r from-[#1c2128] to-[#161b22] p-5 rounded-2xl border border-white/5 overflow-hidden group hover:border-emerald-500/30 transition-all shadow-xl"
                                    >
                                        <div className="absolute top-0 right-0 p-3 text-emerald-500/10">
                                            <ShieldCheck size={64} />
                                        </div>
                                        <div className="relative z-10 flex justify-between items-start">
                                            <div className="space-y-1">
                                                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{license.title}</h3>
                                                <p className="text-sm font-medium text-gray-400">{license.artist}</p>
                                                <div className="flex items-center gap-4 pt-3">
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold text-[10px] tracking-widest">
                                                        <CheckCircle2 size={10} />
                                                        SECURED
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{license.licenseType}</span>
                                                </div>
                                            </div>
                                            {license.agreementUrl && (
                                                <a
                                                    href={license.agreementUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all shadow-lg"
                                                >
                                                    <ExternalLink size={18} />
                                                </a>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            </div>

            {/* Action Support Footer */}
            <footer className="mt-12 flex items-center justify-between p-6 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10">
                <div className="flex items-center gap-4 text-sm text-indigo-300/60 font-medium">
                    <AlertCircle size={18} />
                    <span>Experimental AI licensing tools active. All generated drafts MUST be reviewed by legal counsel.</span>
                </div>
                <div className="text-xs font-bold text-indigo-400 tracking-widest uppercase">
                    Security Level: High
                </div>
            </footer>
        </div>
    );
}
