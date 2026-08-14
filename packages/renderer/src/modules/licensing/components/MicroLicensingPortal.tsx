import React, { useState } from 'react';
import { FileText, Copy, Download, CheckCircle2, Music, Globe, Clock, DollarSign, LockKeyhole } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

/* ================================================================== */
/*  Micro-Licensing Portal — Beat Leasing Contract Builder             */
/* ================================================================== */

export interface LeaseForm {
    trackTitle: string;
    isrc: string;
    licensorLegalName: string;
    licenseeLegalName: string;
    masterOwner: string;
    compositionOwner: string;
    producerPublishingShare: string;
    governingJurisdiction: string;
    rightsEvidenceReference: string;
    rightsAttested: boolean;
    leaseType: '' | 'exclusive' | 'non-exclusive';
    territory: string;
    term: '' | '1yr' | '3yr' | 'lifetime';
    price: string;
    syncRights: boolean;
    masterRights: boolean;
    performanceRights: boolean;
    streamingRights: boolean;
}

const INITIAL_FORM: LeaseForm = {
    trackTitle: '',
    isrc: '',
    licensorLegalName: '',
    licenseeLegalName: '',
    masterOwner: '',
    compositionOwner: '',
    producerPublishingShare: '',
    governingJurisdiction: '',
    rightsEvidenceReference: '',
    rightsAttested: false,
    leaseType: '',
    territory: '',
    term: '',
    price: '',
    syncRights: false,
    masterRights: false,
    performanceRights: false,
    streamingRights: false,
};

function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    }[character] ?? character));
}

export function buildContractHTML(form: LeaseForm): string {
    if (!isLeaseFormReady(form)) {
        throw new Error('Lease draft requires complete parties, ownership evidence, terms, selected rights, and attestation.');
    }
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const termLabel = form.term === '1yr' ? 'One (1) Year' : form.term === '3yr' ? 'Three (3) Years' : 'Lifetime (perpetual)';
    const trackTitle = escapeHtml(form.trackTitle || '[TRACK TITLE]');
    const isrc = escapeHtml(form.isrc || '[ISRC CODE]');
    const territory = escapeHtml(form.territory);
    const licensorLegalName = escapeHtml(form.licensorLegalName);
    const licenseeLegalName = escapeHtml(form.licenseeLegalName);
    const masterOwner = escapeHtml(form.masterOwner);
    const compositionOwner = escapeHtml(form.compositionOwner);
    const governingJurisdiction = escapeHtml(form.governingJurisdiction);
    const rightsEvidenceReference = escapeHtml(form.rightsEvidenceReference);
    const publishingShare = Number(form.producerPublishingShare);
    const rights: string[] = [];
    if (form.syncRights) rights.push('Synchronization Rights');
    if (form.masterRights) rights.push('Master Use Rights');
    if (form.performanceRights) rights.push('Public Performance Rights');
    if (form.streamingRights) rights.push('Digital Streaming Rights');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Beat Lease Agreement — ${trackTitle}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 40px;color:#111;line-height:1.7}
h1{text-align:center;font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #111;padding-bottom:12px}
h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:28px}
p{margin:8px 0;font-size:13px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px;background:#f9f9f9;border:1px solid #ddd;margin:16px 0}
.meta div{font-size:13px}.label{font-weight:bold;display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#555}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}.sig-line{border-top:1px solid #111;padding-top:8px;font-size:12px}
.badge{display:inline-block;padding:3px 10px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-radius:4px;background:${form.leaseType === 'exclusive' ? '#1a1a2e' : '#e8f5e9'};color:${form.leaseType === 'exclusive' ? '#fff' : '#1b5e20'}}
</style></head>
<body>
<h1>Beat Lease Agreement</h1>
<p style="text-align:center;font-size:12px;color:#555">This agreement is entered into as of <strong>${today}</strong></p>

<div class="meta">
  <div><span class="label">Track Title</span>${trackTitle}</div>
  <div><span class="label">ISRC</span>${isrc}</div>
  <div><span class="label">Lease Type</span><span class="badge">${form.leaseType.replace('-', ' ')}</span></div>
  <div><span class="label">Territory</span>${territory}</div>
  <div><span class="label">Term</span>${termLabel}</div>
  <div><span class="label">License Fee</span>$${parseFloat(form.price || '0').toFixed(2)} USD</div>
  <div><span class="label">Licensor</span>${licensorLegalName}</div>
  <div><span class="label">Licensee</span>${licenseeLegalName}</div>
  <div><span class="label">Rights Evidence</span>${rightsEvidenceReference}</div>
</div>

<h2>1. Grant of License</h2>
<p><strong>${licensorLegalName}</strong> ("Licensor") grants <strong>${licenseeLegalName}</strong> ("Licensee") a <strong>${form.leaseType === 'exclusive' ? 'fully exclusive' : 'non-exclusive'}</strong> license to use the musical composition identified above (the "Beat") within the territory of <strong>${territory}</strong> for a term of <strong>${termLabel}</strong> from the date of payment.</p>

<h2>2. Granted Rights</h2>
<p>This license includes the following rights:</p>
<ul>${rights.map(r => `<li>${r}</li>`).join('\n')}</ul>
${rights.length === 0 ? '<p><em>No specific rights selected. Please review.</em></p>' : ''}

<h2>3. Restrictions</h2>
<p>${form.leaseType === 'non-exclusive' ? 'This is a NON-EXCLUSIVE license. The Producer retains the right to license the Beat to other artists.' : 'This is an EXCLUSIVE license. Upon full payment, the Producer will cease licensing this Beat to other parties for the duration of the term.'}</p>
<p>The Licensee may NOT: sell, transfer, or sublicense this Beat; register the Beat's composition with a PRO under Licensee's name without Producer consent; or use the Beat in compilations or sample packs.</p>

<h2>4. Ownership & Publishing</h2>
<p>Master owner supplied by the parties: <strong>${masterOwner}</strong>. Composition owner supplied by the parties: <strong>${compositionOwner}</strong>. This draft does not independently verify either ownership claim.</p>

<h2>5. Royalty Splits</h2>
<p>The parties supplied a Licensor publishing share of <strong>${publishingShare.toFixed(2)}%</strong>. This draft does not calculate or infer any remaining writer, publisher, or administrator shares.</p>

<h2>6. Consideration</h2>
<p>Licensee agrees to pay a one-time license fee of <strong>$${parseFloat(form.price || '0').toFixed(2)} USD</strong> upon execution of this agreement.</p>

<h2>7. Termination</h2>
<p>This license terminates automatically upon expiration of the term or breach of any term herein. Upon termination, Licensee must cease all use and distribution of the Beat.</p>

<h2>8. Governing Law</h2>
<p>The parties supplied <strong>${governingJurisdiction}</strong> as the governing jurisdiction. No arbitration, court venue, or other dispute-resolution mechanism is selected by this template.</p>

<div class="sig">
  <div class="sig-line">${licensorLegalName} — Licensor Signature &amp; Date</div>
  <div class="sig-line">${licenseeLegalName} — Licensee Signature &amp; Date</div>
</div>

<p style="margin-top:40px;font-size:11px;color:#888;text-align:center"><em>Generated by indii Micro-Licensing Portal. This document is a template and does not constitute legal advice. Consult qualified legal counsel before execution.</em></p>
</body></html>`;
}

function isLeaseFormReady(form: LeaseForm): boolean {
    const publishingShare = Number(form.producerPublishingShare);
    const hasSelectedRight = form.syncRights || form.masterRights || form.performanceRights || form.streamingRights;

    return Boolean(
        form.trackTitle.trim()
        && form.licensorLegalName.trim()
        && form.licenseeLegalName.trim()
        && form.masterOwner.trim()
        && form.compositionOwner.trim()
        && form.producerPublishingShare.trim()
        && form.governingJurisdiction.trim()
        && form.rightsEvidenceReference.trim()
        && form.leaseType
        && form.territory.trim()
        && form.term
        && Number(form.price) > 0
        && Number.isFinite(publishingShare)
        && publishingShare >= 0
        && publishingShare <= 100
        && hasSelectedRight
        && form.rightsAttested
    );
}

export function MicroLicensingPortal() {
    const [form, setForm] = useState<LeaseForm>(INITIAL_FORM);
    const [contractHTML, setContractHTML] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const toast = useToast();

    const update = <K extends keyof LeaseForm>(key: K, value: LeaseForm[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const canGenerate = isLeaseFormReady(form);

    const handleGenerate = () => {
        if (!canGenerate) return;
        setContractHTML(buildContractHTML(form));
    };

    const handleCopy = () => {
        if (!contractHTML) return;
        navigator.clipboard.writeText(contractHTML).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => toast.error('Failed to copy contract to clipboard.'));
    };

    const handleDownload = () => {
        if (!contractHTML) return;
        const blob = new Blob([contractHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beat-lease-${(form.trackTitle || 'contract').replace(/\s+/g, '-').toLowerCase()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const inputClass = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors';
    const labelClass = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

    return (
        <div className="space-y-6 pb-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <FileText size={16} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tight">Beat Leasing Portal</h2>
                    <p className="text-[10px] text-gray-500">Generate beat lease contracts with a visual builder</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="space-y-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Music size={12} /> Track Details
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className={labelClass}>Track Title *</label>
                            <input
                                type="text"
                                value={form.trackTitle}
                                onChange={e => update('trackTitle', e.target.value)}
                                placeholder="e.g. Midnight Blaze"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>ISRC</label>
                            <input
                                type="text"
                                value={form.isrc}
                                onChange={e => update('isrc', e.target.value)}
                                placeholder="US-ABC-25-00001"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Price (USD)</label>
                            <div className="relative">
                                <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={e => update('price', e.target.value)}
                                    placeholder="0.00"
                                    className={inputClass + ' pl-7'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Licensor Legal Name *</label>
                            <input value={form.licensorLegalName} onChange={e => update('licensorLegalName', e.target.value)} placeholder="Legal name granting rights" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Licensee Legal Name *</label>
                            <input value={form.licenseeLegalName} onChange={e => update('licenseeLegalName', e.target.value)} placeholder="Legal name receiving rights" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Master Owner *</label>
                            <input value={form.masterOwner} onChange={e => update('masterOwner', e.target.value)} placeholder="Verified master owner" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Composition Owner *</label>
                            <input value={form.compositionOwner} onChange={e => update('compositionOwner', e.target.value)} placeholder="Verified composition owner" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Licensor Publishing Share % *</label>
                            <input type="number" min="0" max="100" step="0.01" value={form.producerPublishingShare} onChange={e => update('producerPublishingShare', e.target.value)} placeholder="No inferred split" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Governing Jurisdiction *</label>
                            <input value={form.governingJurisdiction} onChange={e => update('governingJurisdiction', e.target.value)} placeholder="e.g. Michigan, USA" className={inputClass} />
                        </div>
                        <div className="col-span-2">
                            <label className={labelClass}>Rights Evidence Reference *</label>
                            <input value={form.rightsEvidenceReference} onChange={e => update('rightsEvidenceReference', e.target.value)} placeholder="Agreement, split sheet, registration, or source record" className={inputClass} />
                        </div>
                    </div>

                    {/* Lease Type Toggle */}
                    <div>
                        <label className={labelClass}>Lease Type</label>
                        <div className="flex rounded-lg overflow-hidden border border-white/10">
                            <button
                                onClick={() => update('leaseType', 'non-exclusive')}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${form.leaseType === 'non-exclusive' ? 'bg-emerald-500 text-white' : 'bg-white/[0.02] text-gray-500 hover:text-gray-300'}`}
                            >
                                Non-Exclusive
                            </button>
                            <button
                                onClick={() => update('leaseType', 'exclusive')}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${form.leaseType === 'exclusive' ? 'bg-amber-500 text-white' : 'bg-white/[0.02] text-gray-500 hover:text-gray-300'}`}
                            >
                                Exclusive
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">
                            {form.leaseType === 'exclusive'
                                ? 'Exclusive: Beat sold to one buyer only.'
                                : form.leaseType === 'non-exclusive'
                                    ? 'Non-Exclusive: Beat can be leased to multiple artists.'
                                    : 'Choose a lease type; no default will be assumed.'}
                        </p>
                    </div>

                    {/* Territory & Term */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>
                                <Globe size={10} className="inline mr-1" />Territory
                            </label>
                            <select
                                value={form.territory}
                                onChange={e => update('territory', e.target.value)}
                                className={inputClass}
                            >
                                <option value="" disabled>Select territory</option>
                                <option value="Worldwide">Worldwide</option>
                                <option value="United States">United States</option>
                                <option value="North America">North America</option>
                                <option value="Europe">Europe</option>
                                <option value="Canada">Canada</option>
                                <option value="United Kingdom">United Kingdom</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>
                                <Clock size={10} className="inline mr-1" />Term
                            </label>
                            <select
                                value={form.term}
                                onChange={e => update('term', e.target.value as LeaseForm['term'])}
                                className={inputClass}
                            >
                                <option value="" disabled>Select term</option>
                                <option value="1yr">1 Year</option>
                                <option value="3yr">3 Years</option>
                                <option value="lifetime">Lifetime / Perpetual</option>
                            </select>
                        </div>
                    </div>

                    <label className="flex items-start gap-2 text-xs text-gray-300">
                        <input
                            type="checkbox"
                            checked={form.rightsAttested}
                            onChange={e => update('rightsAttested', e.target.checked)}
                            className="mt-0.5"
                        />
                        <span>I confirm the named parties and ownership facts are supported by the referenced evidence and that the licensor is authorized to grant only the selected rights.</span>
                    </label>

                    {/* Usage Rights */}
                    <div>
                        <label className={labelClass}>Usage Rights Granted</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(
                                [
                                    { key: 'syncRights', label: 'Sync (Film/TV/Ads)' },
                                    { key: 'masterRights', label: 'Master Use' },
                                    { key: 'performanceRights', label: 'Live Performance' },
                                    { key: 'streamingRights', label: 'Digital Streaming' },
                                ] as { key: keyof LeaseForm; label: string }[]
                            ).map(({ key, label }) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(form[key])}
                                        onChange={event => update(key, event.target.checked as LeaseForm[typeof key])}
                                        className="h-4 w-4 accent-emerald-500"
                                    />
                                    <span className="text-xs text-gray-300">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <FileText size={14} />
                            Generate Draft
                        </button>
                        <button
                            disabled
                            title="Checkout requires a versioned agreement accepted by the licensee and a verified payout account."
                            className="w-full py-2.5 bg-amber-600/30 cursor-not-allowed text-amber-200/60 text-[11px] font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                        >
                            <LockKeyhole size={14} />
                            Checkout Setup Required
                        </button>
                    </div>
                </div>

                {/* Contract Preview */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contract Draft Preview</h3>
                        {contractHTML && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-gray-300 transition-colors border border-white/10"
                                >
                                    {copied ? <CheckCircle2 size={12} className="text-green-400" /> : <Copy size={12} />}
                                    {copied ? 'Copied' : 'Copy HTML'}
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 transition-colors border border-emerald-500/20"
                                >
                                    <Download size={12} />
                                    Download
                                </button>
                            </div>
                        )}
                    </div>

                    {contractHTML ? (
                        <div className="flex-1 bg-white/[0.02] rounded-lg border border-white/5 p-4 overflow-y-auto max-h-[500px]">
                            <iframe
                                title="Rendered contract draft"
                                srcDoc={contractHTML}
                                sandbox=""
                                className="w-full min-h-[460px] rounded bg-white"
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                <FileText size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">No contract generated yet</p>
                                <p className="text-xs text-gray-600 mt-1">Fill in the form and click "Generate Draft"</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <FileText size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/70 leading-relaxed">
                    Generated contracts are templates only. Checkout is disabled until the product can store a versioned agreement, capture the licensee&apos;s acceptance, and verify the payout recipient. All agreements should be reviewed by qualified legal counsel before execution. indii is not a law firm and this tool does not constitute legal advice.
                </p>
            </div>
        </div>
    );
}
