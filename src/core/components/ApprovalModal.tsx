import { useStore } from '../store';
import { AlertTriangle, Check, X } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    'social-post': { icon: <AlertTriangle className="w-5 h-5" />, color: 'text-blue-400', label: 'Social Media Post' },
    'email': { icon: <AlertTriangle className="w-5 h-5" />, color: 'text-purple-400', label: 'Email' },
    'payment': { icon: <AlertTriangle className="w-5 h-5" />, color: 'text-red-400', label: 'Payment' },
    'file-operation': { icon: <AlertTriangle className="w-5 h-5" />, color: 'text-orange-400', label: 'File Operation' },
    'api-call': { icon: <AlertTriangle className="w-5 h-5" />, color: 'text-cyan-400', label: 'External API Call' },
    'default': { icon: <AlertTriangle className="w-5 h-5" />, color: 'text-yellow-400', label: 'Action' },
};

export function ApprovalModal() {
    const { pendingApproval, resolveApproval } = useStore();

    if (!pendingApproval) return null;

    const config = TYPE_CONFIG[pendingApproval.type] || TYPE_CONFIG['default'];

    const handleApprove = () => {
        resolveApproval(true);
    };

    const handleReject = () => {
        resolveApproval(false);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-3">
                    <div className={`${config.color}`}>
                        {config.icon}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Agent Approval Required</h2>
                        <p className="text-sm text-gray-400">{config.label}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    <p className="text-gray-300 mb-4">
                        The AI agent wants to perform the following action:
                    </p>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 font-mono text-sm text-white whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                        {pendingApproval.content}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        Request ID: {pendingApproval.id}
                    </p>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
                    <button
                        onClick={handleReject}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Reject
                    </button>
                    <button
                        onClick={handleApprove}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Approve
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ApprovalModal;
