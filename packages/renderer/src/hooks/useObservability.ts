/**
 * useObservability — React hook for observability services
 *
 * Provides access to Core Web Vitals, request tracing, and bundle analysis
 */

import { useEffect, useState } from 'react';
import { getRealUserMonitoringService, getCoreWebVitalsReporter, getRequestTracingService, getBundleAnalysisService } from '@/services/observability';
import type { RUMSnapshot, VitalsReport } from '@/services/observability';

export interface ObservabilityMetrics {
  rum: RUMSnapshot | null;
  vitalsReport: VitalsReport | null;
  isReady: boolean;
}

export const useObservability = () => {
  const [metrics, setMetrics] = useState<ObservabilityMetrics>({
    rum: null,
    vitalsReport: null,
    isReady: false,
  });

  useEffect(() => {
    const rum = getRealUserMonitoringService();
    const reporter = getCoreWebVitalsReporter();

    const handleMetricsReady = (snapshot: RUMSnapshot) => {
      const report = reporter.reportMetrics(snapshot);
      setMetrics({
        rum: snapshot,
        vitalsReport: report,
        isReady: true,
      });
    };

    rum.onMetricsReady(handleMetricsReady);

    // Report metrics on page visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        rum.reportMetrics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const startRequest = (method: string, url: string) => {
    const tracing = getRequestTracingService();
    return tracing.startTrace(method, url);
  };

  const endRequest = (correlationId: string, status: number) => {
    const tracing = getRequestTracingService();
    tracing.endTrace(correlationId, status);
  };

  const getBundleMetrics = () => {
    const bundle = getBundleAnalysisService();
    return bundle.getMetrics();
  };

  const getRequestMetrics = () => {
    const tracing = getRequestTracingService();
    return tracing.getMetrics();
  };

  return {
    metrics,
    startRequest,
    endRequest,
    getBundleMetrics,
    getRequestMetrics,
  };
};
