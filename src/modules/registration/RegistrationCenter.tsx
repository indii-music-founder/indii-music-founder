import React, { useEffect, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { CatalogRail } from './components/CatalogRail';
import { RegistrationSheet } from './components/RegistrationSheet';
import { RegistrationAIRail } from './components/RegistrationAIRail';
import { ORG_ADAPTERS } from './adapters';
import type { CatalogTrack, OrgId, SubmissionResult } from './types';
import { logger } from '@/utils/logger';

// ============================================================================
// Catalog loader — pulls tracks from existing distribution/project store
// ============================================================================

async function loadCatalogTracks(userId: string): Promise<CatalogTrack[]> {
  try {
    const { db } = await import('@/services/firebase');
    const { collection, getDocs, query, where } = await import('firebase/firestore');

    const tracksRef = collection(db, `users/${userId}/tracks`);
    const snap = await getDocs(query(tracksRef, where('deleted', '!=', true)));

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
        yearOfCreation: d.yearOfCreation ?? (d.releaseDate ? new Date(d.releaseDate).getFullYear().toString() : new Date().getFullYear().toString()),
        copyrightClaimant: d.copyrightClaimant ?? d.artistName ?? d.artist,
        workForHire: d.workForHire ?? false,
        countryOfFirstPublication: d.countryOfFirstPublication ?? 'United States',
        publisherName: d.publisherName,
        publisherNumber: d.publisherNumber,
      } as CatalogTrack;
    });
  } catch (err) {
    logger.warn('[RegistrationCenter] Could not load tracks from Firestore, using demo data:', err);
    // Demo data for development / web sessions without Firestore
    return [
      {
        id: 'demo-track-1',
        title: 'Demo Track (Add your catalog)',
        artistName: 'Your Artist Name',
        writersAndContributors: [{ name: 'Your Name', role: 'Composer/Lyricist', percentage: 100 }],
        isPublished: false,
        yearOfCreation: new Date().getFullYear().toString(),
        copyrightClaimant: 'Your Legal Name',
        workForHire: false,
        countryOfFirstPublication: 'United States',
      },
    ];
  }
}

async function loadRegistrationStates(userId: string, trackIds: string[]) {
  const states: Record<string, import('./types').TrackRegistrationState> = {};
  try {
    const { db } = await import('@/services/firebase');
    const { collection, getDocs } = await import('firebase/firestore');

    for (const trackId of trackIds) {
      const orgsRef = collection(db, `registrations/${userId}/tracks/${trackId}/orgs`);
      const snap = await getDocs(orgsRef);
      if (!snap.empty) {
        const orgs: import('./types').TrackRegistrationState['orgs'] = {};
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
        const total = snap.docs.length || 1;
        states[trackId] = {
          trackId,
          orgs,
          completenessScore: Math.round((confirmed / total) * 100),
        };
      }
    }
  } catch (err) {
    logger.warn('[RegistrationCenter] Could not load registration states:', err);
  }
  return states;
}

// ============================================================================
// Main Component
// ============================================================================

export default function RegistrationCenter() {
  const { user, registrationFocus, setRegistrationFocus, registrationStates, setTrackRegistrationState, updateOrgRecord } = useStore(
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

  // Derive selected track from focus
  const selectedTrack = registrationFocus.trackId
    ? tracks.find(t => t.id === registrationFocus.trackId) ?? null
    : tracks[0] ?? null;

  const focusedOrgId = registrationFocus.orgId;
  const focusedAdapter = focusedOrgId ? ORG_ADAPTERS[focusedOrgId] : null;

  // Load catalog
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    loadCatalogTracks(user.uid).then(async (loaded) => {
      setTracks(loaded);
      // Auto-select first track if nothing focused
      if (!registrationFocus.trackId && loaded[0]) {
        setRegistrationFocus({ ...registrationFocus, trackId: loaded[0].id });
      }
      // Load registration states for all tracks
      const states = await loadRegistrationStates(user.uid!, loaded.map(t => t.id));
      Object.entries(states).forEach(([trackId, state]) => {
        setTrackRegistrationState(trackId, state);
      });
      setLoading(false);
    });
  }, [user?.uid]);

  const handleSelectTrack = useCallback((trackId: string) => {
    setRegistrationFocus({ trackId, orgId: null });
  }, [setRegistrationFocus]);

  const handleSelectOrg = useCallback((orgId: OrgId) => {
    setRegistrationFocus(prev => ({ ...prev, orgId }));
  }, [setRegistrationFocus]);

  const handleSubmitComplete = useCallback((orgId: OrgId, result: SubmissionResult) => {
    const trackId = registrationFocus.trackId;
    if (!trackId || !user?.uid) return;

    updateOrgRecord(trackId, orgId, {
      orgId,
      status: result.success ? 'submitted' : result.requiresManualStep ? 'in_progress' : 'error',
      submittedAt: result.submittedAt,
      confirmationNumber: result.confirmationNumber,
      errorMessage: result.errorMessage,
      lastUpdated: new Date(),
    });
  }, [registrationFocus.trackId, user?.uid, updateOrgRecord]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Loading your catalog…
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
