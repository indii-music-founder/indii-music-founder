import React, { useEffect, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { CatalogRail } from './components/CatalogRail';
import { RegistrationSheet } from './components/RegistrationSheet';
import { RegistrationAIRail } from './components/RegistrationAIRail';
import { ORG_ADAPTERS } from './adapters';
import type { CatalogTrack, OrgId, SubmissionResult, TrackRegistrationState, OrgRegistrationRecord } from './types';
import { logger } from '@/utils/logger';

// ============================================================================
// Data loaders (module-level, not component-level)
// ============================================================================

async function loadCatalogTracks(userId: string): Promise<CatalogTrack[]> {
  const { db } = await import('@/services/firebase');
  const { collection, getDocs, query, where } = await import('firebase/firestore');

  const snap = await getDocs(
    query(collection(db, `users/${userId}/tracks`), where('deleted', '!=', true))
  );

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title ?? 'Untitled',
      artistName: d.artistName ?? d.artist ?? '',
      writersAndContributors: d.writersAndContributors ?? d.contributors ?? [],
      isrc: d.isrc,
      iswc: d.iswc,
      releaseDate: d.releaseDate,
      genre: d.genre,
      duration: d.duration,
      bpm: d.bpm,
      musicalKey: d.key ?? d.musicalKey,
      isPublished: d.isPublished ?? Boolean(d.releaseDate),
      yearOfCreation: d.yearOfCreation ?? new Date().getFullYear().toString(),
      copyrightClaimant: d.copyrightClaimant ?? d.artistName ?? d.artist,
      workForHire: d.workForHire ?? false,
      countryOfFirstPublication: d.countryOfFirstPublication ?? 'United States',
      publisherName: d.publisherName,
      publisherNumber: d.publisherNumber,
    } as CatalogTrack;
  });
}

async function loadRegistrationStates(
  userId: string,
  trackIds: string[]
): Promise<Record<string, TrackRegistrationState>> {
  if (trackIds.length === 0) return {};

  const { db } = await import('@/services/firebase');
  const { collection, getDocs } = await import('firebase/firestore');

  // Fetch all tracks in parallel — no N+1
  const results = await Promise.all(
    trackIds.map(trackId =>
      getDocs(collection(db, `registrations/${userId}/tracks/${trackId}/orgs`))
        .then(snap => ({ trackId, snap }))
    )
  );

  const states: Record<string, TrackRegistrationState> = {};
  for (const { trackId, snap } of results) {
    if (snap.empty) continue;
    const orgs: TrackRegistrationState['orgs'] = {};
    let confirmed = 0;
    snap.docs.forEach(doc => {
      const d = doc.data();
      const orgId = doc.id as OrgId;
      orgs[orgId] = {
        orgId,
        status: d.status,
        submittedAt: d.submittedAt?.toDate(),
        confirmedAt: d.confirmedAt?.toDate(),
        confirmationNumber: d.confirmationNumber,
        formSnapshot: d.formSnapshot,
        errorMessage: d.errorMessage,
        lastUpdated: d.lastUpdated?.toDate() ?? new Date(),
      };
      if (d.status === 'confirmed') confirmed++;
    });
    states[trackId] = {
      trackId,
      orgs,
      completenessScore: Math.round((confirmed / snap.docs.length) * 100),
    };
  }
  return states;
}

// ============================================================================
// Main Component
// ============================================================================

export default function RegistrationCenter() {
  const {
    user,
    registrationFocus,
    setRegistrationFocus,
    registrationStates,
    setTrackRegistrationState,
    updateOrgRecord,
  } = useStore(
    useShallow(s => ({
      user: s.user,
      registrationFocus: s.registrationFocus,
      setRegistrationFocus: s.setRegistrationFocus,
      registrationStates: s.registrationStates,
      setTrackRegistrationState: s.setTrackRegistrationState,
      updateOrgRecord: s.updateOrgRecord,
    }))
  );

  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedTrack = registrationFocus.trackId
    ? (tracks.find(t => t.id === registrationFocus.trackId) ?? tracks[0] ?? null)
    : (tracks[0] ?? null);

  const focusedOrgId = registrationFocus.orgId;
  const focusedAdapter = focusedOrgId ? ORG_ADAPTERS[focusedOrgId] : null;

  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    setLoading(true);
    setLoadError(null);

    // Load catalog and registration states in parallel
    Promise.all([loadCatalogTracks(uid), null] as const)
      .then(async ([loaded]) => {
        setTracks(loaded);
        if (!registrationFocus.trackId && loaded[0]) {
          setRegistrationFocus({ orgId: registrationFocus.orgId, trackId: loaded[0].id });
        }
        const states = await loadRegistrationStates(uid, loaded.map(t => t.id));
        Object.entries(states).forEach(([trackId, state]) => {
          setTrackRegistrationState(trackId, state);
        });
      })
      .catch(err => {
        logger.error('[RegistrationCenter] Failed to load catalog:', err);
        setLoadError('Failed to load your catalog. Check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectTrack = useCallback((trackId: string) => {
    setRegistrationFocus({ trackId, orgId: null });
  }, [setRegistrationFocus]);

  const handleSelectOrg = useCallback((orgId: OrgId) => {
    setRegistrationFocus({ trackId: registrationFocus.trackId, orgId });
  }, [setRegistrationFocus, registrationFocus.trackId]);

  const handleSubmitComplete = useCallback((orgId: OrgId, result: SubmissionResult) => {
    const trackId = selectedTrack?.id;
    if (!trackId) return;
    const record: OrgRegistrationRecord = {
      orgId,
      status: result.success ? 'submitted' : result.requiresManualStep ? 'in_progress' : 'error',
      submittedAt: result.submittedAt,
      confirmationNumber: result.confirmationNumber,
      errorMessage: result.errorMessage,
      lastUpdated: new Date(),
    };
    updateOrgRecord(trackId, orgId, record);
  }, [selectedTrack?.id, updateOrgRecord]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Loading your catalog…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-sm px-8 text-center">
        <span className="text-red-400">{loadError}</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-purple-400 hover:text-purple-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 text-sm px-8 text-center">
        <p>No tracks found in your catalog.</p>
        <p className="text-xs text-gray-600">Add tracks via the Distribution module, then return here to register them.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left: Catalog Rail */}
      <div className="w-52 flex-shrink-0 border-r border-white/[0.05] bg-white/[0.01]">
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <h1 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Registration Center</h1>
        </div>
        <CatalogRail
          tracks={tracks}
          selectedTrackId={selectedTrack?.id ?? null}
          registrationStates={registrationStates}
          onSelectTrack={handleSelectTrack}
        />
      </div>

      {/* Center: Registration Sheet */}
      <div className="flex-1 min-w-0 border-r border-white/[0.05]">
        <RegistrationSheet
          track={selectedTrack}
          focusedOrgId={focusedOrgId}
          registrationState={selectedTrack ? (registrationStates[selectedTrack.id] ?? null) : null}
          userId={user?.uid ?? ''}
          onOrgSelect={handleSelectOrg}
          onSubmitComplete={handleSubmitComplete}
        />
      </div>

      {/* Right: AI Co-Pilot Rail */}
      <div className="w-72 flex-shrink-0">
        <RegistrationAIRail
          focusedAdapter={focusedAdapter}
          track={selectedTrack}
        />
      </div>
    </div>
  );
}
