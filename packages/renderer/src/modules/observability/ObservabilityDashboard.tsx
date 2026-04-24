/**
 * ObservabilityDashboard.tsx
 * Real User Monitoring (RUM) dashboard for performance metrics
 */

import React, { useEffect, useState, useCallback } from 'react';
import { getRealUserMonitoringService, getCoreWebVitalsReporter, getRequestTracingService, getBundleAnalysisService } from '@/services/observability';
import type { RUMSnapshot, VitalsReport } from '@/services/observability';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MetricPoint {
  timestamp: string;
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

interface RequestMetrics {
  totalTraces: number;
  errorCount: number;
  avgDuration: number;
}

export const ObservabilityDashboard: React.FC = () => {
  const [rumSnapshot, setRumSnapshot] = useState<RUMSnapshot | null>(null);
  const [vitalsReport, setVitalsReport] = useState<VitalsReport | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricPoint[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<RequestMetrics>({ totalTraces: 0, errorCount: 0, avgDuration: 0 });
  const [bundleMetrics, setBundleMetrics] = useState<{ jsSize: number; cssSize: number; totalSize: number } | null>(null);

  const handleMetricsUpdate = useCallback((snapshot: RUMSnapshot) => {
    const reporter = getCoreWebVitalsReporter();

    setRumSnapshot(snapshot);
    const report = reporter.reportMetrics(snapshot);
    setVitalsReport(report);

    const point: MetricPoint = {
      timestamp: new Date(snapshot.timestamp).toLocaleTimeString(),
      lcp: snapshot.vitals['LCP']?.value,
      inp: snapshot.vitals['INP']?.value,
      cls: snapshot.vitals['CLS']?.value,
      fcp: snapshot.vitals['FCP']?.value,
      ttfb: snapshot.vitals['TTFB']?.value,
    };
    setMetricHistory(prev => [...prev.slice(-20), point]);
  }, []);

  useEffect(() => {
    const rum = getRealUserMonitoringService();
    const tracing = getRequestTracingService();
    const bundle = getBundleAnalysisService();

    rum.onMetricsReady(handleMetricsUpdate);

    const requestInterval = setInterval(() => {
      setRequestMetrics(tracing.getMetrics());
    }, 5000);

    const metrics = bundle.getMetrics();
    if (metrics) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBundleMetrics({
        jsSize: metrics.jsSize,
        cssSize: metrics.cssSize,
        totalSize: metrics.totalSize,
      });
    }

    return () => clearInterval(requestInterval);
  }, [handleMetricsUpdate]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'good': return 'bg-green-900 text-green-200';
      case 'needs-improvement': return 'bg-yellow-900 text-yellow-200';
      case 'poor': return 'bg-red-900 text-red-200';
      default: return 'bg-gray-900 text-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Performance Monitoring</h1>
        <p className="text-slate-400">Real User Monitoring (RUM) Dashboard</p>
      </div>

      {vitalsReport && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Core Web Vitals</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {vitalsReport.vitals.map(vital => (
              <div key={vital.metric} className="bg-slate-700 rounded p-4">
                <div className="text-xs text-slate-400 mb-1">{vital.metric}</div>
                <div className="text-2xl font-bold text-white">{vital.value.toFixed(0)}</div>
                <div className="text-xs text-slate-400 mt-1">{vital.threshold}ms threshold</div>
                <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(vital.status)}`}>
                  {vital.status}
                </div>
              </div>
            ))}
          </div>
          {vitalsReport.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded">
              <div className="text-sm font-semibold text-red-200 mb-2">⚠️ Issues Found</div>
              <ul className="text-xs text-red-300 space-y-1">
                {vitalsReport.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {metricHistory.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Metric Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metricHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              {metricHistory.some(p => p.lcp !== undefined) && <Line type="monotone" dataKey="lcp" stroke="#10b981" name="LCP" />}
              {metricHistory.some(p => p.inp !== undefined) && <Line type="monotone" dataKey="inp" stroke="#3b82f6" name="INP" />}
              {metricHistory.some(p => p.fcp !== undefined) && <Line type="monotone" dataKey="fcp" stroke="#8b5cf6" name="FCP" />}
              {metricHistory.some(p => p.ttfb !== undefined) && <Line type="monotone" dataKey="ttfb" stroke="#f59e0b" name="TTFB" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">Request Tracing</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-700 rounded p-4">
            <div className="text-xs text-slate-400 mb-1">Total Requests</div>
            <div className="text-2xl font-bold text-white">{requestMetrics.totalTraces}</div>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <div className="text-xs text-slate-400 mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-400">{requestMetrics.errorCount}</div>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <div className="text-xs text-slate-400 mb-1">Avg Duration</div>
            <div className="text-2xl font-bold text-white">{requestMetrics.avgDuration.toFixed(0)}ms</div>
          </div>
        </div>
      </div>

      {bundleMetrics && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Bundle Analysis</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[{ name: 'Bundle', jsSize: bundleMetrics.jsSize, cssSize: bundleMetrics.cssSize }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(value: number) => (value / 1024).toFixed(1)} />
              <Legend />
              <Bar dataKey="jsSize" fill="#3b82f6" name="JS" />
              <Bar dataKey="cssSize" fill="#10b981" name="CSS" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              Total: <span className="text-white font-semibold">{formatSize(bundleMetrics.totalSize)}</span>
            </div>
          </div>
        </div>
      )}

      {rumSnapshot && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-xs text-slate-400 space-y-1">
            <div>Session ID: <code className="text-slate-300">{rumSnapshot.sessionId}</code></div>
            <div>Page Load Time: {rumSnapshot.pageLoadTime.toFixed(0)}ms</div>
            <div>URL: {rumSnapshot.url}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObservabilityDashboard;
