import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { RightsCaseSchema, validateCopyrightCase, type RightsCase, type CopyrightWork } from '@indii/shared';
import { db } from '@/services/firebase';
import { downloadRightsFile, rightsOperation, saveRightsCase, uploadRightsDeposit } from '@/services/rights/HostedRightsService';
import { HostedRightsViewport } from './HostedRightsViewport';
import type { CatalogTrack } from '../types';

type DraftWork = Omit<CopyrightWork, 'deposit' | 'publication'> & { deposit?: CopyrightWork['deposit']; publication: Record<string, unknown> };
const inputStyle = 'w-full bg-black/30 border border-white/15 rounded px-3 py-2 text-sm';
const uid = () => crypto.randomUUID();
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs text-gray-300">{label}<input className={inputStyle} value={value} onChange={e => onChange(e.target.value)} /></label>;
}

export function RightsFilingWorkspace({ userId, tracks }: { userId: string; tracks: CatalogTrack[] }) {
  const [kind, setKind] = useState<RightsCase['applicationKind']>('standard');
  const [scope, setScope] = useState<RightsCase['claimScope']>('composition');
  const [parties, setParties] = useState<RightsCase['parties']>([]);
  const [works, setWorks] = useState<DraftWork[]>([]);
  const [caseId, setCaseId] = useState<string>(uid);
  const [revision, setRevision] = useState(1);
  const [certifier, setCertifier] = useState('');
  const [authority, setAuthority] = useState<RightsCase['authority']>('author');
  const [authorityEvidence, setAuthorityEvidence] = useState('');
  const [cases, setCases] = useState<Array<Record<string, any>>>([]);
  const [filings, setFilings] = useState<Array<Record<string, any>>>([]);
  const [savedFilingId, setSavedFilingId] = useState('');
  const [savedHash, setSavedHash] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [capabilities, setCapabilities] = useState({ hostedEnabled: false, rememberEnabled: false, paymentEnabled: false });
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  useEffect(() => {
    const a = onSnapshot(collection(db, 'users', userId, 'rightsCases'), snap => setCases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), () => setMessage('Saved filing cases could not be loaded.'));
    const b = onSnapshot(collection(db, 'users', userId, 'rightsFilings'), snap => setFilings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), () => setMessage('Filing evidence could not be loaded.'));
    void rightsOperation<typeof capabilities>('capabilities').then(setCapabilities).catch(() => {});
    return () => { a(); b(); };
  }, [userId]);
  const changeWork = (id: string, update: Partial<DraftWork>) => { setSavedHash(''); setWorks(prev => prev.map(w => w.entityId === id ? { ...w, ...update } : w)); };
  const selectTrack = (track: CatalogTrack) => {
    setSavedHash('');
    const add = (workKind: CopyrightWork['kind']): DraftWork => ({
      entityId: uid(), trackIds: [track.id], kind: workKind, title: track.title, authorIds: [], claimantIds: [], yearOfCreation: Number(track.yearOfCreation) || 0,
      workForHire: track.workForHire === true, publication: { status: '' }, exclusions: [],
    });
    const composition = add('musical_work'), recording = add('sound_recording');
    if (scope === 'combined') { recording.embodiedWorkId = composition.entityId; setWorks(prev => [...prev, composition, recording]); }
    else setWorks(prev => [...prev, scope === 'composition' ? composition : recording]);
  };
  const manifest = (): RightsCase => RightsCaseSchema.parse({ schemaVersion: 2, caseId, revision, applicationKind: kind, claimScope: scope,
    parties, works, certifierPartyId: certifier, authority, ...(authorityEvidence ? { authorityEvidence } : {}) });
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await operation(); } catch (error) { setMessage(error instanceof Error ? error.message : 'The filing operation failed.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    const value = manifest();
    const prior = cases.find(c => c.id === caseId);
    if (prior) value.revision = prior.manifest.revision + 1;
    const errors = validateCopyrightCase(value);
    if (errors.length) throw new Error(errors.join(' '));
    const result = await saveRightsCase(value);
    setRevision(value.revision); setSavedFilingId(result.filingId); setSavedHash(result.manifestHash); setMessage('Filing preparation saved. No application has been submitted.');
  };
  const loadCase = (record: Record<string, any>) => {
    const value = RightsCaseSchema.parse(record.manifest);
    setCaseId(value.caseId); setRevision(value.revision + 1); setKind(value.applicationKind); setScope(value.claimScope);
    setParties(value.parties); setWorks(value.works); setCertifier(value.certifierPartyId); setAuthority(value.authority);
    setAuthorityEvidence(value.authorityEvidence ?? ''); setSavedHash('');
  };
  return <div className="p-6 space-y-6 overflow-y-auto text-white">
    <h2 className="text-xl font-semibold">Copyright filing workspace</h2>
    <p className="text-sm text-gray-400">Prepare single or group claims, verify deposits, and complete the official application with your own review and certification.</p>
    {cases.length > 0 && <section><h3>Saved cases</h3><div className="flex flex-wrap gap-2">{cases.map(c => <button key={c.id} onClick={() => loadCase(c)} className="border border-white/20 rounded px-3 py-2">{c.manifest?.works?.[0]?.title ?? c.id} · revision {c.manifest?.revision}</button>)}</div></section>}
    <div className="grid md:grid-cols-2 gap-3">
      <label>Application<select className={inputStyle} value={kind} onChange={e => { const k = e.target.value as typeof kind; setKind(k); setSavedHash(''); if (k.startsWith('gram')) { setScope(k === 'gram_composition' ? 'composition' : 'recording'); setWorks([]); } }}>
        <option value="standard">Standard — single work</option><option value="gruw">Group of unpublished works</option><option value="gram_composition">Album musical works</option><option value="gram_recording">Album sound recordings</option>
      </select></label>
      <label>Claim scope<select className={inputStyle} value={scope} disabled={kind.startsWith('gram')} onChange={e => { setScope(e.target.value as typeof scope); setWorks([]); setSavedHash(''); }}>
        <option value="composition">Composition</option><option value="recording">Sound recording</option><option value="combined">Composition and corresponding recording</option>
      </select></label>
    </div>
    <section className="space-y-3"><h3 className="font-semibold">Authors and claimants</h3>
      {parties.map(p => <div key={p.entityId} className="grid md:grid-cols-3 gap-2">
        <Field label="Legal name" value={p.legalName} onChange={legalName => { setSavedHash(''); setParties(prev => prev.map(item => item.entityId === p.entityId ? { ...item, legalName } : item)); }} />
        <Field label="Postal address" value={p.address} onChange={address => { setSavedHash(''); setParties(prev => prev.map(item => item.entityId === p.entityId ? { ...item, address } : item)); }} />
        <Field label="Citizenship or domicile" value={p.citizenshipOrDomicile} onChange={citizenshipOrDomicile => { setSavedHash(''); setParties(prev => prev.map(item => item.entityId === p.entityId ? { ...item, citizenshipOrDomicile } : item)); }} />
      </div>)}
      <button type="button" onClick={() => setParties(prev => [...prev, { entityId: uid(), legalName: '', address: '', citizenshipOrDomicile: '' }])}>Add author or claimant</button>
    </section>
    <section><h3 className="font-semibold">Choose catalog works</h3><div className="flex flex-wrap gap-2">{tracks.filter(t => !works.some(w => w.trackIds.includes(t.id))).map(t => <button key={t.id} type="button" onClick={() => selectTrack(t)} className="border border-white/20 rounded px-3 py-2">{t.title}</button>)}</div></section>
    {works.map(w => <section key={w.entityId} className="border border-white/15 rounded-lg p-4 space-y-3">
      <div className="flex justify-between"><h3>{w.title} · {w.kind === 'musical_work' ? 'Composition' : 'Sound recording'}</h3><button onClick={() => { setWorks(prev => prev.filter(item => item.entityId !== w.entityId)); setSavedHash(''); }}>Remove</button></div>
      <div className="grid md:grid-cols-2 gap-3"><Field label="Title" value={w.title} onChange={title => changeWork(w.entityId, { title })} /><Field label="Year of creation" value={w.yearOfCreation ? String(w.yearOfCreation) : ''} onChange={year => changeWork(w.entityId, { yearOfCreation: Number(year) })} /></div>
      {(['authorIds', 'claimantIds'] as const).map(field => <fieldset key={field}><legend>{field === 'authorIds' ? 'Authors of this work' : 'Copyright claimants'}</legend><div className="flex gap-3 flex-wrap">{parties.map(p => <label key={p.entityId}><input type="checkbox" checked={w[field].includes(p.entityId)} onChange={e => changeWork(w.entityId, { [field]: e.target.checked ? [...w[field], p.entityId] : w[field].filter(id => id !== p.entityId) })} /> {p.legalName || 'Enter legal name above'}</label>)}</div></fieldset>)}
      <Field label="Transfer basis, when a claimant is not an author" value={w.transferBasis ?? ''} onChange={transferBasis => changeWork(w.entityId, { transferBasis: transferBasis || undefined })} />
      <label><input type="checkbox" checked={w.workForHire} onChange={e => changeWork(w.entityId, { workForHire: e.target.checked })} /> Work made for hire — confirm the legal basis</label>
      <label className="block">Publication status<select className={inputStyle} value={String(w.publication.status)} onChange={e => changeWork(w.entityId, { publication: { status: e.target.value } })}><option value="">Choose after review</option><option value="unpublished">Unpublished</option><option value="published">Published</option></select></label>
      <p className="text-xs text-gray-400">A streaming release alone does not establish legal publication. Review the <a href="https://www.copyright.gov/registration/" target="_blank" rel="noreferrer" className="underline">Copyright Office guidance</a>.</p>
      {w.publication.status === 'published' && <div className="grid md:grid-cols-2 gap-2">{['date', 'country', ...(kind.startsWith('gram') ? ['albumId', 'albumTitle', 'albumDate', 'trackNumber'] : [])].map(key => <Field key={key} label={({ date: 'First publication date (YYYY-MM-DD)', country: 'Nation of first publication', albumId: 'Album identifier', albumTitle: 'Album title', albumDate: 'Album publication date (YYYY-MM-DD)', trackNumber: 'Album track number' } as Record<string, string>)[key]} value={String(w.publication[key] ?? '')} onChange={value => changeWork(w.entityId, { publication: { ...w.publication, [key]: key === 'trackNumber' ? Number(value) : value } })} />)}
        {kind.startsWith('gram') && <label><input type="checkbox" checked={w.publication.identicalEarlierSingle === true} onChange={e => changeWork(w.entityId, { publication: { ...w.publication, identicalEarlierSingle: e.target.checked } })} /> Earlier single is identical to the album work</label>}
      </div>}
      <label className="block">Deposit copy<input type="file" disabled={busy} accept=".wav,.mp3,.flac,.pdf,.aif,.aiff,.m4a" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { const deposit = await uploadRightsDeposit(file); changeWork(w.entityId, { deposit }); }); }} /></label>
      {w.deposit && <p className="text-xs text-green-300">Prepared deposit: {(w.deposit.byteSize / 1024 ** 2).toFixed(1)} MB{w.deposit.convertedFrom ? ' · Converted copy; original preserved' : ''}</p>}
    </section>)}
    <section className="space-y-3"><h3>Certifying party</h3><select className={inputStyle} value={certifier} onChange={e => { setCertifier(e.target.value); setSavedHash(''); }}><option value="">Choose certifier</option>{parties.map(p => <option key={p.entityId} value={p.entityId}>{p.legalName}</option>)}</select>
      <select className={inputStyle} value={authority} onChange={e => { setAuthority(e.target.value as typeof authority); setSavedHash(''); }}><option value="author">Author</option><option value="claimant">Claimant</option><option value="authorized_agent">Authorized agent</option></select>
      {authority === 'authorized_agent' && <Field label="Agency authorization reference" value={authorityEvidence} onChange={value => { setAuthorityEvidence(value); setSavedHash(''); }} />}
      <p className="text-xs text-gray-400">You perform the statutory certification inside the official portal. Saving this preparation does not certify or submit it.</p>
    </section>
    <div className="flex gap-3 flex-wrap">
      <button disabled={busy} onClick={() => void run(save)} className="bg-amber-400 text-black px-4 py-2 rounded font-semibold">Validate and save preparation</button>
      <button disabled={busy || !savedHash || !capabilities.hostedEnabled} onClick={() => void run(async () => { const value = await rightsOperation<{ sessionId: string }>('start_session', { caseId, manifestHash: savedHash }); setSessionId(value.sessionId); })} className="border border-white/20 rounded px-4 py-2 disabled:opacity-40">Open hosted copyright portal</button>
      <button onClick={() => window.open('https://eco.copyright.gov/eService_enu/', '_blank', 'noopener,noreferrer')}>Open official portal locally</button>
    </div>
    {!capabilities.hostedEnabled && <p className="text-sm text-amber-300">Hosted filing is awaiting deployment and genuine acceptance checks. Saved preparation and the official portal remain available.</p>}
    <label className="block"><input type="checkbox" checked={remember} disabled={!capabilities.rememberEnabled || busy} onChange={e => { const enabled = e.target.checked; void run(async () => { await rightsOperation(enabled ? 'remember_login' : 'forget_login'); setRemember(enabled); }); }} /> Remember approved portal login for seven days. You can revoke it here.</label>
    {sessionId && <HostedRightsViewport sessionId={sessionId} />}
    <section className="space-y-2"><h3>Report an official confirmation</h3><Field label="Service Request or confirmation number" value={receipt} onChange={setReceipt} />
      <button disabled={!receipt || !savedHash || busy} onClick={() => void run(async () => { await rightsOperation('record_evidence', { caseId, filingId: savedFilingId, evidence: { evidenceId: uid(), kind: 'user_report', externalId: receipt, observedAt: new Date().toISOString() } }); setMessage('Your report is saved. Official filing outcome still requires reconciliation.'); })}>Save reported confirmation</button>
      <button disabled={!receipt} onClick={() => downloadRightsFile('copyright-receipt.json', JSON.stringify({ caseId, revision, externalId: receipt, source: 'user_report' }, null, 2), 'application/json')}>Download receipt report</button>
    </section>
    <section><h3>Filing history</h3>{filings.map(f => <p key={f.id} className="text-sm">{f.id} · {String(f.state).replaceAll('_', ' ')} · {f.evidenceSource ?? 'legacy evidence not verified'}</p>)}</section>
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
  </div>;
}
