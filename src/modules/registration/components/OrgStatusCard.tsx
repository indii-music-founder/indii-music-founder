import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Circle, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrgAdapter, RegistrationStatus } from '../types';

interface OrgStatusCardProps {
  adapter: OrgAdapter;
  status: RegistrationStatus;
  confirmationNumber?: string;
  isSelected: boolean;
  onSelect: () => void;
}

const STATUS_CONFIG: Record<RegistrationStatus, {
  icon: React.ElementType;
  label: string;
  color: string;
  dot: string;
}> = {
  not_started: { icon: Circle, label: 'Not started', color: 'text-gray-500', dot: 'bg-gray-600' },
  in_progress: { icon: Clock, label: 'In progress', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  submitted: { icon: Clock, label: 'Submitted', color: 'text-blue-400', dot: 'bg-blue-400' },
  confirmed: { icon: CheckCircle2, label: 'Confirmed', color: 'text-green-400', dot: 'bg-green-400' },
  error: { icon: AlertCircle, label: 'Error', color: 'text-red-400', dot: 'bg-red-400' },
};

const CATEGORY_LABEL: Record<string, string> = {
  copyright: 'Copyright',
  pro: 'Performing Rights',
  digital: 'Digital Performance',
  mechanical: 'Mechanical',
};

export function OrgStatusCard({ adapter, status, confirmationNumber, isSelected, onSelect }: OrgStatusCardProps) {
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border p-4 transition-all duration-200 group',
        isSelected
          ? 'border-purple-500/60 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.3)]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Status dot */}
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', cfg.dot)} />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm truncate">{adapter.name}</span>
              {adapter.requiresDesktop && (
                <span className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">Desktop</span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">{CATEGORY_LABEL[adapter.category]}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn('flex items-center gap-1 text-xs', cfg.color)}>
            <StatusIcon size={12} />
            <span>{cfg.label}</span>
          </div>
          <ChevronRight
            size={14}
            className={cn('text-gray-600 transition-transform', isSelected && 'rotate-90 text-purple-400')}
          />
        </div>
      </div>

      {/* Confirmation number if confirmed */}
      {status === 'confirmed' && confirmationNumber && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] text-[11px] text-gray-500">
          Confirmation: <span className="text-gray-300 font-mono">{confirmationNumber}</span>
        </div>
      )}

      {/* Fee info for not-started */}
      {status === 'not_started' && adapter.fee && (
        <div className="mt-2 text-[11px] text-gray-600">
          {adapter.fee.amount === 0 ? 'Free' : `$${adapter.fee.amount} ${adapter.fee.currency}`}
          {adapter.timeline && ` · ${adapter.timeline}`}
        </div>
      )}

      {/* Manual step indicator */}
      {adapter.requiresDesktop && status === 'not_started' && !window.electronAPI && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-500/80">
          <ExternalLink size={10} />
          <span>Manual step required on web</span>
        </div>
      )}
    </button>
  );
}
