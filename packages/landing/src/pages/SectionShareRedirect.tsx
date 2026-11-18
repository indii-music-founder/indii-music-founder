/**
 * `/s/:section` — shareable section link. The server (shareMeta) gives this
 * URL its own link preview; in the browser it lands on the home page at that
 * section. Unknown sections fall back to the top of the home page.
 */
import { Navigate, useParams } from 'react-router-dom';
import { findSiteSection } from '@shared/share/siteSections';

export default function SectionShareRedirect() {
  const { section } = useParams<{ section: string }>();
  const match = findSiteSection(section);
  return <Navigate to={match ? { pathname: '/', hash: `#${match.id}` } : '/'} replace />;
}
