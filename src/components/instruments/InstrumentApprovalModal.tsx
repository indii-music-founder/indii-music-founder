/**
 * Instrument Approval Modal for Instrument Execution
 *
 * Shown when an agent wants to execute an expensive instrument that requires user approval.
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, Zap, X, Check, Loader2 } from 'lucide-react';

interface ApprovalRequest {
  instrumentId: string;
  instrumentName: string;
  parameters: Record<string, any>;
  estimatedCost: number;
  onApprove: () => void;
  onDeny: () => void;
}

interface InstrumentApprovalModalProps {
  request: ApprovalRequest;
  closing?: boolean;
}

export const InstrumentApprovalModal: React.FC<InstrumentApprovalModalProps> = ({ request, closing }) => {
  const handleApprove = () => {
    request.onApprove();
  };

  const handleDeny = () => {
    request.onDeny();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#161b22] rounded-2xl border border-yellow-500/50 max-w-lg w-full shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="bg-yellow-500/20 p-3 rounded-xl">
                <AlertTriangle className="text-yellow-500" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Approval Required
                </h3>
                <p className="text-gray-400 text-sm">
                  Agent wants to execute {request.instrumentName}
                </p>
              </div>
            </div>
            {closing && <Loader2 className="animate-spin text-gray-400" size={20} />}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Cost Summary */}
          <div className="bg-black/30 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Estimated Cost</span>
              <div className="flex items-center gap-2 text-yellow-500">
                <Zap size={16} />
                <span className="text-2xl font-bold">{request.estimatedCost}</span>
                <span className="text-sm">credits</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs">
              This operation will consume tokens from your subscription quota
            </p>
          </div>

          {/* Parameters */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">
              Parameters
            </h4>
            <div className="bg-black/20 rounded-lg p-3 space-y-1">
              {Object.entries(request.parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-400">{key}:</span>
                  <span className="text-white font-medium">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Clock className="text-orange-500 size-4 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-200">
                <p className="font-medium">Important</p>
                <p className="text-orange-300/80 mt-1">
                  This operation cannot be undone and will consume resources from your subscription quota.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex gap-3">
          <button
            onClick={handleDeny}
            disabled={closing}
            className="flex-1 py-3 rounded-lg border border-gray-600 text-white font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={16} />
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={closing}
            className="flex-1 py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {closing ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Processing...
              </>
            ) : (
              <>
                <Check size={16} />
                Approve
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Approval Manager Component
 *
 * Listens for 'instrument-approval-request' events and shows approval modal.
 */
export const ApprovalManager: React.FC = () => {
  const [currentRequest, setCurrentRequest] = React.useState<ApprovalRequest | null>(null);
  const [closing, setClosing] = React.useState(false);

  useEffect(() => {
    const handleApprovalRequest = (event: CustomEvent) => {
      setCurrentRequest(event.detail);
    };

    window.addEventListener('instrument-approval-request', handleApprovalRequest as EventListener);

    return () => {
      window.removeEventListener('instrument-approval-request', handleApprovalRequest as EventListener);
    };
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setCurrentRequest(null);
      setClosing(false);
    }, 300);
  };

  return (
    <AnimatePresence>
      {currentRequest && (
        <InstrumentApprovalModal
          request={currentRequest}
          closing={closing}
        />
      )}
    </AnimatePresence>
  );
};
