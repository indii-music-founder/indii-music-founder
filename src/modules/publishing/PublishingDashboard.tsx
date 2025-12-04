import React from 'react';
import { Book } from 'lucide-react';

export default function PublishingDashboard() {
    return (
        <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                    <Book size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Publishing Department</h1>
                    <p className="text-gray-400">Manage song rights and royalties</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Catalog</h3>
                    <p className="text-gray-400 text-sm">No songs in catalog.</p>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Royalties</h3>
                    <p className="text-gray-400 text-sm">$0.00 accrued this period.</p>
                </div>
            </div>
        </div>
    );
}
