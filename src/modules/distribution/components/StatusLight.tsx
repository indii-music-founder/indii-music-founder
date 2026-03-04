import React from 'react';

export function StatusLight({ label, ok }: { label: string; ok: boolean }) {
    return (
        <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[10px] text-gray-500">{label}</span>
        </div>
    );
}
