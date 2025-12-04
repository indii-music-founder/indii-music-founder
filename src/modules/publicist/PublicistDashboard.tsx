import React from 'react';
import { Mic } from 'lucide-react';

export default function PublicistDashboard() {
    return (
        <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <Mic size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Publicist Dashboard</h1>
                    <p className="text-gray-400">Manage press releases and media relations</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Press Releases</h3>
                    <p className="text-gray-400 text-sm">No active press releases.</p>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Media Contacts</h3>
                    <p className="text-gray-400 text-sm">No contacts found.</p>
                </div>
            </div>
        </div>
    );
}
