/**
 * TechnicalRiderGenerator — Item 132 (PRODUCTION_200)
 * Form-based builder generating PDF stage plots and technical riders for promoters.
 * Sections: Stage, PA/FOH, Monitor Mix, Lighting, Backline, Contacts.
 * Mock PDF export (Blob download of HTML-rendered content).
 */
import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
    FileText, Download, ChevronDown, ChevronUp, Mic2,
    Lightbulb, Music2, Phone, Ruler, Plus, Trash2, CheckCircle2,
} from 'lucide-react';

interface Contact {
    role: string;
    name: string;
    phone: string;
    email: string;
}

interface RiderState {
    artistName: string;
    actName: string;
    memberCount: string;
    // Stage
    stageWidth: string;
    stageDepth: string;
    stageHeight: string;
    // PA/FOH
    paSystem: string;
    subwoofers: string;
    fohConsole: string;
    fohChannels: string;
    needsFohEngineer: boolean;
    // Monitor Mix
    monitorConsole: string;
    monitorMixes: string;
    iemMixes: string;
    // Lighting
    lightingRig: boolean;
    followSpot: boolean;
    haze: boolean;
    lightingNotes: string;
    // Backline
    drumKit: boolean;
    drumNotes: string;
    bassAmp: string;
    guitarAmp: string;
    keys: string;
    // Contacts
    contacts: Contact[];
    // Additional
    additionalNotes: string;
}

const DEFAULT_STATE: RiderState = {
    artistName: '',
    actName: '',
    memberCount: '4',
    stageWidth: '30',
    stageDepth: '20',
    stageHeight: '4',
    paSystem: 'L-Acoustics K2 or equivalent',
    subwoofers: '4x double 18" per side',
    fohConsole: 'Avid S6L or DiGiCo SD7',
    fohChannels: '48',
    needsFohEngineer: true,
    monitorConsole: 'DiGiCo SD9',
    monitorMixes: '6',
    iemMixes: '4',
    lightingRig: true,
    followSpot: true,
    haze: true,
    lightingNotes: 'Minimum 12 moving heads, full color LED wash.',
    drumKit: true,
    drumNotes: 'Pearl Masters Maple, 22" kick, 10"/12"/14" toms, 14"x6.5" snare',
    bassAmp: 'Ampeg SVT-CL + 810E',
    guitarAmp: 'Fender Twin Reverb × 2',
    keys: 'Nord Stage 3 88 + stand',
    contacts: [
        { role: 'Tour Manager', name: '', phone: '', email: '' },
        { role: 'FOH Engineer', name: '', phone: '', email: '' },
        { role: 'Production Manager', name: '', phone: '', email: '' },
    ],
    additionalNotes: '',
};

function Section({ title, icon, children, defaultOpen = true }: {
    title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-widest">
                    {icon}
                    {title}
                </div>
                {open ? <ChevronUp size={14} className="text-neutral-600" /> : <ChevronDown size={14} className="text-neutral-600" />}
            </button>
            {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{label}</label>
            {children}
        </div>
    );
}

const inputCls = "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40 transition-colors";

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${value
                ? 'bg-[#FFE135]/10 border-[#FFE135]/30 text-[#FFE135]'
                : 'bg-white/5 border-white/5 text-neutral-500 hover:text-white'}`}
        >
            <CheckCircle2 size={12} className={value ? 'text-[#FFE135]' : 'text-neutral-600'} />
            {label}
        </button>
    );
}

function generatePdfContent(r: RiderState): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Technical Rider — ${r.actName || r.artistName}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111;line-height:1.6}
  h1{color:#222;border-bottom:3px solid #000;padding-bottom:8px}
  h2{color:#444;margin-top:24px;font-size:14px;text-transform:uppercase;letter-spacing:1px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
  td,th{border:1px solid #ddd;padding:6px 10px;text-align:left}
  th{background:#f5f5f5;font-weight:bold}
  .note{background:#fffbe6;border-left:4px solid #f0a500;padding:8px 12px;margin-top:8px;font-size:12px}
  p{font-size:12px;margin:4px 0}
</style></head><body>
<h1>Technical Rider</h1>
<p><strong>Artist:</strong> ${r.artistName}</p>
<p><strong>Act / Show Name:</strong> ${r.actName}</p>
<p><strong>Members on Stage:</strong> ${r.memberCount}</p>

<h2>Stage Requirements</h2>
<table><tr><th>Dimension</th><th>Minimum</th></tr>
<tr><td>Width</td><td>${r.stageWidth} ft</td></tr>
<tr><td>Depth</td><td>${r.stageDepth} ft</td></tr>
<tr><td>Height</td><td>${r.stageHeight} ft</td></tr></table>

<h2>PA / FOH</h2>
<table><tr><th>Item</th><th>Spec</th></tr>
<tr><td>PA System</td><td>${r.paSystem}</td></tr>
<tr><td>Subwoofers</td><td>${r.subwoofers}</td></tr>
<tr><td>FOH Console</td><td>${r.fohConsole}</td></tr>
<tr><td>Input Channels</td><td>${r.fohChannels}</td></tr>
<tr><td>FOH Engineer</td><td>${r.needsFohEngineer ? 'Provided by artist' : 'Provided by venue'}</td></tr></table>

<h2>Monitor Mix</h2>
<table><tr><th>Item</th><th>Spec</th></tr>
<tr><td>Monitor Console</td><td>${r.monitorConsole}</td></tr>
<tr><td>Wedge Mixes</td><td>${r.monitorMixes}</td></tr>
<tr><td>IEM Mixes</td><td>${r.iemMixes}</td></tr></table>

<h2>Lighting</h2>
<p>Full Rig Required: ${r.lightingRig ? 'YES' : 'NO'} | Follow Spot: ${r.followSpot ? 'YES' : 'NO'} | Haze: ${r.haze ? 'YES' : 'NO'}</p>
${r.lightingNotes ? `<div class="note">${r.lightingNotes}</div>` : ''}

<h2>Backline</h2>
<table><tr><th>Item</th><th>Spec</th></tr>
${r.drumKit ? `<tr><td>Drum Kit</td><td>${r.drumNotes}</td></tr>` : ''}
${r.bassAmp ? `<tr><td>Bass Amp</td><td>${r.bassAmp}</td></tr>` : ''}
${r.guitarAmp ? `<tr><td>Guitar Amp</td><td>${r.guitarAmp}</td></tr>` : ''}
${r.keys ? `<tr><td>Keys</td><td>${r.keys}</td></tr>` : ''}
</table>

<h2>Key Contacts</h2>
<table><tr><th>Role</th><th>Name</th><th>Phone</th><th>Email</th></tr>
${r.contacts.map(c => `<tr><td>${c.role}</td><td>${c.name || '—'}</td><td>${c.phone || '—'}</td><td>${c.email || '—'}</td></tr>`).join('')}
</table>

${r.additionalNotes ? `<h2>Additional Notes</h2><div class="note">${r.additionalNotes}</div>` : ''}
</body></html>`;
}

export function TechnicalRiderGenerator() {
    const [rider, setRider] = useState<RiderState>(DEFAULT_STATE);
    const [exported, setExported] = useState(false);
    const linkRef = useRef<HTMLAnchorElement>(null);

    const set = (key: keyof RiderState, value: RiderState[keyof RiderState]) =>
        setRider(r => ({ ...r, [key]: value }));

    const setContact = (idx: number, field: keyof Contact, val: string) =>
        setRider(r => ({
            ...r,
            contacts: r.contacts.map((c, i) => i === idx ? { ...c, [field]: val } : c),
        }));

    const addContact = () =>
        setRider(r => ({ ...r, contacts: [...r.contacts, { role: '', name: '', phone: '', email: '' }] }));

    const removeContact = (idx: number) =>
        setRider(r => ({ ...r, contacts: r.contacts.filter((_, i) => i !== idx) }));

    const handleExport = () => {
        const html = generatePdfContent(rider);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        if (linkRef.current) {
            linkRef.current.href = url;
            linkRef.current.download = `tech-rider-${(rider.actName || rider.artistName || 'artist').toLowerCase().replace(/\s+/g, '-')}.html`;
            linkRef.current.click();
        }
        URL.revokeObjectURL(url);
        setExported(true);
        setTimeout(() => setExported(false), 3000);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-white">Technical Rider Generator</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                        Build stage plots and technical requirements for promoters
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a ref={linkRef} className="hidden" />
                    <motion.button
                        onClick={handleExport}
                        whileTap={{ scale: 0.97 }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${exported
                            ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                            : 'bg-[#FFE135] text-black hover:bg-[#FFD700]'}`}
                    >
                        {exported ? <CheckCircle2 size={13} /> : <Download size={13} />}
                        {exported ? 'Downloaded!' : 'Export Rider'}
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Field label="Artist Name">
                    <input className={inputCls} value={rider.artistName} onChange={e => set('artistName', e.target.value)} placeholder="e.g. Mara Sol" />
                </Field>
                <Field label="Act / Show Name">
                    <input className={inputCls} value={rider.actName} onChange={e => set('actName', e.target.value)} placeholder="e.g. The Collapse Tour" />
                </Field>
            </div>

            {/* Stage */}
            <Section title="Stage Requirements" icon={<Ruler size={13} />}>
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Width (ft)">
                        <input type="number" className={inputCls} value={rider.stageWidth} onChange={e => set('stageWidth', e.target.value)} />
                    </Field>
                    <Field label="Depth (ft)">
                        <input type="number" className={inputCls} value={rider.stageDepth} onChange={e => set('stageDepth', e.target.value)} />
                    </Field>
                    <Field label="Height (ft)">
                        <input type="number" className={inputCls} value={rider.stageHeight} onChange={e => set('stageHeight', e.target.value)} />
                    </Field>
                </div>
            </Section>

            {/* PA / FOH */}
            <Section title="PA / FOH" icon={<Mic2 size={13} />}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="PA System">
                        <input className={inputCls} value={rider.paSystem} onChange={e => set('paSystem', e.target.value)} />
                    </Field>
                    <Field label="Subwoofers">
                        <input className={inputCls} value={rider.subwoofers} onChange={e => set('subwoofers', e.target.value)} />
                    </Field>
                    <Field label="FOH Console">
                        <input className={inputCls} value={rider.fohConsole} onChange={e => set('fohConsole', e.target.value)} />
                    </Field>
                    <Field label="Input Channels">
                        <input type="number" className={inputCls} value={rider.fohChannels} onChange={e => set('fohChannels', e.target.value)} />
                    </Field>
                </div>
                <Toggle label="Artist provides FOH Engineer" value={rider.needsFohEngineer} onChange={v => set('needsFohEngineer', v)} />
            </Section>

            {/* Monitor Mix */}
            <Section title="Monitor Mix" icon={<Mic2 size={13} />}>
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Monitor Console">
                        <input className={inputCls} value={rider.monitorConsole} onChange={e => set('monitorConsole', e.target.value)} />
                    </Field>
                    <Field label="Wedge Mixes">
                        <input type="number" className={inputCls} value={rider.monitorMixes} onChange={e => set('monitorMixes', e.target.value)} />
                    </Field>
                    <Field label="IEM Mixes">
                        <input type="number" className={inputCls} value={rider.iemMixes} onChange={e => set('iemMixes', e.target.value)} />
                    </Field>
                </div>
            </Section>

            {/* Lighting */}
            <Section title="Lighting" icon={<Lightbulb size={13} />}>
                <div className="flex flex-wrap gap-2">
                    <Toggle label="Full Lighting Rig" value={rider.lightingRig} onChange={v => set('lightingRig', v)} />
                    <Toggle label="Follow Spot" value={rider.followSpot} onChange={v => set('followSpot', v)} />
                    <Toggle label="Haze Machine" value={rider.haze} onChange={v => set('haze', v)} />
                </div>
                <Field label="Lighting Notes">
                    <textarea className={`${inputCls} resize-none h-16`} value={rider.lightingNotes} onChange={e => set('lightingNotes', e.target.value)} />
                </Field>
            </Section>

            {/* Backline */}
            <Section title="Backline" icon={<Music2 size={13} />}>
                <Toggle label="Drum Kit Required" value={rider.drumKit} onChange={v => set('drumKit', v)} />
                {rider.drumKit && (
                    <Field label="Drum Kit Spec">
                        <input className={inputCls} value={rider.drumNotes} onChange={e => set('drumNotes', e.target.value)} />
                    </Field>
                )}
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Bass Amp">
                        <input className={inputCls} value={rider.bassAmp} onChange={e => set('bassAmp', e.target.value)} placeholder="None" />
                    </Field>
                    <Field label="Guitar Amp">
                        <input className={inputCls} value={rider.guitarAmp} onChange={e => set('guitarAmp', e.target.value)} placeholder="None" />
                    </Field>
                    <Field label="Keys">
                        <input className={inputCls} value={rider.keys} onChange={e => set('keys', e.target.value)} placeholder="None" />
                    </Field>
                </div>
            </Section>

            {/* Contacts */}
            <Section title="Key Contacts" icon={<Phone size={13} />}>
                <div className="space-y-2">
                    {rider.contacts.map((c, i) => (
                        <div key={i} className="grid grid-cols-4 gap-2 items-center">
                            <input className={inputCls} value={c.role} onChange={e => setContact(i, 'role', e.target.value)} placeholder="Role" />
                            <input className={inputCls} value={c.name} onChange={e => setContact(i, 'name', e.target.value)} placeholder="Name" />
                            <input className={inputCls} value={c.phone} onChange={e => setContact(i, 'phone', e.target.value)} placeholder="+1 555 000 0000" />
                            <div className="flex gap-1">
                                <input className={`${inputCls} flex-1`} value={c.email} onChange={e => setContact(i, 'email', e.target.value)} placeholder="email@example.com" />
                                <button onClick={() => removeContact(i)} className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors flex-shrink-0">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addContact} className="flex items-center gap-2 text-[11px] text-neutral-500 hover:text-white transition-colors">
                        <Plus size={12} /> Add Contact
                    </button>
                </div>
            </Section>

            {/* Additional Notes */}
            <Section title="Additional Notes" icon={<FileText size={13} />} defaultOpen={false}>
                <Field label="Notes for Promoter">
                    <textarea
                        className={`${inputCls} resize-none h-24`}
                        value={rider.additionalNotes}
                        onChange={e => set('additionalNotes', e.target.value)}
                        placeholder="Load-in time, parking, catering windows, special requests..."
                    />
                </Field>
            </Section>
        </div>
    );
}
