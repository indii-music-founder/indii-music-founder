import React, { useState } from 'react';
import { FileText, Copy, Download, CheckCircle2, Music, Globe, Clock, DollarSign } from 'lucide-react';

/* ================================================================== */
/*  Micro-Licensing Portal — Beat Leasing Contract Builder             */
/* ================================================================== */

interface LeaseForm {
    trackTitle: string;
    isrc: string;
    leaseType: 'exclusive' | 'non-exclusive';
    territory: string;
    term: '1yr' | '3yr' | 'lifetime';
    price: string;
    syncRights: boolean;
    masterRights: boolean;
    performanceRights: boolean;
    streamingRights: boolean;
}

const INITIAL_FORM: LeaseForm = {
    trackTitle: '',
    isrc: '',
    leaseType: 'non-exclusive',
    territory: 'Worldwide',
    term: '1yr',
    price: '',
    syncRights: true,
    masterRights: false,
    performanceRights: true,
    streamingRights: true,
};

function buildContractHTML(form: LeaseForm): string {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const termLabel = form.term === '1yr' ? 'One (1) Year' : form.term === '3yr' ? 'Three (3) Years' : 'Lifetime (perpetual)';
    const rights: string[] = [];
    if (form.syncRights) rights.push('Synchronization Rights');
    if (form.masterRights) rights.push('Master Use Rights');
    if (form.performanceRights) rights.push('Public Performance Rights');
    if (form.streamingRights) rights.push('Digital Streaming Rights');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Beat Lease Agreement — ${form.trackTitle}</title>
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
  <div><span class="label">Track Title</span>${form.trackTitle || '[TRACK TITLE]'}</div>
  <div><span class="label">ISRC</span>${form.isrc || '[ISRC CODE]'}</div>
  <div><span class="label">Lease Type</span><span class="badge">${form.leaseType.replace('-', ' ')}</span></div>
  <div><span class="label">Territory</span>${form.territory}</div>
  <div><span class="label">Term</span>${termLabel}</div>
  <div><span class="label">License Fee</span>$${parseFloat(form.price || '0').toFixed(2)} USD</div>
</div>

<h2>1. Grant of License</h2>
<p>The Licensor ("Producer") hereby grants the Licensee ("Artist") a <strong>${form.leaseType === 'exclusive' ? 'fully exclusive' : 'non-exclusive'}</strong> license to use the musical composition identified above (the "Beat") within the territory of <strong>${form.territory}</strong> for a term of <strong>${termLabel}</strong> from the date of payment.</p>

<h2>2. Granted Rights</h2>
<p>This license includes the following rights:</p>
<ul>${rights.map(r => `<li>${r}</li>`).join('\n')}</ul>
${rights.length === 0 ? '<p><em>No specific rights selected. Please review.</em></p>' : ''}

<h2>3. Restrictions</h2>
<p>${form.leaseType === 'non-exclusive' ? 'This is a NON-EXCLUSIVE license. The Producer retains the right to license the Beat to other artists.' : 'This is an EXCLUSIVE license. Upon full payment, the Producer will cease licensing this Beat to other parties for the duration of the term.'}</p>
<p>The Licensee may NOT: sell, transfer, or sublicense this Beat; register the Beat's composition with a PRO under Licensee's name without Producer consent; or use the Beat in compilations or sample packs.</p>

<h2>4. Ownership & Publishing</h2>
<p>The Producer retains 100% ownership of the master recording and composition of the Beat. The Licensee shall credit the Producer as the producer of the Beat in all releases.</p>

<h2>5. Royalty Splits</h2>
<p>Unless a separate co-publishing agreement is executed, the Producer retains 50% of the publishing share of the composition for any commercial release using this Beat.</p>

<h2>6. Consideration</h2>
<p>Licensee agrees to pay a one-time license fee of <strong>$${parseFloat(form.price || '0').toFixed(2)} USD</strong> upon execution of this agreement. No physical delivery of funds is contemplated as full consideration.</p>

<h2>7. Termination</h2>
<p>This license terminates automatically upon expiration of the term or breach of any term herein. Upon termination, Licensee must cease all use and distribution of the Beat.</p>

<h2>8. Governing Law</h2>
<p>This agreement shall be governed by the laws of the jurisdiction in which the Producer resides. Any disputes shall be resolved through binding arbitration.</p>

<div class="sig">
  <div class="sig-line">Producer Signature &amp; Date</div>
  <div class="sig-line">Artist Signature &amp; Date</div>
</div>

<p style="margin-top:40px;font-size:11px;color:#888;text-align:center"><em>Generated by indiiOS Micro-Licensing Portal. This document is a template and does not constitute legal advice. Consult qualified legal counsel before execution.</em></p>
</body></html>`;
}

export function MicroLicensingPortal() {
    const [form, setForm] = useState<LeaseForm>(INITIAL_FORM);
    const [contractHTML, setContractHTML] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const update = <K extends keyof LeaseForm>(key: K, value: LeaseForm[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleGenerate = () => {
        if (!form.trackTitle.trim()) return;
        setContractHTML(buildContractHTML(form));
    };

    const handleCopy = () => {
        if (!contractHTML) return;
        navigator.clipboard.writeText(contractHTML).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
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

    const inputClass = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors';
    const labelClass = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

    return (
        <div className="space-y-6 pb-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <FileText size={16} className="text-indigo-400" />
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

                    {/* Lease Type Toggle */}
                    <div>
                        <label className={labelClass}>Lease Type</label>
                        <div className="flex rounded-lg overflow-hidden border border-white/10">
                            <button
                                onClick={() => update('leaseType', 'non-exclusive')}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${form.leaseType === 'non-exclusive' ? 'bg-indigo-500 text-white' : 'bg-white/[0.02] text-gray-500 hover:text-gray-300'}`}
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
                            {form.leaseType === 'exclusive' ? 'Exclusive: Beat sold to one buyer only.' : 'Non-Exclusive: Beat can be leased to multiple artists.'}
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
                                <option value="1yr">1 Year</option>
                                <option value="3yr">3 Years</option>
                                <option value="lifetime">Lifetime / Perpetual</option>
                            </select>
                        </div>
                    </div>

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
                                <label
                                    key={key}
                                    className="flex items-center gap-2 cursor-pointer group"
                                >
                                    <div
                                        onClick={() => update(key, !form[key] as LeaseForm[typeof key])}
                                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${form[key] ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 group-hover:border-white/40'}`}
                                    >
                                        {form[key] && <CheckCircle2 size={10} className="text-white" />}
                                    </div>
                                    <span className="text-xs text-gray-300">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!form.trackTitle.trim()}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <FileText size={14} />
                        Generate Contract
                    </button>
                </div>

                {/* Contract Preview */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contract Preview</h3>
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
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-xs text-indigo-300 transition-colors border border-indigo-500/20"
                                >
                                    <Download size={12} />
                                    Download
                                </button>
                            </div>
                        )}
                    </div>

                    {contractHTML ? (
                        <div className="flex-1 bg-white/[0.02] rounded-lg border border-white/5 p-4 overflow-y-auto max-h-[500px]">
                            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                                {contractHTML}
                            </pre>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                <FileText size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">No contract generated yet</p>
                                <p className="text-xs text-gray-600 mt-1">Fill in the form and click "Generate Contract"</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <FileText size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/70 leading-relaxed">
                    Generated contracts are templates only. All agreements must be reviewed by qualified legal counsel before execution. indiiOS is not a law firm and this tool does not constitute legal advice.
                </p>
            </div>
        </div>
    );
}
