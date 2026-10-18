import { RightsDepositSelectionSchema, RightsBrowserDialogSchema, type RightsBrowserDialog, type RightsDepositSelection } from '@indii/shared';
import React, { useEffect, useRef, useState } from 'react';
import { HostedRightsConnection, rightsOperation } from '@/services/rights/HostedRightsService';

export function HostedRightsViewport({ sessionId }: { sessionId: string }) {
  const connection = useRef<HostedRightsConnection>();
  const frameUrl = useRef<string>();
  const [frame, setFrame] = useState('');
  const [status, setStatus] = useState<Record<string, unknown>>({ control: 'none', state: 'connecting' });
  const [browserDialog, setBrowserDialog] = useState<RightsBrowserDialog>();
  const [promptText, setPromptText] = useState('');
  const [depositPicker, setDepositPicker] = useState<RightsDepositSelection>();
  const [depositIds, setDepositIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const live = new HostedRightsConnection(sessionId, event => {
      if (event.type === 'status') { setStatus(prev => ({ ...prev, ...event })); if (event.control !== 'human') setDepositPicker(undefined); }
      if (event.type === 'browser_dialog') { const dialog = RightsBrowserDialogSchema.safeParse(event); if (dialog.success) { setBrowserDialog(dialog.data); setPromptText(''); } }
      if (event.type === 'browser_dialog_closed') { setBrowserDialog(previous => previous?.requestId === event.requestId ? undefined : previous); setPromptText(''); }
      if (event.type === 'deposit_request') { const request = RightsDepositSelectionSchema.safeParse(event); if (request.success) { setDepositPicker(request.data); setDepositIds([]); } }
      if (event.type === 'action_result') { if (event.success === true) setDepositPicker(undefined); else setError('The selected deposits could not be attached. Reopen the official upload picker to try again.'); }
      if (event.type === 'navigation') { setStatus(prev => ({ ...prev, control: 'none' })); setDepositPicker(undefined); }
      if (event.type === 'error') setError(String(event.message ?? 'The session operation could not be completed.'));
    }, blob => { if (frameUrl.current) URL.revokeObjectURL(frameUrl.current); const url = URL.createObjectURL(blob); frameUrl.current = url; setFrame(url); });
    connection.current = live; void live.connect();
    return () => { live.close(); if (frameUrl.current) URL.revokeObjectURL(frameUrl.current); };
  }, [sessionId]);
  const control = async (action: string) => {
    setError(''); setStatus(prev => ({ ...prev, control: 'none' }));
    try { await rightsOperation(action, { sessionId }); } catch (e) { setError(e instanceof Error ? e.message : 'Control transfer failed.'); }
  };
  const coordinates = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  };
  return <section className="space-y-3" aria-label="Hosted copyright portal">
    <p className="text-sm">Session: {String(status.state)} · Control: {String(status.control)}{status.expiresAtMs ? ' · Ends ' + new Date(Number(status.expiresAtMs)).toLocaleTimeString() : ''}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void control('take_control')}>Take control</button>
      <button type="button" onClick={() => void control('return_control')}>Return control to assistant</button>
      <button type="button" onClick={() => void control('end_session')}>End session</button>
    </div>
    <div className="flex gap-2 flex-wrap"><button type="button" disabled={status.control !== 'agent'} onClick={() => void rightsOperation('execute_action', { sessionId, actionId: 'open_application' }).catch(e => setError(e instanceof Error ? e.message : 'Application navigation failed.'))}>Open selected application instructions</button><button type="button" disabled={status.control !== 'agent'} onClick={() => void rightsOperation('execute_action', { sessionId, actionId: 'fill_title' }).catch(e => setError(e instanceof Error ? e.message : 'Title preparation failed.'))}>Fill title</button><button type="button" disabled={status.control !== 'agent'} onClick={() => void rightsOperation('execute_action', { sessionId, actionId: 'fill_year' }).catch(e => setError(e instanceof Error ? e.message : 'Year preparation failed.'))}>Fill completion year</button></div>
    {status.paymentEnabled === false && <p className="text-amber-300 text-sm">Hosted payment is not enabled. Complete preparation only; no payment was made.</p>}
    <p className="text-xs text-gray-400">You control sign-in, MFA, certification, payment, and submission. Hosted input passes through indii infrastructure. This session is not recorded.</p>
    <div role="application" aria-label="Remote portal controls" tabIndex={0} className="relative w-full aspect-[4/3] border border-white/20 rounded bg-black outline-amber-400"
      onPointerDown={e => { e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); connection.current?.input({ type: 'pointer', action: 'down', button: e.button === 2 ? 'right' : 'left', ...coordinates(e) }); }}
      onPointerUp={e => connection.current?.input({ type: 'pointer', action: 'up', button: e.button === 2 ? 'right' : 'left', ...coordinates(e) })}
      onPointerMove={e => connection.current?.input({ type: 'pointer', action: 'move', button: 'left', ...coordinates(e) })}
      onWheel={e => { const r = e.currentTarget.getBoundingClientRect(); connection.current?.input({ type: 'scroll', deltaX: Math.max(-2000, Math.min(2000, e.deltaX)), deltaY: Math.max(-2000, Math.min(2000, e.deltaY)), x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }}
      onKeyDown={e => { if (status.control !== 'human') return; e.preventDefault(); connection.current?.input(e.key.length === 1 && !e.ctrlKey && !e.metaKey ? { type: 'text', text: e.key } : { type: 'key', key: e.key, action: 'down' }); }}
      onKeyUp={e => { if (e.key.length !== 1) connection.current?.input({ type: 'key', key: e.key, action: 'up' }); }}>
      {frame ? <img src={frame} alt="Live official copyright portal" draggable={false} className="w-full h-full pointer-events-none select-none" /> : <p className="p-4">Waiting for the browser…</p>}
    </div>
    {browserDialog && <section role="group" aria-label="Official portal dialog controls" className="border border-amber-400 rounded p-4 space-y-3"><h3>Official portal {browserDialog.kind === 'alert' ? 'notice' : 'confirmation'}</h3><p className="whitespace-pre-wrap">{browserDialog.message}</p>{status.control !== 'human' && <p>Take control to answer this portal dialog.</p>}{browserDialog.kind === 'prompt' && <label>Response<input type="password" autoComplete="off" maxLength={500} value={promptText} onChange={e => setPromptText(e.target.value)} className="bg-black/30 border rounded p-2" /></label>}<button type="button" disabled={status.control !== 'human'} onClick={() => connection.current?.input({ type: 'dialog', requestId: browserDialog.requestId, accept: true, ...(browserDialog.kind === 'prompt' ? { text: promptText } : {}) })}>{browserDialog.kind === 'alert' ? 'Acknowledge notice' : 'Accept in official portal'}</button>{browserDialog.kind !== 'alert' && <button type="button" disabled={status.control !== 'human'} onClick={() => connection.current?.input({ type: 'dialog', requestId: browserDialog.requestId, accept: false })}>Cancel in official portal</button>}</section>}
    {depositPicker && status.control === 'human' && <fieldset className="border border-white/20 p-3 space-y-2"><legend>Choose deposits for the official upload field</legend><p className="text-sm">{depositPicker.multiple ? 'Choose the works requested by this application section.' : 'This field accepts one file.'}</p>{depositPicker.choices.map(choice => <label key={choice.id} className="block"><input type={depositPicker.multiple ? 'checkbox' : 'radio'} name="rights-deposit" checked={depositIds.includes(choice.id)} onChange={e => setDepositIds(previous => depositPicker.multiple ? e.target.checked ? [...previous, choice.id] : previous.filter(id => id !== choice.id) : [choice.id])} /> {choice.label}</label>)}<button type="button" disabled={!depositIds.length} onClick={() => { void rightsOperation('select_deposits', { sessionId, requestId: depositPicker.requestId, workIds: depositIds }).catch(e => setError(e instanceof Error ? e.message : 'Deposit selection failed.')); }}>Attach selected deposits</button></fieldset>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
  </section>;
}
