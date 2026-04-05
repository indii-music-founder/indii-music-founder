import React, { useState } from 'react';
import { Shield, Copy, Download, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

/* ================================================================== */
/*  DMCA / Takedown Notice Generator                                    */
/* ================================================================== */

type Platform = 'YouTube' | 'Spotify' | 'SoundCloud' | 'TikTok' | 'Other';

interface DMCAForm {
    infringerUrl: string;
    platform: Platform;
    infringingDescription: string;
    originalTitle: string;
    isrc: string;
    copyrightOwner: string;
    contactEmail: string;
}

const INITIAL_FORM: DMCAForm = {
    infringerUrl: '',
    platform: 'YouTube',
    infringingDescription: '',
    originalTitle: '',
    isrc: '',
    copyrightOwner: '',
    contactEmail: '',
};

const PLATFORM_CONTACTS: Record<Platform, string> = {
    YouTube: 'copyright@youtube.com (via YouTube Copyright Complaint form at https://www.youtube.com/copyright_complaint_form)',
    Spotify: 'Spotify Artist Support — via https://artists.spotify.com/help/article/dmca-takedown',
    SoundCloud: 'copyright@soundcloud.com',
    TikTok: 'legal@tiktok.com (via https://www.tiktok.com/legal/copyright-policy)',
    Other: '[Platform Copyright Team — Insert contact details]',
};

function buildNoticeHTML(form: DMCAForm): string {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const platformContact = PLATFORM_CONTACTS[form.platform];

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>DMCA Takedown Notice — ${form.originalTitle || 'Original Work'}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 40px;color:#111;line-height:1.8;font-size:14px}
h1{font-size:18px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #111;padding-bottom:10px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-top:24px;color:#333}
p{margin:8px 0}.highlight{background:#fff3cd;padding:2px 6px;border-radius:3px;font-weight:bold}
.block{background:#f9f9f9;border-left:4px solid #111;padding:12px 16px;margin:16px 0;font-size:13px}
.sig-line{border-top:1px solid #111;padding-top:8px;font-size:12px;margin-top:60px;width:300px}
</style></head>
<body>
<h1>DMCA Copyright Infringement Notice</h1>
<p><strong>Date:</strong> ${today}</p>
<p><strong>To:</strong> Designated Copyright Agent / Legal Team<br><strong>Platform:</strong> ${form.platform}<br><strong>Contact:</strong> ${platformContact}</p>

<h2>I. Identification of the Copyright Owner</h2>
<p>I, <span class="highlight">${form.copyrightOwner || '[COPYRIGHT OWNER NAME]'}</span>, am the copyright owner (or authorized agent thereof) of the original work described below. My contact information is as follows:</p>
<div class="block">
  Name / Organization: ${form.copyrightOwner || '[COPYRIGHT OWNER NAME]'}<br>
  Email Address: ${form.contactEmail || '[CONTACT EMAIL]'}
</div>

<h2>II. Identification of the Copyrighted Work</h2>
<p>The copyrighted work subject to this notice is:</p>
<div class="block">
  Title: <strong>${form.originalTitle || '[ORIGINAL WORK TITLE]'}</strong><br>
  ${form.isrc ? `ISRC Code: <strong>${form.isrc}</strong><br>` : ''}
  Type: Original Musical Composition and Sound Recording<br>
  Copyright Owner: ${form.copyrightOwner || '[COPYRIGHT OWNER NAME]'}
</div>

<h2>III. Identification of the Infringing Material</h2>
<p>The material that is claimed to be infringing, and which I request be removed or disabled, is located at the following URL:</p>
<div class="block">
  Platform: <strong>${form.platform}</strong><br>
  Infringing URL: <strong>${form.infringerUrl || '[INFRINGING URL]'}</strong><br>
  Description: ${form.infringingDescription || '[DESCRIPTION OF INFRINGING CONTENT]'}
</div>

<h2>IV. Statement of Good Faith</h2>
<p>I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law. The information in this notification is accurate, and under penalty of perjury, I am the owner or agent authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</p>

<h2>V. DMCA § 512(c)(3) Compliance Statement</h2>
<p>This notice is submitted pursuant to the Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512. By submitting this notice, I acknowledge that misrepresentation of material facts in this statement may subject me to civil liability under 17 U.S.C. § 512(f).</p>

<h2>VI. Requested Action</h2>
<p>I respectfully request that you promptly:</p>
<ol>
  <li>Remove or disable access to the infringing material identified above;</li>
  <li>Notify the alleged infringer of the removal; and</li>
  <li>Provide confirmation to me at the email address above once the removal has been completed.</li>
</ol>

<h2>VII. Electronic Signature</h2>
<p>I declare under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or agent authorized to act on the copyright owner's behalf.</p>

<div class="sig-line">
  <p><strong>${form.copyrightOwner || '[COPYRIGHT OWNER NAME]'}</strong></p>
  <p>${form.contactEmail || '[CONTACT EMAIL]'}</p>
  <p>Date: ${today}</p>
</div>

<p style="margin-top:50px;font-size:11px;color:#888"><em>Generated by indiiOS DMCA Notice Generator. This document is a template and does not constitute legal advice. Review with qualified legal counsel before submission.</em></p>
</body></html>`;
}

export function DMCANoticeGenerator() {
    const [form, setForm] = useState<DMCAForm>(INITIAL_FORM);
    const [noticeHTML, setNoticeHTML] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const update = <K extends keyof DMCAForm>(key: K, value: DMCAForm[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const isFormValid = form.infringerUrl.trim() && form.originalTitle.trim() && form.copyrightOwner.trim() && form.contactEmail.trim();

    const handleGenerate = () => {
        if (!isFormValid) return;
        setNoticeHTML(buildNoticeHTML(form));
    };

    const handleCopy = () => {
        if (!noticeHTML) return;
        navigator.clipboard.writeText(noticeHTML).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleDownload = () => {
        if (!noticeHTML) return;
        const blob = new Blob([noticeHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dmca-notice-${(form.originalTitle || 'notice').replace(/\s+/g, '-').toLowerCase()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const inputClass = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors';
    const labelClass = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Shield size={16} className="text-blue-400" />
                </div>
                <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tight">DMCA Takedown Generator</h2>
                    <p className="text-[10px] text-gray-500">Generate pre-filled DMCA takedown notices for copyright infringement</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div className="space-y-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Notice Details</h3>

                    {/* Platform */}
                    <div>
                        <label className={labelClass}>Platform</label>
                        <div className="flex flex-wrap gap-1.5">
                            {(['YouTube', 'Spotify', 'SoundCloud', 'TikTok', 'Other'] as Platform[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => update('platform', p)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${form.platform === p ? 'bg-blue-500 text-white' : 'bg-white/[0.04] text-gray-400 hover:text-white border border-white/10'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Infringer URL */}
                    <div>
                        <label className={labelClass}>Infringing Content URL *</label>
                        <input
                            type="url"
                            value={form.infringerUrl}
                            onChange={e => update('infringerUrl', e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className={inputClass}
                        />
                    </div>

                    {/* Infringing Description */}
                    <div>
                        <label className={labelClass}>Description of Infringing Content</label>
                        <textarea
                            value={form.infringingDescription}
                            onChange={e => update('infringingDescription', e.target.value)}
                            placeholder="Describe how the content infringes your copyright..."
                            rows={3}
                            className={inputClass + ' resize-none'}
                        />
                    </div>

                    {/* Original Work */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Original Work Title *</label>
                            <input
                                type="text"
                                value={form.originalTitle}
                                onChange={e => update('originalTitle', e.target.value)}
                                placeholder="My Song Title"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>ISRC (optional)</label>
                            <input
                                type="text"
                                value={form.isrc}
                                onChange={e => update('isrc', e.target.value)}
                                placeholder="US-ABC-25-00001"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {/* Copyright Owner */}
                    <div>
                        <label className={labelClass}>Copyright Owner Name *</label>
                        <input
                            type="text"
                            value={form.copyrightOwner}
                            onChange={e => update('copyrightOwner', e.target.value)}
                            placeholder="Your name or company name"
                            className={inputClass}
                        />
                    </div>

                    {/* Contact Email */}
                    <div>
                        <label className={labelClass}>Contact Email *</label>
                        <input
                            type="email"
                            value={form.contactEmail}
                            onChange={e => update('contactEmail', e.target.value)}
                            placeholder="legal@yourdomain.com"
                            className={inputClass}
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!isFormValid}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Shield size={14} />
                        Generate DMCA Notice
                    </button>
                </div>

                {/* Notice Preview */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Notice Preview</h3>
                        {noticeHTML && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-gray-300 transition-colors border border-white/10"
                                >
                                    {copied ? <CheckCircle2 size={12} className="text-green-400" /> : <Copy size={12} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-xs text-blue-300 transition-colors border border-blue-500/20"
                                >
                                    <Download size={12} />
                                    Download
                                </button>
                            </div>
                        )}
                    </div>

                    {noticeHTML ? (
                        <div className="flex-1 bg-white/[0.02] rounded-lg border border-white/5 p-4 overflow-y-auto max-h-[500px]">
                            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                                {noticeHTML}
                            </pre>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                <FileText size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">No notice generated yet</p>
                                <p className="text-xs text-gray-600 mt-1">Fill in the required fields and click "Generate"</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/70 leading-relaxed">
                    Submitting a false DMCA notice may expose you to legal liability under 17 U.S.C. § 512(f). Always verify the infringement and consult a qualified entertainment attorney before submitting.
                </p>
            </div>
        </div>
    );
}
