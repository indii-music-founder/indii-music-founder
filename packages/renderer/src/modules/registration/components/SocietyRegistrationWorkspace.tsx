import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where, limit, orderBy } from 'firebase/firestore';
import { buildCwrBatch, CwrBatchInputSchema, cwrPercentageUnits, cwrUnitsPercentage, societyPreparationCopy, SOCIETY_ONBOARDING, societyOnboardingChecklist, type CanonicalMusicEntity, type CwrBatchInput, type SocietyRecipient, type CwrWorkOutcome } from '@indii/shared';
import { SocietyTransportAdmin } from './SocietyTransportAdmin';
import { SocietyDeliveryPanel } from './SocietyDeliveryPanel';
import { db } from '@/services/firebase';
import { downloadRightsFile, exportRightsCwr, rightsOperation } from '@/services/rights/HostedRightsService';

const rights = ['performance', 'mechanical', 'synchronization'] as const;
type ShareText = Record<typeof rights[number], string>;
type Territory = { code: string; included: boolean; collection: ShareText };
type Party = { id: string; name: string; firstName: string; ipi: string; role: string; controlled: string; societies: ShareText; ownership: ShareText; territories: Territory[]; chain: string; publisherIds: string[]; workForHire: string; agreementId: string };
type Recording = { releaseDate: string; duration: string; albumTitle: string; albumLabel: string; catalogNumber: string; ean: string; isrc: string; format: string; technique: string; mediaType: string; title: string; versionTitle: string; displayArtist: string; label: string; recordingId: string };
const newRecording = (): Recording => ({ releaseDate: '', duration: '', albumTitle: '', albumLabel: '', catalogNumber: '', ean: '', isrc: '', format: '', technique: '', mediaType: '', title: '', versionTitle: '', displayArtist: '', label: '', recordingId: '' });
type Work = { recordings: Recording[]; entityId: string; workId: string; title: string; transaction: string; revision: string; category: string; recorded: string; duration: string; textMusic: string; iswc: string; writers: Party[]; publishers: Party[] };
type Export = { batchId: string; filename: string; text: string; checksum: string; recipient: SocietyRecipient; preparation?: CwrBatchInput };
type Batch = { id: string; filename: string; checksum: string; state: string };
type AckEvidence = { id: string; sender: string; source: string; transactionCount: number; fileDecisions?: Array<{ type: string; status: string; messages: string[] }> };
type Decision = { id: string; workId: string; status: string; messages: string[]; outcome: string; source: string; revision: number; sender: string };
const emptyShares = (): ShareText => ({ performance: '', mechanical: '', synchronization: '' });
const newParty = (): Party => ({ id: '', name: '', firstName: '', ipi: '', role: '', controlled: '', societies: emptyShares(), ownership: emptyShares(), territories: [], chain: '', publisherIds: [], workForHire: '', agreementId: '' });
const yesNo = (value: string) => { if (!['yes', 'no'].includes(value)) throw new Error('Choose yes or no for control, recording status, and work-for-hire fields.'); return value === 'yes'; };
const shares = (value: ShareText) => Object.fromEntries(rights.map(right => [right, cwrPercentageUnits(value[right])]));
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs">{label}<input className="block w-full bg-black/30 border border-white/20 rounded p-2" value={value} onChange={event => onChange(event.target.value)} /></label>;
}
function Choice({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="block text-xs">{label}<select className="block w-full bg-neutral-900 border border-white/20 rounded p-2" value={value} onChange={event => onChange(event.target.value)}><option value="">Choose after review</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}
function ShareFields({ label, value, onChange }: { label: string; value: ShareText; onChange: (value: ShareText) => void }) {
  return <fieldset><legend>{label}</legend><div className="grid md:grid-cols-3 gap-2">{rights.map(right => <Field key={right} label={`${right} %`} value={value[right]} onChange={text => onChange({ ...value, [right]: text })} />)}</div></fieldset>;
}
function PartyEditor({ party, publisher, publishers, onChange }: { party: Party; publisher: boolean; publishers: Party[]; onChange: (value: Party) => void }) {
  const change = <K extends keyof Party>(key: K, value: Party[K]) => onChange({ ...party, [key]: value });
  return <div className="border border-white/15 rounded p-3 space-y-3">
    <div className="grid md:grid-cols-3 gap-2"><Field label="Your stable party code (up to 9 characters)" value={party.id} onChange={value => change('id', value)} /><Field label={publisher ? 'Publisher legal name' : 'Writer surname / legal name'} value={party.name} onChange={value => change('name', value)} /><Field label="Actual IPI name number" value={party.ipi} onChange={value => change('ipi', value)} />
      {!publisher && <Field label="Writer given names" value={party.firstName} onChange={value => change('firstName', value)} />}
      <Choice label="Role" value={party.role} options={publisher ? [['E', 'Original publisher'], ['AM', 'Administrator'], ['SE', 'Subpublisher'], ['ES', 'Substituted publisher'], ['PA', 'Income participant']] : [['C', 'Composer'], ['A', 'Lyricist'], ['CA', 'Composer and lyricist']]} onChange={value => change('role', value)} />
      <Choice label="Do you control this interest?" value={party.controlled} options={[[ 'yes', 'Yes — authorized control' ], [ 'no', 'No — other interested party' ]]} onChange={value => change('controlled', value)} />
      {publisher ? <><Field label="Publisher chain number" value={party.chain} onChange={value => change('chain', value)} /><Field label="Agreement ID, if applicable" value={party.agreementId} onChange={value => change('agreementId', value)} /></> : <Choice label="Writer work made for hire?" value={party.workForHire} options={[[ 'yes', 'Yes' ], [ 'no', 'No' ]]} onChange={value => change('workForHire', value)} />}
    </div>
    <fieldset><legend>Actual society affiliations — three-digit codes; 000 only when appropriate</legend><div className="grid md:grid-cols-3 gap-2">{rights.map(right => <Field key={right} label={right} value={party.societies[right]} onChange={value => change('societies', { ...party.societies, [right]: value })} />)}</div></fieldset>
    <ShareFields label="Ownership shares — explicitly enter 0 for an unclaimed right" value={party.ownership} onChange={value => change('ownership', value)} />
    {!publisher && <fieldset><legend>Associated publishers for this writer</legend>{publishers.filter(item => item.id).map(item => <label key={item.id} className="block"><input type="checkbox" checked={party.publisherIds.includes(item.id)} onChange={event => change('publisherIds', event.target.checked ? [...party.publisherIds, item.id] : party.publisherIds.filter(id => id !== item.id))} /> {item.name || item.id}</label>)}</fieldset>}
    <fieldset><legend>Territorial collection shares — separate from ownership</legend>{party.territories.map((territory, index) => <div key={index} className="border border-white/10 p-2 space-y-2"><Choice label="Territory" value={territory.code} options={[[ '0840', 'United States' ], [ '0124', 'Canada' ], [ '2136', 'Worldwide' ]]} onChange={code => change('territories', party.territories.map((item, i) => i === index ? { ...item, code } : item))} /><label><input type="checkbox" checked={territory.included} onChange={event => change('territories', party.territories.map((item, i) => i === index ? { ...item, included: event.target.checked } : item))} /> Included territory (excluded territories require explicit zero shares)</label><ShareFields label="Collection shares" value={territory.collection} onChange={collection => change('territories', party.territories.map((item, i) => i === index ? { ...item, collection } : item))} /><button type="button" onClick={() => change('territories', party.territories.filter((_, i) => i !== index))}>Remove territory</button></div>)}<button type="button" onClick={() => change('territories', [...party.territories, { code: '', included: true, collection: emptyShares() }])}>Add collection territory</button></fieldset>
  </div>;
}

export function SocietyRegistrationWorkspace({ userId }: { userId: string }) {
  const [recipient, setRecipient] = useState<SocietyRecipient>('musicmark');
  const [version, setVersion] = useState('2.2');
  const [sender, setSender] = useState({ name: '', ipi: '', code: '' });
  const [sequence, setSequence] = useState('');
  const [works, setWorks] = useState<Work[]>([]);
  const [entities, setEntities] = useState<CanonicalMusicEntity[]>([]);
  const [selected, setSelected] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [artifact, setArtifact] = useState<Export>();
  const [ackEvidence, setAckEvidence] = useState<AckEvidence[]>([]);
  const [outcomes, setOutcomes] = useState<CwrWorkOutcome[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const staged = useRef<CwrBatchInput>();
  const profile = SOCIETY_ONBOARDING[recipient];
  const activeBatchId = artifact?.batchId;
  const activeRecipient = artifact?.recipient;
  const edit = (operation: () => void) => { staged.current = undefined; setArtifact(undefined); setReviewed(false); operation(); };
  const run = async (operation: () => Promise<void>) => { setBusy(true); setMessage(''); try { await operation(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Society preparation failed.'); } finally { setBusy(false); } };
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all: CanonicalMusicEntity[] = []; let after: string | undefined;
      do { const page = await rightsOperation<{ entities: CanonicalMusicEntity[]; next: string | null }>('catalog_entities', after ? { after } : {}); all.push(...page.entities); after = page.next ?? undefined; } while (after && !cancelled);
      if (!cancelled) setEntities(all);
    })().catch(() => { if (!cancelled) setMessage('Catalog compositions could not be loaded.'); });
    const stop = onSnapshot(collection(db, 'users', userId, 'rightsCwrBatches'), snapshot => setBatches(snapshot.docs.map(doc => ({ id: doc.id, filename: String(doc.data().filename), checksum: String(doc.data().checksum), state: String(doc.data().state) }))), () => setMessage('Saved exports could not be loaded.'));
    return () => { cancelled = true; stop(); };
  }, [userId]);
  useEffect(() => {
    setDecisions([]); setOutcomes([]); setAckEvidence([]);
    if (!activeBatchId || !activeRecipient) return;
    const stopOutcomes = onSnapshot(query(collection(db, 'users', userId, 'rightsSocietyOutcomes'), where('recipient', '==', activeRecipient), limit(500)), snapshot => setOutcomes(snapshot.docs.map(doc => doc.data() as CwrWorkOutcome)), () => setMessage('Reconciled work outcomes could not be loaded.'));
    const stopEvidence = onSnapshot(query(collection(db, 'users', userId, 'rightsCwrBatches', activeBatchId, 'acknowledgments'), limit(100)), snapshot => setAckEvidence(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AckEvidence))), () => setMessage('Saved ACK evidence could not be loaded.'));
    const stopDecisions = onSnapshot(query(collection(db, 'users', userId, 'rightsCwrBatches', activeBatchId, 'decisions'), orderBy('importedAt', 'desc'), limit(100)), snapshot => setDecisions(snapshot.docs.map(doc => ({ id: doc.id, workId: String(doc.data().workId), status: String(doc.data().status), outcome: String(doc.data().outcome ?? 'review_required'), source: String(doc.data().source), revision: Number(doc.data().revision), sender: String(doc.data().sender), messages: Array.isArray(doc.data().messages) ? doc.data().messages : [] }))), () => setMessage('Imported acknowledgments could not be loaded.'));
    return () => { stopOutcomes(); stopDecisions(); stopEvidence(); };
  }, [userId, activeBatchId, activeRecipient]);
  const addWork = async (entityId: string) => {
    if (works.some(work => work.entityId === entityId)) throw new Error('This composition is already in the batch.');
    const work = await rightsOperation<{ entityId: string; workId: string; title: string }>('prepare_society_work', { entityId });
    edit(() => setWorks(previous => [...previous, { ...work, recordings: [], transaction: 'NWR', revision: '1', category: '', recorded: '', duration: '', textMusic: '', iswc: '', writers: [], publishers: [] }]));
  };
  const changeWork = (index: number, change: Partial<Work>) => edit(() => setWorks(previous => previous.map((work, i) => i === index ? { ...work, ...change } : work)));
  const loadPreparationCopy = () => {
    const input = societyPreparationCopy(artifact?.preparation);
    const textShares = (value: { performance: number; mechanical: number; synchronization: number }): ShareText => ({ performance: cwrUnitsPercentage(value.performance), mechanical: cwrUnitsPercentage(value.mechanical), synchronization: cwrUnitsPercentage(value.synchronization) });
    const party = (value: CwrBatchInput['works'][number]['writers'][number] | CwrBatchInput['works'][number]['publishers'][number]): Party => ({
      ...newParty(), id: value.id, name: value.name, ipi: value.ipi, role: value.role, controlled: value.controlled ? 'yes' : 'no', societies: value.societies, ownership: textShares(value.ownership), territories: value.territories.map(territory => ({ ...territory, collection: textShares(territory.collection) })),
      ...('chain' in value ? { chain: String(value.chain), agreementId: value.agreementId ?? '' } : { firstName: value.firstName ?? '', publisherIds: value.publisherIds, workForHire: value.workForHire ? 'yes' : 'no' }),
    });
    edit(() => {
      setRecipient(input.recipient); setVersion(input.version); setSender(input.sender); setSequence('');
      setWorks(input.works.map(work => ({ recordings: (work.recordings ?? []).map(recording => ({ ...newRecording(), ...recording })), entityId: input.catalogLinks!.find(link => link.workId === work.workId)!.entityId, workId: work.workId, title: work.title, transaction: work.transaction, revision: String(work.revision), category: work.category, recorded: work.recorded ? 'yes' : 'no', duration: work.duration, textMusic: work.textMusic, iswc: work.iswc ?? '', writers: work.writers.map(party), publishers: work.publishers.map(party) })));
    });
    setMessage('Saved preparation copied. Choose an unused file sequence and review whether each transaction is new or revised before saving. The original batch is unchanged.');
  };
  const prepare = async () => {
    if (!staged.current) {
      const party = (item: Party) => ({ id: item.id, name: item.name, ipi: item.ipi, controlled: yesNo(item.controlled), societies: item.societies, ownership: shares(item.ownership), territories: item.territories.map(t => ({ ...t, collection: shares(t.collection) })) });
      staged.current = CwrBatchInputSchema.parse({ version, recipient, sender, fileSequence: Number(sequence), createdAt: new Date().toISOString(), catalogLinks: works.map(work => ({ entityId: work.entityId, workId: work.workId })), works: works.map(work => ({ recordings: work.recordings.map(recording => Object.fromEntries(Object.entries(recording).filter(([, value]) => value !== ''))), workId: work.workId, title: work.title, transaction: work.transaction, revision: Number(work.revision), category: work.category, recorded: yesNo(work.recorded), duration: work.duration, textMusic: work.textMusic, ...(work.iswc ? { iswc: work.iswc } : {}),
        publishers: work.publishers.map(item => ({ ...party(item), chain: Number(item.chain), role: item.role, ...(item.agreementId ? { agreementId: item.agreementId } : {}) })),
        writers: work.writers.map(item => ({ ...party(item), ...(item.firstName ? { firstName: item.firstName } : {}), role: item.role, publisherIds: item.publisherIds, workForHire: yesNo(item.workForHire) })),
      })) });
    }
    buildCwrBatch(staged.current);
    const result = await exportRightsCwr(staged.current);
    const saved = await rightsOperation<Export>('get_cwr_export', { batchId: result.batchId });
    setArtifact(saved); setReviewed(false);
    setMessage('Export saved with its exact checksum. No works have been transmitted or registered.');
  };
  return <div className="p-6 space-y-5 text-white overflow-y-auto"><h2 className="text-xl font-semibold">PRO and MLC exports</h2>
    <p>Prepare composition registrations, complete receiver onboarding, and track each work’s acknowledgments. Exports are available before production receiver access is approved.</p>
    <fieldset disabled={busy} className="space-y-4"><Choice label="Recipient" value={recipient} options={Object.entries(SOCIETY_ONBOARDING).map(([id, value]) => [id, value.label])} onChange={value => { if (Object.hasOwn(SOCIETY_ONBOARDING, value)) edit(() => setRecipient(value as SocietyRecipient)); }} />
      <section className="border border-amber-400/40 rounded p-4 space-y-2"><h3>{profile.label} onboarding</h3><ol className="list-decimal pl-5">{profile.steps.map(step => <li key={step}>{step}</li>)}</ol><a className="underline" href={profile.guide} target="_blank" rel="noopener noreferrer">Official instructions</a> · <a className="underline" href={profile.contact} target="_blank" rel="noopener noreferrer">Official contact</a><div><button type="button" onClick={() => downloadRightsFile(`${recipient}-onboarding.txt`, societyOnboardingChecklist(recipient))}>Download onboarding checklist</button></div></section>
      {profile.exportSupported ? <><div className="grid md:grid-cols-3 gap-2"><Field label="Actual publisher / administrator legal name" value={sender.name} onChange={name => edit(() => setSender({ ...sender, name }))} /><Field label="Sender IPI name number" value={sender.ipi} onChange={ipi => edit(() => setSender({ ...sender, ipi }))} /><Field label="Assigned CWR sender code" value={sender.code} onChange={code => edit(() => setSender({ ...sender, code }))} /><Field label="Unused receiver file sequence" value={sequence} onChange={value => edit(() => setSequence(value))} /><Choice label="Receiver-approved CWR version" value={version} options={[[ '2.1', '2.1' ], [ '2.2', '2.2' ]]} onChange={value => edit(() => setVersion(value))} /></div>
      <p className="text-xs text-gray-400">Use actual affiliated sender identifiers. Writer and publisher shares follow CWR conventions, not a portal’s display convention. Enter every ownership and collection share explicitly; review receiver instructions before exporting.</p>
      <Choice label="Composition from your catalog" value={selected} options={entities.filter(entity => entity.entityType === 'musical_work' && !works.some(work => work.entityId === entity.id)).map(entity => [entity.id, entity.entityType === 'musical_work' ? entity.title : entity.id])} onChange={setSelected} /><button disabled={!selected} type="button" onClick={() => void run(async () => { await addWork(selected); setSelected(''); })}>Add composition</button>
      <Field label="Or create a named composition record" value={newTitle} onChange={setNewTitle} /><button disabled={!newTitle.trim()} type="button" onClick={() => void run(async () => { const entity = await rightsOperation<CanonicalMusicEntity>('create_entity', { entityType: 'musical_work', name: newTitle }); setEntities(previous => [...previous, entity]); await addWork(entity.id); setNewTitle(''); })}>Create and add composition</button>
      {works.map((work, index) => <section key={work.entityId} className="border border-white/20 rounded p-4 space-y-3"><h3>{work.title} · Composition code {work.workId}</h3><button type="button" onClick={() => edit(() => setWorks(previous => previous.filter((_, i) => i !== index)))}>Remove composition</button><div className="grid md:grid-cols-3 gap-2"><Field label="Export title (ASCII; catalog title is preserved)" value={work.title} onChange={title => changeWork(index, { title })} /><Choice label="Transaction" value={work.transaction} options={[[ 'NWR', 'New registration' ], [ 'REV', 'Revision' ]]} onChange={transaction => changeWork(index, { transaction })} /><Field label="Composition revision" value={work.revision} onChange={revision => changeWork(index, { revision })} /><Choice label="Category" value={work.category} options={[[ 'POP', 'Popular' ], [ 'JAZ', 'Jazz' ], [ 'SER', 'Serious / classical' ]]} onChange={category => changeWork(index, { category })} /><Choice label="Has this composition been recorded?" value={work.recorded} options={[[ 'yes', 'Yes' ], [ 'no', 'No' ]]} onChange={recorded => changeWork(index, { recorded })} /><Field label="Duration HHMMSS (explicit 000000 only if permitted)" value={work.duration} onChange={duration => changeWork(index, { duration })} /><Choice label="Authorship type" value={work.textMusic} options={[[ 'MUS', 'Music' ], [ 'TXT', 'Lyrics' ], [ 'MTX', 'Music and lyrics' ]]} onChange={textMusic => changeWork(index, { textMusic })} /><Field label="Assigned ISWC, if available" value={work.iswc} onChange={iswc => changeWork(index, { iswc })} /></div>
      <section className="space-y-2"><h4>Recording details for this composition</h4><p className="text-xs">Enter factual release information. SESAC preparation requires recording format and known analogue/digital technique. Recording ISRCs remain separate from the composition code.</p>{work.recordings.map((recording, recordingIndex) => <div key={recordingIndex} className="border border-white/15 p-3 grid md:grid-cols-3 gap-2">
        {(Object.keys(newRecording()) as Array<keyof Recording>).filter(key => !['format', 'technique'].includes(key)).map(key => <Field key={key} label={{ releaseDate: 'First release date YYYYMMDD', duration: 'Recording duration HHMMSS', albumTitle: 'Album title', albumLabel: 'Album label', catalogNumber: 'Release catalog number', ean: 'Release EAN (13 digits)', isrc: 'Recording ISRC', mediaType: 'BIEM/CISAC media type', title: 'Recording title (2.2)', versionTitle: 'Version title (2.2)', displayArtist: 'Display artist (2.2)', label: 'Recording label (2.2)', recordingId: 'Your recording ID (2.2)', format: '', technique: '' }[key]} value={recording[key]} onChange={value => changeWork(index, { recordings: work.recordings.map((r, i) => i === recordingIndex ? { ...r, [key]: value } : r) })} />)}
        <Choice label="Recording format" value={recording.format} options={[[ 'A', 'Audio' ], [ 'V', 'Video' ]]} onChange={format => changeWork(index, { recordings: work.recordings.map((r, i) => i === recordingIndex ? { ...r, format } : r) })} />
        <Choice label="Recording technique" value={recording.technique} options={[[ 'A', 'Analogue' ], [ 'D', 'Digital' ], [ 'U', 'Unknown (where receiver permits)' ]]} onChange={technique => changeWork(index, { recordings: work.recordings.map((r, i) => i === recordingIndex ? { ...r, technique } : r) })} />
        <button type="button" onClick={() => changeWork(index, { recordings: work.recordings.filter((_, i) => i !== recordingIndex) })}>Remove recording</button>
      </div>)}<button type="button" onClick={() => changeWork(index, { recordings: [...work.recordings, newRecording()] })}>Add recording details</button></section>
      {(['publishers', 'writers'] as const).map(kind => <section key={kind} className="space-y-2"><h4>{kind === 'publishers' ? 'Publisher interests and chains' : 'Writers and publisher relationships'}</h4>{work[kind].map((item, partyIndex) => <div key={partyIndex}><PartyEditor party={item} publisher={kind === 'publishers'} publishers={work.publishers} onChange={value => changeWork(index, { [kind]: work[kind].map((other, i) => i === partyIndex ? value : other) })} /><button type="button" onClick={() => changeWork(index, { [kind]: work[kind].filter((_, i) => i !== partyIndex) })}>Remove {kind === 'publishers' ? 'publisher' : 'writer'}</button></div>)}<button type="button" onClick={() => changeWork(index, { [kind]: [...work[kind], newParty()] })}>Add {kind === 'publishers' ? 'publisher' : 'writer'}</button></section>)}
      </section>)}<button type="button" disabled={!works.length} onClick={() => void run(prepare)}>Validate and save export</button></> : <p role="status">This recipient requires a reviewed export profile.</p>}
    </fieldset>
    <SocietyTransportAdmin recipient={artifact?.recipient ?? recipient} busy={busy} run={run} />
    <SocietyDeliveryPanel key={artifact?.recipient ?? recipient} recipient={artifact?.recipient ?? recipient} batch={artifact ? { batchId: artifact.batchId, state: batches.find(batch => batch.id === artifact.batchId)?.state } : undefined} busy={busy} run={run} />
    <section><h3>Saved batches</h3>{batches.map(batch => <div key={batch.id} className="py-1"><button disabled={busy} onClick={() => void run(async () => { const result = await rightsOperation<Export>('get_cwr_export', { batchId: batch.id }); setArtifact(result); setReviewed(false); })}>Preview {batch.filename} · {batch.state.replaceAll('_', ' ')}</button></div>)}</section>
    {artifact && <section className="border border-white/20 p-4 space-y-3"><h3>{SOCIETY_ONBOARDING[artifact.recipient].label} · {artifact.filename}</h3><button disabled={busy || !artifact.preparation} onClick={() => void run(async () => loadPreparationCopy())}>Edit a copy of this preparation</button>{!artifact.preparation && <p className="text-xs">This batch has no saved editable preparation. Download its exact file, or reload it from saved batches after creating a new export.</p>}<p className="break-all text-xs">SHA-256: {artifact.checksum}</p><pre className="max-h-64 overflow-auto text-xs">{artifact.text}</pre><button disabled={busy} onClick={() => downloadRightsFile(artifact.filename, artifact.text)}>Download exact CWR file</button><label className="block"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I reviewed this exact file, sender identity, rights, and authority.</label><button disabled={busy || !reviewed} onClick={() => void run(async () => { await rightsOperation('approve_cwr', { batchId: artifact.batchId, checksum: artifact.checksum }); setMessage('Exact export approved. Use the receiver delivery controls when approved access is available, or complete delivery manually.'); })}>Approve this exact export</button>
      <label className="block">Import receiver CWR acknowledgment<input type="file" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(async () => { if (file.size > 20_000_000) throw new Error('ACK file exceeds 20 MB.'); const result = await rightsOperation<{ acknowledgments: unknown[] }>('import_ack', { batchId: artifact.batchId, text: await file.text() }); setMessage(`${result.acknowledgments.length} work acknowledgments correlated. This is user-imported evidence, not independently verified provider acceptance.`); }); }} /></label>
      <h4>Saved acknowledgment evidence</h4>{ackEvidence.map(evidence => <div key={evidence.id} className="text-xs"><p>Sender {evidence.sender} · {evidence.transactionCount} response transactions · {evidence.source === 'receiver_transport' ? 'receiver retrieval' : 'user import'}{evidence.fileDecisions?.map((decision, i) => <span key={i}> · File {decision.type}: {decision.status} {decision.messages.join('; ')}</span>)}</p><button disabled={busy} onClick={() => void run(async () => { const saved = await rightsOperation<{ filename: string; text: string }>('get_cwr_ack', { batchId: artifact.batchId, evidenceId: evidence.id }); downloadRightsFile(saved.filename, saved.text); })}>Download exact ACK evidence</button></div>)}{ackEvidence.length === 100 && <p>Showing up to 100 evidence files.</p>}
      <h4>Current reconciled work outcomes</h4>{outcomes.filter(outcome => artifact.preparation?.works.some(work => work.workId === outcome.workId) ?? outcome.batchId === artifact.batchId).map(outcome => <p key={`${outcome.workId}_${outcome.sender}`} className="text-xs">{outcome.workId} · revision {outcome.revision} · sender {outcome.sender} · {outcome.outcome.replaceAll('_', ' ')}{outcome.revision < (artifact.preparation?.works.find(work => work.workId === outcome.workId)?.revision ?? outcome.revision) ? ' (prior revision; current revision awaiting ACK)' : ''} · {outcome.independentlyVerified ? 'retrieved from approved receiver' : 'reported by imported file'}</p>)}{outcomes.length === 500 && <p>Showing up to 500 reconciled outcomes for this recipient.</p>}
      <p className="text-xs text-amber-300">Imported ACKs retain their provenance. Initial file acceptance does not establish that each society registered a work.</p>{decisions.slice(0, 100).map(decision => <p key={decision.id} className="text-xs">{decision.workId} · revision {decision.revision} · sender {decision.sender} · {decision.outcome.replaceAll('_', ' ')} ({decision.status}) · {decision.source === 'receiver_transport' ? 'receiver retrieval' : 'user-reported import'} · {decision.messages.join('; ')}</p>)}{decisions.length === 100 && <p>Showing the latest 100 decisions. Current outcomes are reconciled across saved evidence; legacy decisions without timestamps remain in their original records.</p>}
    </section>}
    {message && <p role="status" className="text-amber-300 whitespace-pre-wrap">{message}</p>}
  </div>;
}
