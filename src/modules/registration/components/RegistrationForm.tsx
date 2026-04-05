import React, { useState, useEffect } from 'react';
import { HelpCircle, Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrgAdapter, CatalogTrack, FormValues, RegistrationField, SubmissionResult } from '../types';

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

  // Re-fill if track or adapter changes
  useEffect(() => {
    setValues(autoFillFromTrack(adapter.fields, track));
    setResult(null);
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
      const res = await adapter.submit(values, track, userId);
      setResult(res);
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

  if (result) {
    return <SubmissionResultView result={result} adapter={adapter} onReset={() => setResult(null)} />;
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
            <FormField key={field.id} field={field} value={values[field.id]} onChange={handleChange} highlight />
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
              <FormField key={field.id} field={field} value={values[field.id]} onChange={handleChange} />
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
            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
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
}) {
  const baseInput = cn(
    'w-full bg-white/[0.04] border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors',
    highlight
      ? 'border-purple-500/40 focus:border-purple-400'
      : 'border-white/[0.06] focus:border-white/20'
  );

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 flex items-center gap-0.5">
        {field.label}
        {field.required && <span className="text-purple-400 ml-0.5">*</span>}
        {field.helpText && <FieldTooltip text={field.helpText} />}
      </label>

      {field.type === 'boolean' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(field.id, true)}
            className={cn('px-4 py-1.5 rounded-lg text-sm border transition-colors', value === true ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 text-gray-400 hover:border-white/20')}
          >Yes</button>
          <button
            type="button"
            onClick={() => onChange(field.id, false)}
            className={cn('px-4 py-1.5 rounded-lg text-sm border transition-colors', value === false ? 'bg-purple-600 border-purple-500 text-white' : 'border-white/10 text-gray-400 hover:border-white/20')}
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
}: {
  result: SubmissionResult;
  adapter: OrgAdapter;
  onReset: () => void;
}) {
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
            Submitted {result.submittedAt.toLocaleDateString()}
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
