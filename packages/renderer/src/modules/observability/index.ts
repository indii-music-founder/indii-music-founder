import { lazy } from 'react';

export const ObservabilityDashboard = lazy(() =>
  import('./ObservabilityDashboard').then(m => ({ default: m.ObservabilityDashboard }))
);
