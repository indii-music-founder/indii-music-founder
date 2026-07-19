import React, { useState, useEffect } from 'react';
import { HelpCircle, Loader2, CheckCircle2, ExternalLink, AlertCircle, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrgAdapter, CatalogTrack, FormValues, RegistrationField, SubmissionResult } from '../types';
import { compileHarness } from '@/services/business-harness/HarnessCompiler';
import type { HarnessRun } from '@indii/shared';
import type { PublishingRightsOutput } from '@/services/publishing/PublishingRightsCompiler';
import { computePassportHash, validateApprovalFreshness } from '../services/PassportHashService';
import { persistOrgRecord } from '../services/RegistrationPersistence';

interface RegistrationFormProps {
  adapter: OrgAdapter;
  track: CatalogTrack;
  userId: string;
  onSubmitComplete: (result: SubmissionResult) => void;
}

function autoFillFromTrack(fields: RegistrationField[], track: CatalogTrack): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.autoFillFrom) {
      const raw = track[field.autoFillFrom];
      if (raw !== undefined && raw !== null) {
        if (field.type === 'boolean') {
          values[field.id] = Boolean(raw);
        } else if (field.type === 'textarea' && Array.isArray(raw)) {
          values[field.id] = (raw as Array<{ name: string; role: string; percentage: number }>)
            .map(w => `${w.name} — ${w.role} — ${w.percentage}%`)
            .join('\n');
        } else {
          values[field.id] = String(raw);
        }
      }
    }
  }
  return values;
}

function FieldTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-gray-600 hover:text-gray-400 transition-colors ml-1"
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-56 bg-[#1e2128] border border-white/10 rounded-lg p-3 text-xs text-gray-300 shadow-xl">
          {text}
        </div>
      )}
    </div>
  );
}

export function RegistrationForm({ adapter, track, userId, onSubmitComplete }: RegistrationFormProps) {
  const [values, setValues] = useState<FormValues>(() => autoFillFromTrack(adapter.fields, track));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [harnessRun, setHarnessRun] = useState<HarnessRun<PublishingRightsOutput> | null>(null);
  const [approvalGranted, setApprovalGranted] = useState(false);
  const [approvalPassportHash, setApprovalPassportHash] = useState<string | null>(null);
  // ISSUE-570: Pause gates at critical user-confirmation steps
  const [pausePhase, setPausePhase] = useState<'certification' | 'payment' | 'final_submit' | null>(null);
  const [pauseConfirmed, setPauseConfirmed] = useState(false);

  // Re-fill if track or adapter changes — keyed by .id to avoid
  // unnecessary re-fills on shallow prop reference changes.
  useEffect(() => {
    setValues(autoFillFromTrack(adapter.fields, track));
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter.id, track.id]);

  // Determine which fields are gap fields (not auto-filled + required)
  const gapFields = adapter.fields.filter(f => f.required && (values[f.id] === undefined || values[f.id] === ''));
  const autoFilledFields = adapter.fields.filter(f => values[f.id] !== undefined && values[f.id] !== '');

  const handleChange = (fieldId: string, value: string | boolean | string[]) => {
    setValues(v => ({ ...v, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // ISSUE-570: Pause gate 1 — certification review
      if (!pausePhase) {
        setPausePhase('certification');
        setSubmitting(false);
        return;
      }

      // ISSUE-566: Compile readiness harness before submission
      if (!harnessRun) {
         
        const run = await compileHarness('publishing_rights', {
          songId: track.id,
          songTitle: track.title,
          writers: track.writersAndContributors || [],
          proRegistrationStatus: 'unregistered',
          mlcRegistrationStatus: 'unregistered',
        }, { userId, save: true }) as HarnessRun<PublishingRightsOutput>;
        setHarnessRun(run);

        // Check for blockers
        if (run.output.blockers && run.output.blockers.length > 0) {
          setResult({
            success: false,
            errorMessage: `Registration blocked: ${run.output.blockers[0]}`,
            submittedAt: new Date(),
          });
          setSubmitting(false);
          return;
        }

        // ISSUE-567: Check approval freshness
        if (approvalGranted && approvalPassportHash) {
          const freshness = await validateApprovalFreshness(track, approvalPassportHash);
          if (!freshness.isFresh) {
            setResult({
              success: false,
              errorMessage: `Approval stale: ${freshness.reason}. Please re-approve.`,
              submittedAt: new Date(),
            });
            setApprovalGranted(false);
            setApprovalPassportHash(null);
            setSubmitting(false);
            return;
          }
        }

        // Check for approval gate
        const fileRegGate = run.approvalGates.find(g => g.id === 'file_registration' || g.riskTier === 'approval');
        if (fileRegGate && !approvalGranted) {
          // Gate exists and not approved — compute passport hash and request approval
          const passportHash = await computePassportHash(track);
          setApprovalPassportHash(passportHash);
          setResult({
            success: false,
            errorMessage: `Awaiting approval: ${fileRegGate.reason}`,
            submittedAt: new Date(),
          });
          setSubmitting(false);
          return;
        }

        if (!approvalGranted && fileRegGate) {
          // Mark approval as granted
          const passportHash = await computePassportHash(track);
          setApprovalPassportHash(passportHash);
        }
        setApprovalGranted(true);
      }

      // ISSUE-570: Pause gate 2 — final submission confirmation
      if (pausePhase === 'certification' && !pauseConfirmed) {
        setPausePhase('final_submit');
        setSubmitting(false);
        return;
      }

      // All gates passed — proceed with submission
      const res = await adapter.submit(values, track, userId);
      setResult(res);
      setPausePhase(null);
      setPauseConfirmed(false);
      onSubmitComplete(res);
    } catch (err) {
      const errResult: SubmissionResult = {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Submission failed',
        submittedAt: new Date(),
      };
      setResult(errResult);
      onSubmitComplete(errResult);
    } finally {
      setSubmitting(false);
    }
  };

  // ISSUE-570: Pause-gate confirmation dialogs
  if (pausePhase === 'certification' && !pauseConfirmed) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-200 font-semibold">Certification Review</p>
            <p className="text-xs text-blue-200/70 mt-1">Please review the form data and catalog details below before submitting. Once submitted, this filing is binding.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setPauseConfirmed(true);
            setSubmitting(true);
            handleSubmit({ preventDefault: () => {} } as any);
          }}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all duration-200"
        >
          I've reviewed — proceed to filing
        </button>
        <button
          type="button"
          onClick={() => setPausePhase(null)}
          className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Cancel & review form
        </button>
      </div>
    );
  }

  if (pausePhase === 'final_submit' && pauseConfirmed) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200 font-semibold">Final Submission Confirmation</p>
            <p className="text-xs text-amber-200/70 mt-1">This submission to {adapter.name} is binding and cannot be undone. Confirm you want to proceed.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setPauseConfirmed(false);
            setSubmitting(true);
            handleSubmit({ preventDefault: () => {} } as any);
          }}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20 transition-all duration-200"
        >
          Confirm & submit to {adapter.name}
        </button>
        <button
          type="button"
          onClick={() => {
            setPausePhase(null);
            setPauseConfirmed(false);
          }}
          className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <SubmissionResultView
        result={result}
        adapter={adapter}
        onReset={() => setResult(null)}
        onRetryPersist={async () => {
          const persisted = await persistOrgRecord(userId, track.id, adapter.id, values, result.confirmationNumber);
          if (persisted) {
            const updated = { ...result, localRecordFailed: false };
            setResult(updated);
            onSubmitComplete(updated);
          }
          return persisted;
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Gap fields — user input required */}
      {gapFields.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            I need {gapFields.length} thing{gapFields.length > 1 ? 's' : ''} from you
          </p>
          {gapFields.map(field => (
            <FormField key={field.id} field={field} value={values[field.id] ?? ''} onChange={handleChange} highlight />
          ))}
        </div>
      )}

      {/* Auto-filled fields — shown collapsed, tap to edit */}
      {autoFilledFields.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-1">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            {autoFilledFields.length} field{autoFilledFields.length > 1 ? 's' : ''} pre-filled from your catalog (tap to review)
          </summary>
          <div className="mt-3 space-y-3 pl-3 border-l border-white/[0.06]">
            {autoFilledFields.map(field => (
              <FormField key={field.id} field={field} value={values[field.id] ?? ''} onChange={handleChange} />
            ))}
          </div>
        </details>
      )}

      {gapFields.length === 0 && (
        <p className="text-xs text-green-400/80 flex items-center gap-1.5">
          <CheckCircle2 size={13} />
          Everything is pre-filled. Review the fields above and submit when ready.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={cn(
          'w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200',
          submitting
            ? 'bg-white/5 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'
        )}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Submitting to {adapter.shortName}…
          </span>
        ) : (
          `Submit to ${adapter.name}`
        )}
      </button>

      {adapter.fee && adapter.fee.amount > 0 && (
        <p className="text-center text-xs text-gray-600">
          Filing fee: ${adapter.fee.amount} {adapter.fee.currency}
          {adapter.fee.notes && ` · ${adapter.fee.notes}`}
        </p>
      )}
    </form>
  );
}

function FormField({
  field,
  value,
  onChange,
  highlight = false,
}: {
  field: RegistrationField;
  value: FormValues[string];
  onChange: (id: string, val: string | boolean | string[]) => void;
  highlight?: boolean;
  key?: React.Key;
}) {
  const baseInput = cn(
    'w-full bg-white/[0.04] border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors',
    highlight
      ? 'border-green-500/40 focus:border-green-400'
      : 'border-white/[0.06] focus:border-white/20'
  );

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-0.5">
        {field.label}
        {field.required && <span className="text-green-400 ml-0.5">*</span>}
        {field.helpText && <FieldTooltip text={field.helpText} />}
      </label>

      {field.type === 'boolean' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(field.id, true)}
            className={cn('px-4 py-1.5 rounded-lg text-sm border transition-colors', value === true ? 'bg-green-600 border-green-500 text-white' : 'border-white/10 text-gray-400 hover:border-white/20')}
          >Yes</button>
          <button
            type="button"
            onClick={() => onChange(field.id, false)}
            className={cn('px-4 py-1.5 rounded-lg text-sm border transition-colors', value === false ? 'bg-green-600 border-green-500 text-white' : 'border-white/10 text-gray-400 hover:border-white/20')}
          >No</button>
        </div>
      ) : field.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={e => onChange(field.id, e.target.value)}
          className={cn(baseInput, 'bg-[#1a1d23]')}
        >
          <option value="">Select…</option>
          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={String(value ?? '')}
          onChange={e => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={cn(baseInput, 'resize-y')}
        />
      ) : (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={String(value ?? '')}
          onChange={e => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          className={baseInput}
        />
      )}
    </div>
  );
}

function SubmissionResultView({
  result,
  adapter,
  onReset,
  onRetryPersist,
}: {
  result: SubmissionResult;
  adapter: OrgAdapter;
  onReset: () => void;
  onRetryPersist?: () => Promise<boolean>;
}) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRetryPersist = async () => {
    if (!onRetryPersist) return;
    setRetrying(true);
    try {
      await onRetryPersist();
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyConfirmation = () => {
    if (!result.confirmationNumber) return;
    void navigator.clipboard.writeText(result.confirmationNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ISSUE-970: the external filing genuinely succeeded (real confirmation
  // number) but our own durable record failed to save — this is neither
  // plain success nor plain failure. Never let this silently render as a
  // green checkmark: the confirmation must stay visible/copyable until a
  // retry confirms it's durably saved.
  if (result.success && result.localRecordFailed) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/80">
            Your registration was submitted to {adapter.name} and is real and binding, but indii could not save a
            local record of it. <strong>Save this confirmation number now</strong> — if you leave this page before
            retrying, this receipt will not be recoverable here.
          </div>
        </div>
        {result.confirmationNumber && (
          <div className="flex items-center justify-between gap-2 p-3 bg-black/30 border border-white/10 rounded-lg">
            <span className="font-mono text-sm text-gray-200 truncate">{result.confirmationNumber}</span>
            <button
              onClick={handleCopyConfirmation}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        <button
          onClick={handleRetryPersist}
          disabled={retrying || !onRetryPersist}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-sm text-amber-200 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          {retrying ? <Loader2 size={14} className="animate-spin" /> : null}
          {retrying ? 'Retrying…' : 'Retry Saving Locally'}
        </button>
      </div>
    );
  }

  if (result.success) {
    return (
      <div className="text-center space-y-4 py-4">
        <CheckCircle2 size={40} className="text-green-400 mx-auto" />
        <div>
          <p className="text-white font-semibold">Submitted to {adapter.name}</p>
          {result.confirmationNumber && (
            <p className="text-sm text-gray-400 mt-1">
              Confirmation: <span className="font-mono text-gray-200">{result.confirmationNumber}</span>
            </p>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Submitted {result.submittedAt.toLocaleDateString('en-US')}
          </p>
        </div>
      </div>
    );
  }

  if (result.requiresManualStep) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/80">
            {result.manualStepInstructions}
          </div>
        </div>
        {result.manualStepUrl && (
          <a
            href={result.manualStepUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-sm text-gray-300 hover:border-white/20 hover:text-white transition-colors"
          >
            <ExternalLink size={14} />
            Open {adapter.name}
          </a>
        )}
        <button onClick={onReset} className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Back to form
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-200/80">{result.errorMessage || 'Submission failed'}</p>
      </div>
      <button onClick={onReset} className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors">
        Try again
      </button>
    </div>
  );
}
