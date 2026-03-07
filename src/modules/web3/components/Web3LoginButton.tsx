import React, { useState } from 'react';
import { Wallet, CheckCircle } from 'lucide-react';

interface Web3LoginButtonProps {
    onConnect?: (address: string) => void;
    className?: string;
}

export const Web3LoginButton: React.FC<Web3LoginButtonProps> = ({ onConnect, className }) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
    const [address, setAddress] = useState<string | null>(null);

    const handleConnect = async () => {
        setStatus('connecting');

        // Mock wallet connection delay (Item 126)
        setTimeout(() => {
            const mockAddress = '0x' + crypto.randomUUID().replace(/-/g, '').slice(0, 40);
            setAddress(mockAddress);
            setStatus('connected');
            if (onConnect) onConnect(mockAddress);
        }, 1500);
    };

    return (
        <button
            onClick={handleConnect}
            disabled={status !== 'idle'}
            className={`
                flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${status === 'connected'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : 'bg-[#1a1a1a] text-gray-200 hover:bg-[#2a2a2a] border border-gray-700 hover:border-gray-600'
                }
                ${status === 'connecting' ? 'opacity-70 cursor-not-allowed' : ''}
                ${className || ''}
            `}
        >
            {status === 'idle' && (
                <>
                    <Wallet size={18} />
                    <span>Connect Wallet</span>
                </>
            )}

            {status === 'connecting' && (
                <>
                    <div className="w-4 h-4 rounded-full border-2 border-gray-500 border-t-gray-200 animate-spin" />
                    <span>Connecting...</span>
                </>
            )}

            {status === 'connected' && (
                <>
                    <CheckCircle size={18} />
                    <span className="truncate max-w-[120px]">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                </>
            )}
        </button>
    );
};
