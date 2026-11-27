export { RealUserMonitoringService, getRealUserMonitoringService, initializeRealUserMonitoring } from '@/services/observability/RealUserMonitoringService';
export type { VitalMetric, RUMSnapshot } from '@/services/observability/RealUserMonitoringService';

export { CoreWebVitalsReporter, getCoreWebVitalsReporter } from '@/services/observability/CoreWebVitalsReporter';
export type { VitalStatus, VitalsReport } from '@/services/observability/CoreWebVitalsReporter';

export { RequestTracingService, getRequestTracingService } from '@/services/observability/RequestTracingService';
export type { RequestTrace } from '@/services/observability/RequestTracingService';

export { BundleAnalysisService, getBundleAnalysisService } from '@/services/observability/BundleAnalysisService';
export type { BundleMetrics, BudgetThreshold } from '@/services/observability/BundleAnalysisService';
