import { lazy } from 'react';

export const ObservabilityDashboard = lazy(() =>
  import('@/modules/observability/ObservabilityDashboard').then(m => ({ default: m.ObservabilityDashboard }))
);
