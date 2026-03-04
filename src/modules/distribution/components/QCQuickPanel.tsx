import React from 'react';
import { Brain } from 'lucide-react';
import { StatusLight } from './StatusLight';

export function QCQuickPanel() {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">QC Status</h3>
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="flex items-center gap-2 mb-1">
                    <Brain size={14} className="text-green-400" />
                    <span className="text-xs font-bold text-green-400">All Clear</span>
                </div>
                <p className="text-[10px] text-gray-500">Last scan: 2 hours ago</p>
                <div className="flex gap-2 mt-2">
                    <StatusLight label="Audio" ok />
                    <StatusLight label="Meta" ok />
                    <StatusLight label="Art" ok />
                </div>
            </div>
        </div>
    );
}
