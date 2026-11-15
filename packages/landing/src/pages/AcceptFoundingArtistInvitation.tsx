import { useState } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { getStudioUrl } from '../lib/auth';
import {
  acceptFoundingArtistInvitation,
  beginFoundingArtistInvitationVerification,
  completeFoundingArtistInvitationVerification,
  getStoredInvitationEmail,
  isCompletingFoundingArtistLink,
} from '../lib/foundingArtistWaitlist';

export default function AcceptFoundingArtistInvitation() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState(getStoredInvitationEmail);
  const [completing, setCompleting] = useState(isCompletingFoundingArtistLink);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (completing) {
        await completeFoundingArtistInvitationVerification(email);
        window.history.replaceState({}, '', '/accept-invitation');
        setCompleting(false);
      } else {
        await beginFoundingArtistInvitationVerification(email);
        setSent(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify your email. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    setError('');
    try {
      await acceptFoundingArtistInvitation();
      setAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to accept this invitation. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = 'w-full rounded-lg bg-white px-4 py-3 font-semibold text-black disabled:opacity-50';
  return (
    <section className="space-y-5 text-white" aria-labelledby="invitation-title">
      <h1 id="invitation-title" className="text-2xl font-bold">Your Founding Artist invitation</h1>
      {accepted ? <div role="status" className="space-y-4">
        <p>Your invitation is accepted. Welcome to the Founding Artist Beta.</p>
        <a className={buttonStyle + ' block text-center'} href={getStudioUrl()}>Open Studio</a>
      </div> : loading ? <p role="status">Checking your sign-in…</p> : <>
        {user?.emailVerified && !completing ? <>
          <p>Accept beta access for {user.email}.</p>
          <button className={buttonStyle} disabled={busy} onClick={accept}>{busy ? 'Accepting…' : 'Accept invitation'}</button>
        </> : <p>Verify the email address that received your invitation to continue.</p>}
        <details open={!user?.emailVerified || completing}>
          {user?.emailVerified && !completing && <summary className="cursor-pointer">Use another invitation email</summary>}
          <form onSubmit={verify} className="space-y-4">
            <label className="block">Invitation email
              <input type="email" autoComplete="email" required value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setSent(false); }} className="mt-2 w-full rounded-lg border border-white/30 bg-black p-3" />
            </label>
            <button className={buttonStyle} disabled={busy}>{busy ? 'Please wait…' : completing ? 'Verify email' : 'Send sign-in link'}</button>
            {sent && <p role="status">Check your inbox and open the sign-in link to continue.</p>}
            {completing && <button type="button" disabled={busy} className="underline" onClick={() => {
              window.history.replaceState({}, '', '/accept-invitation');
              setCompleting(false);
              setError('');
            }}>Request a new sign-in link</button>}
          </form>
        </details>
      </>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
