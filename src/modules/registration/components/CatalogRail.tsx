import React from 'react';
import { Music2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogTrack, TrackRegistrationState } from '../types';

interface CatalogRailProps {
  tracks: CatalogTrack[];
  selectedTrackId: string | null;
  registrationStates: Record<string, TrackRegistrationState>;
  onSelectTrack: (trackId: string) => void;
}

function completenessColor(score: number): string {
  if (score === 100) return 'bg-green-400';
  if (score >= 50) return 'bg-yellow-400';
  return 'bg-gray-600';
}

function completenessLabel(score: number): string {
  if (score === 100) return 'Full';
  if (score > 0) return `${score}%`;
  return 'None';
}

export function CatalogRail({ tracks, selectedTrackId, registrationStates, onSelectTrack }: CatalogRailProps) {
  const [query, setQuery] = React.useState('');
  const filtered = tracks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-3 border-b border-white/[0.05]">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search catalog…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-white/12"
          />
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs">
            <Music2 size={20} className="mb-2 opacity-30" />
            No tracks found
          </div>
        ) : (
          filtered.map(track => {
            const regState = registrationStates[track.id];
            const score = regState?.completenessScore ?? 0;

            return (
              <button
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors group',
                  selectedTrackId === track.id
                    ? 'bg-purple-500/10 border-r-2 border-purple-500'
                    : 'hover:bg-white/[0.02]'
                )}
              >
                {/* Completeness dot */}
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', completenessColor(score))} />

                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate font-medium leading-tight">{track.title}</div>
                  <div className="text-[11px] text-gray-600 truncate">{track.artistName}</div>
                </div>

                {/* Score badge */}
                <span className={cn(
                  'text-[10px] font-semibold flex-shrink-0',
                  score === 100 ? 'text-green-400' : score > 0 ? 'text-yellow-400' : 'text-gray-600'
                )}>
                  {completenessLabel(score)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer summary */}
      <div className="px-3 py-2 border-t border-white/[0.05]">
        <p className="text-[11px] text-gray-600">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} ·{' '}
          {tracks.filter(t => (registrationStates[t.id]?.completenessScore ?? 0) === 100).length} fully registered
        </p>
      </div>
    </div>
  );
}
