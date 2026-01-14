import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './core/App';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import { initViewportFixes, initKeyboardDetection } from '@/lib/mobile';
import { initSentry } from '@/lib/sentry';
import './index.css';

// Initialize Sentry error tracking BEFORE rendering
initSentry();

// SECURITY: Block TEST_MODE bypass in production builds
// This is a defense-in-depth measure - authSlice also checks this
if (import.meta.env.PROD && typeof window !== 'undefined' && localStorage.getItem('TEST_MODE')) {
    localStorage.removeItem('TEST_MODE');
    console.error('[Security] TEST_MODE disabled in production');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </BrowserRouter>
    </React.StrictMode>,
);

// Initialize mobile utilities (after React root is created)
initViewportFixes();
initKeyboardDetection();

// Disable Default Drag-and-Drop (HEY Audit Hardening)
// Prevents the app from navigating to dropped files (potential RCE)
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
    event.preventDefault();
});
