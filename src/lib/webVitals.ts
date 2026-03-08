/**
 * Item 260: Core Web Vitals Reporting
 *
 * Reports LCP, FID/INP, and CLS to Firebase Analytics.
 * Required for Google Search ranking and performance monitoring.
 *
 * Usage: import '@/lib/webVitals' in main.tsx
 */

import { logger } from '@/utils/logger';

interface WebVitalMetric {
    name: string;
    value: number;
    delta: number;
    id: string;
    rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Send a Web Vital metric to Firebase Analytics (if available).
 * Falls back to console logging in development.
 */
function reportMetric(metric: WebVitalMetric): void {
    const label = `[WebVitals] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})`;

    if (metric.rating === 'poor') {
        logger.warn(label);
    } else {
        logger.info(label);
    }

    // Report to Firebase Analytics if available
    if (typeof window !== 'undefined' && 'gtag' in window) {
        try {
            (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', metric.name, {
                event_category: 'Web Vitals',
                event_label: metric.id,
                value: Math.round(metric.name === 'CLS' ? metric.delta * 1000 : metric.delta),
                non_interaction: true,
            });
        } catch {
            // Analytics not ready, silently skip
        }
    }
}

/**
 * Initialize Core Web Vitals collection.
 * Dynamically imports `web-vitals` to avoid adding to the critical path.
 */
export async function initWebVitals(): Promise<void> {
    try {
        const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');

        onCLS(reportMetric as unknown as Parameters<typeof onCLS>[0]);
        onINP(reportMetric as unknown as Parameters<typeof onINP>[0]);
        onLCP(reportMetric as unknown as Parameters<typeof onLCP>[0]);
        onFCP(reportMetric as unknown as Parameters<typeof onFCP>[0]);
        onTTFB(reportMetric as unknown as Parameters<typeof onTTFB>[0]);

        logger.info('[WebVitals] Core Web Vitals monitoring initialized');
    } catch {
        // web-vitals not installed — silently skip
        logger.debug('[WebVitals] web-vitals library not available, skipping');
    }
}
