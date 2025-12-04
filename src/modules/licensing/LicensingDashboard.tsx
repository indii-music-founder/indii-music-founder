import React from 'react';
import { FileText } from 'lucide-react';

export default function LicensingDashboard() {
    return (
        <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400">
                    <FileText size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Licensing Department</h1>
                    <p className="text-gray-400">Manage sync licenses and agreements</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Active Licenses</h3>
                    <p className="text-gray-400 text-sm">No active licenses.</p>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Pending Requests</h3>
                    <p className="text-gray-400 text-sm">No pending requests.</p>
                </div>
            </div>
        </div>
    );
}
