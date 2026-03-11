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

try {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <BrowserRouter>
                <ErrorBoundary>
                    <App />
                </ErrorBoundary>
            </BrowserRouter>
        </React.StrictMode>,
    );
} catch (fatalError) {
    // LAST RESORT: If React fails to mount (Firebase crash, import chain break,
    // missing env vars), render a bare-metal fallback directly in the DOM.
    // This prevents the infinite CSS spinner that traps users on a blank page.
    // Incident 2026-03-11: App Check re-throw killed React before mount.
    logger.error('[FATAL] React failed to mount:', fatalError);
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0f;color:#e4e4e7;font-family:system-ui,sans-serif;padding:2rem;text-align:center">
                <div style="max-width:420px">
                    <h1 style="font-size:1.5rem;margin-bottom:1rem;color:#a78bfa">indiiOS</h1>
                    <p style="margin-bottom:1.5rem;opacity:0.8">Something went wrong during startup. This is usually a temporary issue.</p>
                    <button onclick="location.reload()" style="background:#7c3aed;color:white;border:none;padding:0.75rem 2rem;border-radius:0.5rem;font-size:1rem;cursor:pointer">
                        Reload App
                    </button>
                    <p style="margin-top:1.5rem;font-size:0.75rem;opacity:0.4">${fatalError instanceof Error ? fatalError.message : 'Unknown error'}</p>
                </div>
            </div>
        `;
    }
}

// Initialize mobile utilities (after React root is created)
initViewportFixes();
initKeyboardDetection();

// Item 260: Core Web Vitals reporting
import('@/lib/webVitals').then(({ initWebVitals }) => initWebVitals()).catch(() => { });

// Disable Default Drag-and-Drop (HEY Audit Hardening)
// Prevents the app from navigating to dropped files (potential RCE)
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
    event.preventDefault();
});
