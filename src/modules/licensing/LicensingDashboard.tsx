import React, { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { licensingService } from '@/services/licensing/LicensingService';
import { License, LicenseRequest } from '@/services/licensing/types';
import { motion } from 'framer-motion';

export default function LicensingDashboard() {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [requests, setRequests] = useState<LicenseRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [activeLicenses, pendingRequests] = await Promise.all([
                    licensingService.getActiveLicenses(),
                    licensingService.getPendingRequests()
                ]);
                setLicenses(activeLicenses);
                setRequests(pendingRequests);
            } catch (error) {
                console.error('Failed to fetch licensing data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // In a production app, we would use onSnapshot for real-time updates
    }, []);

    return (
        <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                    <FileText size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Licensing Department</h1>
                    <p className="text-gray-400">Manage sync licenses and agreements</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Active Licenses */}
                <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-gray-800 bg-[#1c2128] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-green-500" />
                            <h3 className="font-semibold text-white">Active Licenses</h3>
                        </div>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{licenses.length}</span>
                    </div>
                    <div className="p-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-500 text-sm">Loading licenses...</div>
                        ) : licenses.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm italic">No active licenses found.</div>
                        ) : (
                            licenses.map((license) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={license.id}
                                    className="p-4 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-gray-800 m-1"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-medium text-white truncate pr-4">{license.title}</h4>
                                        <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">ACTIVE</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-2 truncate">{license.artist}</p>
                                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                                        <span>Type: {license.licenseType}</span>
                                        {license.agreementUrl && (
                                            <a href={license.agreementUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                                                Agreement <ExternalLink size={10} />
                                            </a>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Pending Requests */}
                <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-gray-800 bg-[#1c2128] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-yellow-500" />
                            <h3 className="font-semibold text-white">Pending Requests</h3>
                        </div>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{requests.length}</span>
                    </div>
                    <div className="p-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-500 text-sm">Loading requests...</div>
                        ) : requests.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm italic">No pending requests.</div>
                        ) : (
                            requests.map((request) => (
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={request.id}
                                    className="p-4 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-gray-800 m-1"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-medium text-white truncate pr-4">{request.title}</h4>
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                            <span className="text-[9px] uppercase font-bold tracking-wider">{request.status.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-2 truncate">{request.artist}</p>
                                    <p className="text-[11px] text-gray-500 line-clamp-2 italic mb-2">"{request.notes}"</p>
                                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                                        <span>Usage: {request.usage}</span>
                                        {request.sourceUrl && (
                                            <a href={request.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                                                Source <ExternalLink size={10} />
                                            </a>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
