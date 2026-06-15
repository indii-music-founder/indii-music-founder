import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';
import { AlertCircle } from 'lucide-react';
import type { WalletInfo } from '@/services/web3/WalletConnectService';

interface WalletConnectProps {
    projectId: string;
}

export const WalletConnectModal = createCallable<WalletConnectProps, WalletInfo | null>(({ call, projectId }) => {
    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId="wallet-connect-title" maxWidth="max-w-md">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4 text-amber-400">
                    <AlertCircle size={24} />
                    <h2 id="wallet-connect-title" className="text-xl font-bold">WalletConnect Unavailable</h2>
                </div>
                <div className="text-gray-300 mb-6 space-y-4">
                    <p>
                        The real <code>@reown/appkit</code> SDK is not currently wired in this environment.
                    </p>
                    <p className="text-sm opacity-80">
                        (ISSUE-184 is blocked pending AppKit installation and setup.)
                    </p>
                    {/* Hide unused var warning */}
                    <span className="hidden">{projectId}</span>
                </div>
                <div className="flex justify-end gap-3">
                    <Button variant="default" onClick={() => call.end(null)}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
});
