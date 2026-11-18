/**
 * `/n/:hook` — shareable "Now what?" entry link.
 *
 * `shareMeta` serves hook-specific og:/twitter: tags and preview image for
 * unfurlers; in the browser, visitors land straight in the Artist Passport
 * with the matching entry situation pre-selected and UTM attribution attached.
 */
import { Navigate, useParams } from 'react-router-dom';
import { findNowWhatHook, nowWhatPassportPath } from '@shared/share/nowWhat';

export default function NowWhatShareRedirect() {
  const { hook } = useParams<{ hook: string }>();
  const match = findNowWhatHook(hook);
  return <Navigate to={match ? nowWhatPassportPath(match) : '/#now-what'} replace />;
}
