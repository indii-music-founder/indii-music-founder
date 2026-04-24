/**
 * ReflectionPanel Component
 *
 * Displays the reflection loop evaluation process with quality metrics,
 * iteration history, and refinement feedback.
 */

import React, { useState } from 'react';
import { getReflectionLoop } from '@/services/agent/ReflectionLoop';
import { Loader, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import type { ReflectionIteration } from '@/services/agent/ReflectionLoop';

interface ReflectionPanelProps {
  agentOutput: string;
  agentPrompt: string;
  context?: Record<string, unknown>;
  onReflectionComplete?: (iterations: ReflectionIteration[]) => void;
  className?: string;
}

export const ReflectionPanel: React.FC<ReflectionPanelProps> = ({
  agentOutput,
  agentPrompt,
  context,
  onReflectionComplete,
  className = ''
}) => {
  const [iterations, setIterations] = useState<ReflectionIteration[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startReflection = async () => {
    setIsRunning(true);
    setError(null);
    setIterations([]);

    try {
      const reflectionService = getReflectionLoop();
      const results = await reflectionService.runLoop(
        agentPrompt,
        agentOutput,
        context
      );

      setIterations(results);
      onReflectionComplete?.(results);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsRunning(false);
    }
  };

  const finalIteration = iterations[iterations.length - 1];
  const passed = finalIteration?.reflection.passesFinal ?? false;

  const MetricBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all',
            value >= 0.75 ? 'bg-green-500' : value >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
          )}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className={clsx('flex flex-col h-full bg-white rounded-lg border border-gray-200', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Reflection Loop</h2>
          {iterations.length > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-gray-700">{iterations.length} iteration{iterations.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <button
          onClick={startReflection}
          disabled={isRunning}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Evaluating...
            </>
          ) : (
            'Start Evaluation'
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm mb-4">
            <p className="font-semibold">Evaluation Error</p>
            <p>{error.message}</p>
          </div>
        )}

        {iterations.length === 0 && !isRunning && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Click "Start Evaluation" to analyze output quality</p>
          </div>
        )}

        {/* Iterations */}
        <div className="space-y-4">
          {iterations.map((iteration, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              {/* Iteration Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Iteration {iteration.iteration}
                  </span>
                  {iteration.reflection.passesFinal ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(iteration.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Quality Metrics */}
              <div className="bg-gray-50 p-3 rounded mb-3">
                <div className="text-sm font-medium text-gray-900 mb-2">Quality Metrics</div>
                <MetricBar
                  label="Correctness"
                  value={iteration.reflection.metrics.correctness}
                />
                <MetricBar label="Clarity" value={iteration.reflection.metrics.clarity} />
                <MetricBar
                  label="Completeness"
                  value={iteration.reflection.metrics.completeness}
                />
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Overall Score</span>
                    <span
                      className={clsx(
                        'text-lg font-bold',
                        iteration.reflection.metrics.overall >= 0.75
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      )}
                    >
                      {(iteration.reflection.metrics.overall * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-700 mb-1">Feedback</div>
                <p className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-200">
                  {iteration.reflection.feedback}
                </p>
              </div>

              {/* Suggested Refinement */}
              {iteration.reflection.suggestedRefinement && (
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="text-sm font-medium text-blue-900 mb-1">Suggested Refinement</div>
                  <p className="text-sm text-blue-700">
                    {iteration.reflection.suggestedRefinement}
                  </p>
                </div>
              )}

              {/* Status */}
              {iteration.reflection.passesFinal && (
                <div className="bg-green-50 p-2 rounded border border-green-200 text-sm text-green-700 font-medium">
                  ✓ Passed quality threshold
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Final Summary */}
        {finalIteration && !isRunning && (
          <div className={clsx(
            'mt-4 p-3 rounded-lg border',
            passed
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          )}>
            <div className={clsx(
              'text-sm font-semibold',
              passed ? 'text-green-900' : 'text-yellow-900'
            )}>
              {passed ? '✓ Evaluation Complete' : '⚠ Quality Below Threshold'}
            </div>
            <p className={clsx(
              'text-sm mt-1',
              passed ? 'text-green-700' : 'text-yellow-700'
            )}>
              {passed
                ? `Output passed quality evaluation after ${iterations.length} iteration${iterations.length !== 1 ? 's' : ''}`
                : `Output did not meet quality threshold after ${iterations.length} iteration${iterations.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
