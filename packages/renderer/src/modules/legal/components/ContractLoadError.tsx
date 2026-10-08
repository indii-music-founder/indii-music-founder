import { AlertTriangle } from 'lucide-react';

export function ContractLoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <div role="alert" className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <AlertTriangle size={28} className="text-amber-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Unable to Load Contracts</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
                Your contracts could not be retrieved. This does not mean you have no contracts.
                Try again to load the list.
            </p>
            <button onClick={onRetry} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors">
                Retry
            </button>
        </div>
    );
}
