import { logger } from '@/utils/logger';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './core/App';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import { initViewportFixes, initKeyboardDetection } from '@/lib/mobile';
import { initSentry } from '@/lib/sentry';
import { getConsentPreferences } from '@/components/shared/CookieConsentBanner';
import '@/core/i18n'; // Initialize i18n before any component renders
import './index.css';

// Item 303: Gate Sentry initialization on cookie consent.
// If user has previously consented to error tracking, initialize immediately.
// Otherwise, CookieConsentBanner will initialize it after consent is granted.
const consent = getConsentPreferences();
if (consent?.errorTracking) {
    initSentry();
} else if (!consent) {
    // No consent recorded yet — Sentry will be initialized by CookieConsentBanner
    // after the user makes their choice.
}


logger.debug("Indii OS Studio v1.2.6-manual-redeploy");
document.title = "indiiOS - Studio (v1.2.6)";

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
