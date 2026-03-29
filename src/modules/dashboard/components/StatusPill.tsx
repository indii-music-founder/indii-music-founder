import React from 'react';

export function StatusPill({ label, status }: { label: string; status: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1 h-1 rounded-full ${status === 'Standby' ? 'bg-gray-600' : 'bg-dept-marketing animate-pulse'}`} />
                <span className="text-[11px] font-bold text-white uppercase italic tracking-tighter">{status}</span>
            </div>
        </div>
    );
}
