import React, { useEffect, useState } from 'react';
import { auth } from '@/services/firebase';
import { rightsOperation } from '@/services/rights/HostedRightsService';
import { SocietyDeliveryProfileSchema, type SocietyRecipient } from '@indii/shared';
/** Visible to operators; server independently verifies the admin claim. No credential values enter this form. */
export function SocietyTransportAdmin({ recipient, busy, run }: { recipient: SocietyRecipient; busy: boolean; run: (operation: () => Promise<void>) => Promise<void> }) {
  const [admin, setAdmin] = useState(false);
  const [draft, setDraft] = useState({ ownerUid: '', senderName: '', senderCode: '', senderIpi: '', authorityReceiptId: '', onboardingReceiptId: '', host: '', port: '', hostKeySha256: '', directory: '', ackDirectory: '', username: '', secretVersion: '' });
  const [resolution, setResolution] = useState({ batchId: '', attemptId: '', receiptId: '', outcome: '' });
  const [versions, setVersions] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true; void auth.currentUser?.getIdTokenResult().then(token => { if (active) setAdmin(token.claims.admin === true); }).catch(() => { if (active) setAdmin(false); }); return () => { active = false; }; }, []);
  if (!admin) return null;
  const labels: Record<keyof typeof draft, string> = { ownerUid: 'Artist account UID', senderName: 'Approved ASCII sender legal name', senderCode: 'Assigned sender code', senderIpi: 'Approved sender IPI', authorityReceiptId: 'Reviewed authority evidence reference', onboardingReceiptId: 'Receiver production approval evidence reference', host: 'Receiver-issued SFTP hostname', port: 'SFTP port', hostKeySha256: 'Verified SSH host key SHA-256 (hex)', directory: 'Canonical outgoing directory', ackDirectory: 'Canonical ACK directory', username: 'Receiver-issued username', secretVersion: 'Owner/recipient-scoped Secret Manager version reference' };
  return <details className="border border-white/20 rounded p-4"><summary>Operator: configure approved receiver access</summary><p>Use receiver-issued settings and reviewed authority/onboarding evidence. Provision credentials separately in the owner-scoped Secret Manager secret. Do not enter passwords or private keys. Saving creates a new configuration revision and requires new exact-batch approval.</p>
    <div className="grid md:grid-cols-2 gap-2">{(Object.keys(draft) as Array<keyof typeof draft>).map(key => <label key={key}>{labels[key]}<input className="block w-full bg-neutral-900 border rounded p-2" value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div>
    <fieldset><legend>Receiver-approved versions</legend>{['2.1', '2.2'].map(version => <label key={version}><input type="checkbox" checked={versions.includes(version)} onChange={event => setVersions(event.target.checked ? [...versions, version] : versions.filter(item => item !== version))} />{version} </label>)}</fieldset>
    <button disabled={busy} onClick={() => void run(async () => {
      const { ownerUid, ...settings } = draft;
      const profile = SocietyDeliveryProfileSchema.parse({ ...settings, port: Number(settings.port), recipient, versions, protocol: 'sftp', approved: true, revision: 1 });
      const { revision: _revision, ...configuration } = profile;
      await rightsOperation('configure_society_transport', { ownerUid, profile: configuration });
      setMessage('Approved configuration saved with a new revision. Refresh receiver status; artists must approve their exact batches again before transmission.');
    })}>Record receiver approval and save configuration</button>
    <details><summary>Resolve an uncertain transfer using receiver evidence</summary><p>Confirm the original attempt with the receiver. A missing remote file alone is insufficient because receivers may move processed files. Recording no transmission requires the artist to approve again; this action never resends.</p>
      {(['batchId', 'attemptId', 'receiptId'] as const).map(key => <label key={key} className="block">{{ batchId: 'Batch ID', attemptId: 'Original delivery attempt UUID', receiptId: 'Reviewed receiver evidence reference' }[key]}<input className="block w-full bg-neutral-900 border rounded p-2" value={resolution[key]} onChange={event => setResolution({ ...resolution, [key]: event.target.value })} /></label>)}
      <label>Receiver-confirmed outcome<select className="block bg-neutral-900" value={resolution.outcome} onChange={event => setResolution({ ...resolution, outcome: event.target.value })}><option value="">Select after reviewing evidence</option><option value="transmitted">Receiver confirms delivery</option><option value="not_transmitted">Receiver confirms no delivery</option></select></label>
      <button disabled={busy || !resolution.outcome} onClick={() => void run(async () => { await rightsOperation('resolve_cwr_transfer', { ownerUid: draft.ownerUid, ...resolution }); setMessage('Operator reconciliation recorded. No remote transfer was performed.'); })}>Record reviewed outcome</button>
    </details>{message && <p role="status">{message}</p>}
  </details>;
}
