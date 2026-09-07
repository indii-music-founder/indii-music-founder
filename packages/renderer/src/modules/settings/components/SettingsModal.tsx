import React from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import SettingsPanel from '../SettingsPanel';

export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            titleId="settings-modal-title"
            maxWidth="max-w-5xl"
            className="h-[85vh] bg-[#0c1015] border-white/10 p-0 overflow-hidden flex flex-col relative"
        >
            <div className="sr-only" id="settings-modal-title">
                System Settings
            </div>

            {/* Top Right Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close settings (Esc)"
                title="Close (Esc)"
            >
                <X size={18} />
            </button>

            {/* Embedded Settings Panel */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {isOpen && <SettingsPanel />}
            </div>
        </Modal>
    );
};

export default SettingsModal;
