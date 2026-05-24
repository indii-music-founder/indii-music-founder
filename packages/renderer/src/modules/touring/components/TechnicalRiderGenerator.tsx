/**
 * TechnicalRiderGenerator — Item 132 (PRODUCTION_200)
 * Form-based builder generating PDF stage plots and technical riders for promoters.
 * Sections: Stage, PA/FOH, Monitor Mix, Lighting, Backline, Contacts.
 * Dynamic Morphing layout for DJs, Solo Artists, Bands, Hip Hop/Rap, and Non-Performing Producers.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
    FileText, Download, ChevronDown, ChevronUp, Mic2,
    Lightbulb, Music2, Phone, Ruler, Plus, Trash2, CheckCircle2,
    Disc, User, Users, Cpu, Volume2
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';

type ArtistCategory = 'dj' | 'solo' | 'duo' | 'band' | 'producer' | 'hiphop';

interface Contact {
    role: string;
    name: string;
    phone: string;
    email: string;
}

interface RiderState {
    artistCategory: ArtistCategory;
    artistName: string;
    actName: string;
    memberCount: string;
    stageLayoutAsset?: string;
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

const PRESETS: Record<ArtistCategory, Omit<RiderState, 'artistName' | 'actName' | 'contacts' | 'artistCategory'>> = {
    dj: {
        memberCount: '1',
        stageWidth: '16',
        stageDepth: '12',
        stageHeight: '2',
        paSystem: 'L-Acoustics K2 or d&b audiotechnik V-Series (high power stereo focus)',
        subwoofers: '6x double 18" subwoofers center-clustered for high low-end presence',
        fohConsole: 'Pioneer DJM-V10 or DiGiCo SD11',
        fohChannels: '8',
        needsFohEngineer: false,
        monitorConsole: 'None (booth monitors requested)',
        monitorMixes: '2',
        iemMixes: '0',
        lightingRig: true,
        followSpot: false,
        haze: true,
        lightingNotes: 'Dynamic strobe lights, synced haze, and front/back wash. Visuals are primary.',
        drumKit: false,
        drumNotes: '',
        bassAmp: '',
        guitarAmp: '',
        keys: 'Pioneer CDJ-3000 x3, Pioneer DJM-900NXS2 mixer, stable heavy DJ table/booth',
        additionalNotes: 'Booth monitors MUST be controllable directly from the DJ mixer. Separate 20A power drop on stage behind the DJ booth.'
    },
    solo: {
        memberCount: '1',
        stageWidth: '12',
        stageDepth: '10',
        stageHeight: '1.5',
        paSystem: 'Standard high-quality vocal PA (e.g. QSC K12.2 or equivalent)',
        subwoofers: '2x 18" subwoofers',
        fohConsole: 'Behringer X32 or Soundcraft UI24R',
        fohChannels: '6',
        needsFohEngineer: true,
        monitorConsole: 'Shared with FOH',
        monitorMixes: '2',
        iemMixes: '1',
        lightingRig: true,
        followSpot: true,
        haze: false,
        lightingNotes: 'Warm front wash (amber/white), subtle backlight.',
        drumKit: false,
        drumNotes: '',
        bassAmp: '',
        guitarAmp: 'Acoustic Guitar DI box + Fender Blues Junior or similar',
        keys: '',
        additionalNotes: 'Artist will provide vocal microphone (Neumann KMS105) and acoustic guitar. Requires 1 heavy boom mic stand.'
    },
    duo: {
        memberCount: '2',
        stageWidth: '20',
        stageDepth: '15',
        stageHeight: '3',
        paSystem: 'L-Acoustics K2 or d&b audiotechnik',
        subwoofers: '4x double 18" subwoofers',
        fohConsole: 'DiGiCo SD12 or Midas M32',
        fohChannels: '16',
        needsFohEngineer: true,
        monitorConsole: 'Shared FOH / Monitor desk',
        monitorMixes: '4',
        iemMixes: '2',
        lightingRig: true,
        followSpot: true,
        haze: true,
        lightingNotes: 'Vibrant side-lighting, synchronized haze, clean stage look.',
        drumKit: true,
        drumNotes: 'Standard 4-piece maple drum kit, or electronic drum pad station',
        bassAmp: 'Ampeg SVT-4 PRO',
        guitarAmp: 'Vox AC30 or Fender Deluxe Reverb',
        keys: 'Nord Electro + double tier stand',
        additionalNotes: 'Requires separate DI lines for electronic backing tracks (stereo pair, channels 15-16).'
    },
    band: {
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
        additionalNotes: 'Professional 3-way stage monitors required for non-IEM mixes. High vocal clearance.'
    },
    hiphop: {
        memberCount: '2',
        stageWidth: '24',
        stageDepth: '16',
        stageHeight: '3',
        paSystem: 'L-Acoustics K2, d&b KSL, or Meyer Sound LEO (must deliver 110dB at FOH with high headroom)',
        subwoofers: '8x double 18" subwoofers center-flown/ground-stacked for massive low-end impact',
        fohConsole: 'DiGiCo SD10 or Avid Venue S6L',
        fohChannels: '16',
        needsFohEngineer: true,
        monitorConsole: 'Shared FOH / Monitor console',
        monitorMixes: '4',
        iemMixes: '2',
        lightingRig: true,
        followSpot: true,
        haze: true,
        lightingNotes: 'Fast dynamic strobes, audience blinders, CO2 jets, and pyro capabilities if venue permits.',
        drumKit: false,
        drumNotes: '',
        bassAmp: '',
        guitarAmp: '',
        keys: 'Pioneer CDJ-3000 x2, Pioneer DJM-V10 or Rane Seventy-Two mixer, heavy DJ table (middle-stage)',
        additionalNotes: 'Requires 2x professional wireless handheld microphones (Shure Axient Digital with Beta 58A or Sennheiser 6000 with e945 capsule). Microphone capsules must be fresh. Highly critical: High-power sidefills (L-Acoustics ARCS or equivalent) on left/right stage wings.'
    },
    producer: {
        memberCount: '1',
        stageWidth: '10',
        stageDepth: '8',
        stageHeight: '1',
        paSystem: 'Standard studio-grade playback monitors / Genelec 8351B or equivalent',
        subwoofers: '1x Genelec 7380A Subwoofer',
        fohConsole: 'Apollo x8p or Universal Audio interface',
        fohChannels: '4',
        needsFohEngineer: false,
        monitorConsole: 'Studio monitoring console',
        monitorMixes: '2',
        iemMixes: '0',
        lightingRig: false,
        followSpot: false,
        haze: false,
        lightingNotes: 'Comfortable, dim ambient studio lighting / LED strip tubes.',
        drumKit: false,
        drumNotes: '',
        bassAmp: '',
        guitarAmp: '',
        keys: 'Ableton Push 3 + 49-key MIDI controller + solid studio desk',
        additionalNotes: 'This is a Masterclass / Studio Session setup. Requires high-speed internet (100Mbps down/up minimum) and HD screen/projector mirroring.'
    }
};

const DEFAULT_CONTACTS = [
    { role: 'Tour Manager', name: '', phone: '', email: '' },
    { role: 'FOH Engineer', name: '', phone: '', email: '' },
    { role: 'Production Manager', name: '', phone: '', email: '' },
];

const DEFAULT_STATE: RiderState = {
    artistCategory: 'band',
    artistName: '',
    actName: '',
    ...PRESETS.band,
    contacts: DEFAULT_CONTACTS,
};

const CATEGORY_DETAILS = [
    { id: 'dj', label: 'DJ / Electronic', icon: Disc, description: 'CDJ setup, subwoofers, booth wedges', color: 'text-violet-400 border-violet-500/20 bg-violet-500/5' },
    { id: 'hiphop', label: 'Hip Hop / Rap', icon: Volume2, description: 'Wireless vocal mics, DJ booth, high bass subs, sidefills', color: 'text-orange-400 border-orange-500/20 bg-orange-500/5' },
    { id: 'solo', label: 'Solo Artist', icon: User, description: 'Acoustic focus, minimal wedges', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' },
    { id: 'duo', label: 'Duo Act', icon: Users, description: 'Compact backline, stereo IEM setup', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
    { id: 'band', label: 'Full Band', icon: Music2, description: 'Multi-piece, acoustic drum kit spec', color: 'text-sky-400 border-sky-500/20 bg-sky-500/5' },
    { id: 'producer', label: 'Non-Performing', icon: Cpu, description: 'Studio session, masterclass playback', color: 'text-rose-400 border-rose-500/20 bg-rose-500/5' }
] as const;

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
    const isProducer = r.artistCategory === 'producer';
    
    // Dynamic labels for PDF
    const stageTitle = isProducer ? "Setup Area & Power" : "Stage Requirements";
    const widthLabel = isProducer ? "Desk/Table Width" : "Width";
    const depthLabel = isProducer ? "Desk/Table Depth" : "Depth";
    const heightLabel = isProducer ? "Platform Height" : "Height";
    
    const paTitle = isProducer ? "Playback & Interfaces" : "PA / FOH";
    const paSystemLabel = isProducer ? "Studio Monitors" : "PA System";
    const subLabel = isProducer ? "Subwoofer Spec" : "Subwoofers";
    const consoleLabel = isProducer ? "Audio Interface / Desk Mixer" : "FOH Console";
    const channelsLabel = isProducer ? "Total Input Channels" : "Input Channels";
    const engineerLabel = isProducer ? "Setup Technician" : "FOH Engineer";
    const engineerVal = isProducer 
        ? (r.needsFohEngineer ? 'Provided by artist' : 'Provided by host') 
        : (r.needsFohEngineer ? 'Provided by artist' : 'Provided by venue');
        
    const monitorTitle = isProducer ? "Studio Monitoring" : "Monitor Mix";
    const monitorConsoleLabel = isProducer ? "Monitor Interface" : "Monitor Console";
    const wedgesLabel = isProducer ? "Nearfield Pairs" : "Wedge Mixes";
    const iemsLabel = isProducer ? "Headphone Mixes" : "IEM Mixes";
    
    const lightingTitle = isProducer ? "Ambient Lighting" : "Lighting";
    const lightingRigLabel = isProducer ? "Warm Mood Lighting" : "Full Rig Required";
    const followSpotLabel = isProducer ? "Presentation Spot" : "Follow Spot";
    
    const backlineTitle = isProducer ? "MIDI Gear & Control Desk" : "Backline";
    const drumLabel = isProducer ? "Secondary Desk Required" : "Drum Kit";
    const bassLabel = isProducer ? "Hardware Synths" : "Bass Amp";
    const guitarLabel = isProducer ? "Outboard FX" : "Guitar Amp";
    const keysLabel = isProducer ? "MIDI Controllers / DJ Setup" : "Keys / DJ Deck";

    const backlineRows = [];
    if (r.drumKit) {
        backlineRows.push(`<tr><td>${drumLabel}</td><td>${r.drumNotes || 'Yes'}</td></tr>`);
    }
    if (r.bassAmp) {
        backlineRows.push(`<tr><td>${bassLabel}</td><td>${r.bassAmp}</td></tr>`);
    }
    if (r.guitarAmp) {
        backlineRows.push(`<tr><td>${guitarLabel}</td><td>${r.guitarAmp}</td></tr>`);
    }
    if (r.keys) {
        backlineRows.push(`<tr><td>${keysLabel}</td><td>${r.keys}</td></tr>`);
    }

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
<p><strong>Artist Classification:</strong> ${r.artistCategory.toUpperCase()}</p>
<p><strong>Artist:</strong> ${r.artistName}</p>
<p><strong>Act / Show Name:</strong> ${r.actName}</p>
<p><strong>Members on Stage:</strong> ${r.memberCount}</p>

<h2>${stageTitle}</h2>
<table><tr><th>Dimension</th><th>Minimum</th></tr>
<tr><td>${widthLabel}</td><td>${r.stageWidth} ft</td></tr>
<tr><td>${depthLabel}</td><td>${r.stageDepth} ft</td></tr>
<tr><td>${heightLabel}</td><td>${r.stageHeight} ft</td></tr></table>

${r.stageLayoutAsset ? `
<h2>Stage Plot Schematic</h2>
<div style="text-align:center;margin:15px 0;border:1px solid #ddd;padding:12px;background:#fcfcfc;border-radius:8px">
  <img src="${r.stageLayoutAsset}" alt="Stage Plot Schematic" style="max-width:100%;max-height:360px;object-fit:contain;border-radius:4px" />
</div>
` : ''}

<h2>${paTitle}</h2>
<table><tr><th>Item</th><th>Spec</th></tr>
<tr><td>${paSystemLabel}</td><td>${r.paSystem}</td></tr>
<tr><td>${subLabel}</td><td>${r.subwoofers}</td></tr>
<tr><td>${consoleLabel}</td><td>${r.fohConsole}</td></tr>
<tr><td>${channelsLabel}</td><td>${r.fohChannels}</td></tr>
<tr><td>${engineerLabel}</td><td>${engineerVal}</td></tr></table>

<h2>${monitorTitle}</h2>
<table><tr><th>Item</th><th>Spec</th></tr>
<tr><td>${monitorConsoleLabel}</td><td>${r.monitorConsole}</td></tr>
<tr><td>${wedgesLabel}</td><td>${r.monitorMixes}</td></tr>
<tr><td>${iemsLabel}</td><td>${r.iemMixes}</td></tr></table>

<h2>${lightingTitle}</h2>
<p>${lightingRigLabel}: ${r.lightingRig ? 'YES' : 'NO'} | ${followSpotLabel}: ${r.followSpot ? 'YES' : 'NO'} | Haze: ${r.haze ? 'YES' : 'NO'}</p>
${r.lightingNotes ? `<div class="note">${r.lightingNotes}</div>` : ''}

<h2>${backlineTitle}</h2>
<table><tr><th>Item</th><th>Spec</th></tr>
${backlineRows.length > 0 ? backlineRows.join('') : `<tr><td colspan="2">No backline requirements. Artist provides all gear.</td></tr>`}
</table>

<h2>Key Contacts</h2>
<table><tr><th>Role</th><th>Name</th><th>Phone</th><th>Email</th></tr>
${r.contacts.map(c => `<tr><td>${c.role}</td><td>${c.name || '—'}</td><td>${c.phone || '—'}</td><td>${c.email || '—'}</td></tr>`).join('')}
</table>

${r.additionalNotes ? `<h2>Additional Notes</h2><div class="note">${r.additionalNotes}</div>` : ''}
</body></html>`;
}

export function TechnicalRiderGenerator() {
    const toast = useToast();
    const { userProfile, consumeHandoff } = useStore(useShallow(state => ({ 
        userProfile: state.userProfile,
        consumeHandoff: state.consumeHandoff
    })));
    const [rider, setRider] = useState<RiderState>(DEFAULT_STATE);
    const [exported, setExported] = useState(false);
    const hasInitializedRef = useRef(false);
    const linkRef = useRef<HTMLAnchorElement>(null);

    // Staged Handoff Hook Interceptor
    useEffect(() => {
        const payload = consumeHandoff('touring');
        if (payload) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRider(prev => ({
                ...prev,
                stageLayoutAsset: payload.assetUrl
            }));
            toast.success(`Stage schematic loaded: "${payload.prompt || 'staged asset'}"!`);
        }
    }, [consumeHandoff, toast]);

    // Dynamic Labels based on Category
    const isProducer = rider.artistCategory === 'producer';
    const isHipHop = rider.artistCategory === 'hiphop';
    
    const stageTitle = isProducer ? "Setup Area & Power" : "Stage Requirements";
    const widthLabel = isProducer ? "Desk/Table Width (ft)" : "Width (ft)";
    const depthLabel = isProducer ? "Desk/Table Depth (ft)" : "Depth (ft)";
    const heightLabel = isProducer ? "Platform Height (ft)" : "Height (ft)";
    
    const paTitle = isProducer ? "Playback & Interfaces" : "PA / FOH";
    const paSystemLabel = isProducer ? "Studio/Playback Monitors" : "PA System";
    const subLabel = isProducer ? "Subwoofer Spec" : "Subwoofers";
    const consoleLabel = isProducer ? "Audio Interface / Desk Mixer" : "FOH Console";
    const channelsLabel = isProducer ? "Total Input Channels" : "Input Channels";
    const engineerLabel = isProducer ? "Needs Setup Technician" : "Artist provides FOH Engineer";
    
    const monitorTitle = isProducer ? "Studio Monitoring" : "Monitor Mix";
    const monitorConsoleLabel = isProducer ? "Monitor Interface" : "Monitor Console";
    const wedgesLabel = isProducer ? "Nearfield Pairs" : "Wedge Mixes";
    const iemsLabel = isProducer ? "Headphone Mixes" : "IEM Mixes";
    
    const lightingTitle = isProducer ? "Ambient Lighting" : "Lighting";
    const lightingRigToggleLabel = isProducer ? "Warm Mood Lighting" : "Full Lighting Rig";
    const followSpotToggleLabel = isProducer ? "Presentation Spot" : "Follow Spot";
    
    const backlineTitle = isProducer ? "MIDI Gear & Control Desk" : (isHipHop ? "DJ Equipment & Decks" : "Backline");
    const drumToggleLabel = isProducer ? "Secondary DAW/Controller Desk" : "Drum Kit Required";
    const drumNotesLabel = isProducer ? "Secondary Desk Specs" : "Drum Kit Spec";
    const bassAmpLabel = isProducer ? "Hardware Synths" : "Bass Amp";
    const guitarAmpLabel = isProducer ? "Outboard FX Units" : "Guitar Amp";
    const keysLabel = isProducer ? "MIDI Controllers" : (isHipHop ? "DJ Playback Gear" : "Keys / Synth Deck");

    // Auto-initialize based on User Profile (Matt Pocock onboarding alignment)
    useEffect(() => {
        if (userProfile && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            
            // Intelligently guess the best category
            let defaultCat: ArtistCategory = 'band';
            
            const lowerBio = userProfile.bio?.toLowerCase() || '';
            const lowerDesc = userProfile.brandKit?.brandDescription?.toLowerCase() || '';
            const lowerGenre = userProfile.brandKit?.releaseDetails?.genre?.toLowerCase() || '';

            if (userProfile.artistType === 'Solo') {
                defaultCat = 'solo';
            } else if (userProfile.artistType === 'Band') {
                defaultCat = 'band';
            } else if (userProfile.artistType === 'Collective') {
                defaultCat = 'duo';
            }

            // Overrides based on strong keyword clues
            if (lowerBio.includes('dj') || lowerDesc.includes('dj') || lowerGenre.includes('electronic') || lowerGenre.includes('techno') || lowerGenre.includes('house')) {
                defaultCat = 'dj';
            } else if (lowerBio.includes('producer') || lowerDesc.includes('producer')) {
                defaultCat = 'producer';
            }

            if (lowerBio.includes('hip hop') || lowerBio.includes('hiphop') || lowerBio.includes('rap') || lowerBio.includes('trap') ||
                lowerDesc.includes('hip hop') || lowerDesc.includes('hiphop') || lowerDesc.includes('rap') || lowerDesc.includes('trap') ||
                lowerGenre.includes('hip hop') || lowerGenre.includes('hiphop') || lowerGenre.includes('rap') || lowerGenre.includes('trap')) {
                defaultCat = 'hiphop';
            }

            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRider(prev => ({
                ...prev,
                artistCategory: defaultCat,
                artistName: userProfile.displayName || '',
                actName: userProfile.brandKit?.releaseDetails?.title || '',
                ...PRESETS[defaultCat]
            }));
        }
    }, [userProfile]);

    const set = (key: keyof RiderState, value: RiderState[keyof RiderState]) =>
        setRider(r => ({ ...r, [key]: value }));

    const handleCategoryChange = (cat: ArtistCategory) => {
        setRider(prev => ({
            ...prev,
            artistCategory: cat,
            ...PRESETS[cat]
        }));
    };

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

            {/* Artist Classification Picker */}
            <div className="space-y-2 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    Artist Classification & Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {CATEGORY_DETAILS.map(cat => {
                        const Icon = cat.icon;
                        const isSelected = rider.artistCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryChange(cat.id)}
                                className={`flex flex-col items-center justify-between text-center p-3 rounded-xl border transition-all duration-300 ${
                                    isSelected
                                        ? `bg-[#FFE135]/5 border-[#FFE135]/40 shadow-lg shadow-[#FFE135]/5 scale-[1.02]`
                                        : `bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/[0.02]`
                                }`}
                            >
                                <div className={`p-2 rounded-lg mb-1.5 border transition-all duration-300 ${
                                    isSelected 
                                        ? 'text-[#FFE135] border-[#FFE135]/20 bg-[#FFE135]/10' 
                                        : cat.color
                                }`}>
                                    <Icon size={16} />
                                </div>
                                <div className="space-y-0.5">
                                    <div className={`text-[11px] font-black tracking-wide ${isSelected ? 'text-white font-bold' : 'text-neutral-400 font-semibold'}`}>
                                        {cat.label}
                                    </div>
                                    <div className="text-[8px] text-neutral-600 line-clamp-2 leading-tight">
                                        {cat.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
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
            <Section title={stageTitle} icon={<Ruler size={13} />}>
                <div className="grid grid-cols-3 gap-3">
                    <Field label={widthLabel}>
                        <input type="number" className={inputCls} value={rider.stageWidth} onChange={e => set('stageWidth', e.target.value)} />
                    </Field>
                    <Field label={depthLabel}>
                        <input type="number" className={inputCls} value={rider.stageDepth} onChange={e => set('stageDepth', e.target.value)} />
                    </Field>
                    <Field label={heightLabel}>
                        <input type="number" className={inputCls} value={rider.stageHeight} onChange={e => set('stageHeight', e.target.value)} />
                    </Field>
                </div>
            </Section>

            {/* Stage Plot / Visual Layout */}
            <Section title="Stage Plot / Visual Layout" icon={<FileText size={13} />}>
                {rider.stageLayoutAsset ? (
                    <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 p-2 max-w-lg mx-auto">
                            <img
                                src={rider.stageLayoutAsset}
                                alt="Stage Layout Plot"
                                className="w-full max-h-64 object-contain rounded-lg shadow-lg"
                            />
                            <button
                                onClick={() => set('stageLayoutAsset', undefined)}
                                className="absolute top-4 right-4 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded uppercase tracking-wider transition-colors shadow-lg"
                            >
                                Remove
                            </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 italic text-center">
                            This schematic will be embedded center-stage in your exported technical rider document.
                        </p>
                    </div>
                ) : (
                    <div className="border border-dashed border-white/5 rounded-xl p-5 text-center bg-white/[0.01]">
                        <p className="text-xs text-neutral-400">
                            No stage plot or schematic visual attached.
                        </p>
                        <p className="text-[10px] text-neutral-600 mt-1">
                            Tip: Generate a 3D stage layout in the Creative Studio and select "Send to Tour Rider" to load it here instantly.
                        </p>
                    </div>
                )}
            </Section>

            {/* PA / FOH */}
            <Section title={paTitle} icon={<Mic2 size={13} />}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={paSystemLabel}>
                        <input className={inputCls} value={rider.paSystem} onChange={e => set('paSystem', e.target.value)} />
                    </Field>
                    <Field label={subLabel}>
                        <input className={inputCls} value={rider.subwoofers} onChange={e => set('subwoofers', e.target.value)} />
                    </Field>
                    <Field label={consoleLabel}>
                        <input className={inputCls} value={rider.fohConsole} onChange={e => set('fohConsole', e.target.value)} />
                    </Field>
                    <Field label={channelsLabel}>
                        <input type="number" className={inputCls} value={rider.fohChannels} onChange={e => set('fohChannels', e.target.value)} />
                    </Field>
                </div>
                <Toggle label={engineerLabel} value={rider.needsFohEngineer} onChange={v => set('needsFohEngineer', v)} />
            </Section>

            {/* Monitor Mix */}
            <Section title={monitorTitle} icon={<Mic2 size={13} />}>
                <div className="grid grid-cols-3 gap-3">
                    <Field label={monitorConsoleLabel}>
                        <input className={inputCls} value={rider.monitorConsole} onChange={e => set('monitorConsole', e.target.value)} />
                    </Field>
                    <Field label={wedgesLabel}>
                        <input type="number" className={inputCls} value={rider.monitorMixes} onChange={e => set('monitorMixes', e.target.value)} />
                    </Field>
                    <Field label={iemsLabel}>
                        <input type="number" className={inputCls} value={rider.iemMixes} onChange={e => set('iemMixes', e.target.value)} />
                    </Field>
                </div>
            </Section>

            {/* Lighting */}
            <Section title={lightingTitle} icon={<Lightbulb size={13} />}>
                <div className="flex flex-wrap gap-2">
                    <Toggle label={lightingRigToggleLabel} value={rider.lightingRig} onChange={v => set('lightingRig', v)} />
                    <Toggle label={followSpotToggleLabel} value={rider.followSpot} onChange={v => set('followSpot', v)} />
                    <Toggle label="Haze Machine" value={rider.haze} onChange={v => set('haze', v)} />
                </div>
                <Field label="Lighting Notes">
                    <textarea className={`${inputCls} resize-none h-16`} value={rider.lightingNotes} onChange={e => set('lightingNotes', e.target.value)} />
                </Field>
            </Section>

            {/* Backline */}
            <Section title={backlineTitle} icon={<Music2 size={13} />}>
                <Toggle label={drumToggleLabel} value={rider.drumKit} onChange={v => set('drumKit', v)} />
                {rider.drumKit && (
                    <Field label={drumNotesLabel}>
                        <input className={inputCls} value={rider.drumNotes} onChange={e => set('drumNotes', e.target.value)} />
                    </Field>
                )}
                <div className="grid grid-cols-3 gap-3">
                    <Field label={bassAmpLabel}>
                        <input className={inputCls} value={rider.bassAmp} onChange={e => set('bassAmp', e.target.value)} placeholder="None" />
                    </Field>
                    <Field label={guitarAmpLabel}>
                        <input className={inputCls} value={rider.guitarAmp} onChange={e => set('guitarAmp', e.target.value)} placeholder="None" />
                    </Field>
                    <Field label={keysLabel}>
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
