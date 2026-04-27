import React, { useState } from 'react';
import { ChevronDown, AlertCircle, Zap } from 'lucide-react';
import type { LivingPlan } from '@/services/agent/LivingPlanService';

interface PlanCardProps {
  plan: LivingPlan;
  onApprove: () => void;
  onRefine: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  onApprove,
  onRefine,
  onCancel,
  isLoading = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { draft } = plan;

  const getShapeIcon = () => {
    switch (draft.shape) {
      case 'atomic':
        return '⚡';
      case 'workflow':
        return '🔗';
      case 'timeline':
        return '📅';
    }
  };

  const getShapeLabel = () => {
    switch (draft.shape) {
      case 'atomic':
        return 'One-shot';
      case 'workflow':
        return 'Multi-step';
      case 'timeline':
        return 'Scheduled';
    }
  };

  return (
    <div className="my-4 rounded-lg border border-cyan-200/30 bg-cyan-50/5 p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">{getShapeIcon()}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              {getShapeLabel()} Plan
            </span>
            {draft.autoApprove && (
              <span className="text-xs text-green-400">Auto-approve</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white">{draft.summary}</h3>
          {draft.durationDays && (
            <p className="mt-1 text-xs text-cyan-300">
              Duration: {draft.durationDays} days
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded p-1 hover:bg-cyan-500/10"
          aria-label="Expand plan details"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-cyan-200/20 pt-3">
          {/* Steps / Phases */}
          {draft.shape !== 'timeline' && draft.steps && draft.steps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-cyan-300">Steps</h4>
              <ol className="mt-2 space-y-1">
                {draft.steps.map((step, i) => (
                  <li key={step.id} className="text-xs text-cyan-200/70">
                    <span className="font-semibold">{i + 1}.</span> {step.title}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {draft.shape === 'timeline' && draft.phases && draft.phases.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-cyan-300">Phases</h4>
              <ol className="mt-2 space-y-1">
                {draft.phases.map((phase, i) => (
                  <li key={phase.id} className="text-xs text-cyan-200/70">
                    <span className="font-semibold">{i + 1}.</span> {phase.title} ({phase.days}d)
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Cost & Risks */}
          <div className="grid grid-cols-2 gap-2">
            {draft.estimatedCost && (
              <div className="rounded bg-cyan-500/10 p-2">
                <p className="text-xs text-cyan-300">Est. Cost</p>
                <p className="text-xs font-semibold text-white">
                  ${draft.estimatedCost.dollars.toFixed(2)}
                </p>
              </div>
            )}
            {draft.risks && draft.risks.length > 0 && (
              <div className="rounded bg-orange-500/10 p-2">
                <p className="flex items-center gap-1 text-xs text-orange-300">
                  <AlertCircle size={12} />
                  {draft.risks.length} Risk{draft.risks.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {draft.risks && draft.risks.length > 0 && (
            <div className="text-xs text-orange-200/70">
              {draft.risks.map((risk, i) => (
                <p key={i} className="mb-1">
                  • {risk}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        {plan.status === 'drafting' ? (
          <>
            {!draft.autoApprove ? (
              <button
                onClick={onApprove}
                disabled={isLoading}
                className="flex-1 rounded bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {isLoading ? 'Running...' : 'Approve & Start'}
              </button>
            ) : (
              <button
                onClick={onApprove}
                disabled={isLoading}
                className="flex-1 rounded bg-green-500/20 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/30 disabled:opacity-50"
              >
                {isLoading ? <Zap size={14} className="animate-pulse inline mr-1" /> : '✓ Start Auto-plan'}
              </button>
            )}
            <button
              onClick={onRefine}
              disabled={isLoading}
              className="rounded bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-white/10 disabled:opacity-50"
            >
              Refine
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="rounded bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="flex-1 rounded bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-400 text-center border border-cyan-500/20">
            {plan.status === 'cancelled' ? 'Plan Cancelled' : 'Plan Active'}
          </div>
        )}
        {!draft.autoApprove && (
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 rounded bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {isLoading ? 'Running...' : 'Approve & Run'}
          </button>
        )}
        {draft.autoApprove && (
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 rounded bg-green-500/20 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/30 disabled:opacity-50"
          >
            {isLoading ? <Zap size={14} className="inline mr-1" /> : '✓ Auto-run'}
          </button>
        )}
        <button
          onClick={onRefine}
          disabled={isLoading}
          className="rounded bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
        >
          Refine
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="rounded bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
