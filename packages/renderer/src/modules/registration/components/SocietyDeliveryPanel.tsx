import React, { useEffect, useState } from 'react';
import type { SocietyRecipient } from '@indii/shared';
import { rightsOperation } from '@/services/rights/HostedRightsService';

type Status = { enabled: boolean; configured: boolean; reason: string; revision?: number; onboarding?: { senderName: string; senderIpi: string; senderCode: string; authorityDescription: string } | null };
export function SocietyDeliveryPanel({ recipient, batch, busy, run }: {
  recipient: SocietyRecipient; batch?: { batchId: string; state?: string }; busy: boolean;
  run: (operation: () => Promise<void>) => Promise<void>;
}) {
  const [status, setStatus] = useState<Status>();
  const [draft, setDraft] = useState({ senderName: '', senderIpi: '', senderCode: '', authorityDescription: '' });
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState('');
  const refresh = async () => setStatus(await rightsOperation<Status>('society_delivery_status', { recipient }));
  useEffect(() => {
    let alive = true;
    void rightsOperation<Status>('society_delivery_status', { recipient }).then(value => {
      if (alive) { setStatus(value); setDraft({ senderName: value.onboarding?.senderName ?? '', senderIpi: value.onboarding?.senderIpi ?? '', senderCode: value.onboarding?.senderCode ?? '', authorityDescription: value.onboarding?.authorityDescription ?? '' }); }
    }).catch(() => { if (alive) setResult('Receiver configuration could not be loaded.'); });
    return () => { alive = false; };
  }, [recipient]);
  return <section className="border border-white/20 rounded p-4 space-y-3"><h3>Receiver access and delivery</h3>
    <p>{status?.reason ?? 'Loading receiver status…'}</p>
    <details><summary>Request onboarding review</summary><p>Provide actual sender identity and describe your authority. Receiver approval is recorded separately by an authorized operator. Do not enter credentials here.</p>
      {(['senderName', 'senderIpi', 'senderCode', 'authorityDescription'] as const).map(key => <label key={key} className="block">{{ senderName: 'Publisher / administrator legal name', senderIpi: 'Sender IPI', senderCode: 'Assigned sender code', authorityDescription: 'Administration authority and onboarding progress' }[key]}<input className="block w-full bg-neutral-900 border rounded p-2" value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
      <button disabled={busy} onClick={() => void run(async () => { await rightsOperation('save_society_onboarding', { recipient, ...draft }); await refresh(); setResult('Onboarding review requested. This does not establish receiver approval.'); })}>Save onboarding request</button>
    </details>
    <button disabled={busy} onClick={() => void run(refresh)}>Refresh receiver status</button>
    <button disabled={busy || !status?.configured} onClick={() => void run(async () => { await rightsOperation('revoke_society_transport', { recipient }); await refresh(); setResult('Authorization revoked. New transfers and receiver retrieval are blocked.'); })}>Revoke receiver access</button>
    {batch && <><p>Selected batch: {batch.state?.replaceAll('_', ' ') ?? 'loading state'}</p>
      <button disabled={busy || !status?.enabled || batch.state !== 'approved_export'} onClick={() => void run(async () => { const receipt = await rightsOperation<{ transmitted: boolean }>('deliver_cwr', { batchId: batch.batchId }); setResult(receipt.transmitted ? 'Exact approved batch transmitted. Awaiting receiver acknowledgment.' : 'No transmission receipt returned.'); })}>Transmit approved batch</button>
      <button disabled={busy || !status?.enabled || !['delivery_claimed', 'delivery_outcome_unknown'].includes(batch.state ?? '')} onClick={() => void run(async () => { const receipt = await rightsOperation<{ transmitted: boolean }>('reconcile_cwr_transfer', { batchId: batch.batchId }); setResult(receipt.transmitted ? 'Receiver bytes match the approved batch. Transport reconciled; work acceptance still awaits ACK.' : 'Receiver bytes differ. Manual receiver review is required; no resend occurred.'); })}>Reconcile uncertain transfer</button>
      <label className="block">Receiver-issued ACK filename<input className="block w-full bg-neutral-900 border rounded p-2" value={filename} onChange={event => setFilename(event.target.value)} /></label>
      <button disabled={busy || !status?.enabled || !filename} onClick={() => void run(async () => { const response = await rightsOperation<{ acknowledgments: unknown[] }>('fetch_cwr_ack', { batchId: batch.batchId, filename }); setResult(`${response.acknowledgments.length} work acknowledgments retrieved from the approved receiver. No receiver files were deleted.`); })}>Retrieve receiver ACK</button>
    </>}
    {result && <p role="status">{result}</p>}
  </section>;
}
