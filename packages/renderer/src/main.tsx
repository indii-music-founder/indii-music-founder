// Polyfill: crypto.randomUUID is unavailable in non-secure contexts (HTTP IP addresses).
// The app may be accessed via http://192.168.x.x:4242 from phones on the local network.
// This polyfill uses crypto.getRandomValues which IS available in non-secure contexts.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6]! & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8]! & 0x3f) | 0x80; // Variant 10
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
    };
}

import { logger } from '@/utils/logger';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './core/App';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import { initViewportFixes, initKeyboardDetection } from '@/lib/mobile';
import { renderStartupFallback } from '@/startupFallback';
import '@/core/i18n'; // Initialize i18n before any component renders
import './index.css';

// Import global test harness
import { initSentry } from '@/services/observability/SentryService';

// Initialize Sentry before the app renders. 
// Item 303: Consent is checked internally within initSentry.
try {
    initSentry();
} catch (error: unknown) {
    logger.warn('[Startup] Sentry initialization failed (non-blocking):', error);
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
} catch (fatalError: unknown) {
    // LAST RESORT: If React fails to mount (Firebase crash, import chain break,
    // missing env vars), render a bare-metal fallback directly in the DOM.
    // This prevents the infinite CSS spinner that traps users on a blank page.
    // Incident 2026-03-11: App Check re-throw killed React before mount.
    logger.error('[FATAL] React failed to mount:', fatalError);
    const reason = fatalError instanceof Error ? fatalError.message : 'Unknown startup error';
    renderStartupFallback(`Something went wrong during startup. ${reason}`);
}

// Initialize mobile utilities (after React root is created)
initViewportFixes();
initKeyboardDetection();

// Phase 1: Initialize PWA and offline services
Promise.all([
    import('@/services/sync/OfflineFirstService').then(({ offlineFirstService }) => offlineFirstService),
    import('@/services/network/NetworkQualityMonitor').then(({ initializeNetworkQualityMonitor }) => initializeNetworkQualityMonitor()),
    import('@/services/cache/MediaCacheManager').then(({ initializeMediaCacheManager }) => initializeMediaCacheManager()),
]).then(async ([offlineService, _networkMonitor, _mediaCache]) => {
    const { initializeBackgroundSyncManager } = await import('@/services/sync/BackgroundSyncManager');
    initializeBackgroundSyncManager(offlineService);
    logger.info('[Phase 1] PWA and offline services initialized');
}).catch(err => {
    logger.error('[Phase 1] Failed to initialize offline services:', err);
});

// Phase 2: Initialize memory and orchestration services
Promise.all([
    import('@/services/memory/PersistentMemoryService').then(({ initializePersistentMemoryService: _initializePersistentMemoryService }) => {
        // Initialized with user ID after auth
        return Promise.resolve();
    }),
    import('@/services/memory/MemoryIndexService').then(({ initializeMemoryIndexService }) => initializeMemoryIndexService()),
    import('@/services/agent/ContextStackService').then(({ initializeContextStackService }) => initializeContextStackService()),
    import('@/services/agent/ReflectionLoop').then(({ initializeReflectionLoop }) => initializeReflectionLoop()),
]).then(() => {
    logger.info('[Phase 2] Memory and orchestration services initialized');
}).catch(err => {
    logger.warn('[Phase 2] Failed to initialize orchestration services (non-blocking):', err);
});

// Phase 3: Initialize observability and performance monitoring
Promise.all([
    import('@/services/observability/RealUserMonitoringService').then(({ initializeRealUserMonitoring }) => initializeRealUserMonitoring()),
    import('@/services/observability/CoreWebVitalsReporter').then(({ getCoreWebVitalsReporter }) => getCoreWebVitalsReporter()),
    import('@/services/observability/RequestTracingService').then(({ getRequestTracingService }) => getRequestTracingService()),
    import('@/services/observability/BundleAnalysisService').then(({ getBundleAnalysisService }) => getBundleAnalysisService()),
]).then(() => {
    logger.info('[Phase 3] Observability and performance monitoring initialized');
}).catch(err => {
    logger.warn('[Phase 3] Failed to initialize observability services (non-blocking):', err);
});

// Item 260: Core Web Vitals reporting
import('@/lib/webVitals').then(({ initWebVitals }) => initWebVitals()).catch(() => { });

// Disable Default Drag-and-Drop (HEY Audit Hardening)
// Prevents the app from navigating to dropped files (potential RCE)
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
    event.preventDefault();
});
