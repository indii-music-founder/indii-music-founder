import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DownloadCloud, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Requirement 169: Native Share Sheet Integration
 * This component acts as the receiver for the PWA Web Share Target API.
 * When a user shares a file from their OS (iOS/Android) to the indiiOS app,
 * the service worker routes the POST request here.
 */

export const ShareTargetReceiver: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('Receiving shared content...');

    useEffect(() => {
        const handleSharedContent = async () => {
            try {
                // In a true Service Worker implementation, the SW intercepts the POST
                // and caches the files in IndexedDB, then redirects here.
                // We read from the known DB cache or URL params.

                const urlParams = new URLSearchParams(window.location.search);
                const title = urlParams.get('title');
                const text = urlParams.get('text');
                const url = urlParams.get('url');

                // Simulate reading cached file from SW
                const hasFiles = false; // Would check IndexedDB in reality

                if (!title && !text && !url && !hasFiles) {
                    setStatus('error');
                    setMessage('No content was received.');
                    return;
                }

                // Route the content based on type
                if (url || text) {
                    setMessage(`Received link/text. Forwarding to indii Conductor...`);
                    setTimeout(() => {
                        // Pass the shared link directly into the chat input via query param
                        navigate(`/?initialPrompt=${encodeURIComponent(`Analyze this shared content: ${title || ''} ${text || ''} ${url || ''}`)}`);
                    }, 1500);
                } else if (hasFiles) {
                    setMessage('Processing shared media files...');
                    setTimeout(() => {
                        navigate('/?module=tools');
                    }, 1500);
                }

                setStatus('success');

            } catch (error) {
                console.error('[ShareTarget] Failed to process shared content', error);
                setStatus('error');
                setMessage('Failed to process incoming content.');
            }
        };

        handleSharedContent();
    }, [navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white">
            <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 max-w-md w-full text-center shadow-2xl">

                {status === 'processing' && (
                    <div className="animate-pulse flex justify-center mb-6">
                        <div className="p-4 bg-blue-500/20 rounded-full">
                            <DownloadCloud className="w-10 h-10 text-blue-400" />
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-green-500/20 rounded-full">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-500/20 rounded-full">
                            <AlertCircle className="w-10 h-10 text-red-400" />
                        </div>
                    </div>
                )}

                <h2 className="text-xl font-bold mb-2">indiiOS Share Hub</h2>
                <p className="text-gray-400">{message}</p>

                {status === 'error' && (
                    <button
                        onClick={() => navigate('/')}
                        className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors w-full"
                    >
                        Return to Studio
                    </button>
                )}
            </div>
        </div>
    );
};