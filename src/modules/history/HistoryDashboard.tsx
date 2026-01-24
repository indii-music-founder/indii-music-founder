import React from 'react';
import { ConversationHistoryList } from '@/core/components/ConversationHistoryList';
import { useStore } from '@/core/store';

export default function HistoryDashboard() {
    const setModule = useStore(state => state.setModule);

    const handleClose = () => {
        setModule('dashboard');
    };

    return (
        <div className="h-full w-full bg-black/50 p-6 flex justify-center">
            <div className="w-full max-w-4xl h-full border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <ConversationHistoryList
                    onClose={handleClose}
                    className="w-full h-full border-0 bg-black/20"
                />
            </div>
        </div>
    );
}
