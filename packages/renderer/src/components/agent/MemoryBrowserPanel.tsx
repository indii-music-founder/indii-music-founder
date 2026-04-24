/**
 * MemoryBrowserPanel Component
 *
 * Displays and searches through agent memories across all 5 layers.
 * Supports filtering by layer, semantic search, and memory visualization.
 */

import React, { useState } from 'react';
import { useMemoryQuery } from '@/hooks/useMemoryQuery';
import { Search, Tag, Clock, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { MemoryLayer, Memory } from '@/services/memory/PersistentMemoryService';

const LAYER_COLORS: Record<MemoryLayer, string> = {
  'scratchpad': 'bg-blue-100 text-blue-800',
  'session': 'bg-green-100 text-green-800',
  'core-vault': 'bg-purple-100 text-purple-800',
  'captain-logs': 'bg-orange-100 text-orange-800',
  'rag-index': 'bg-pink-100 text-pink-800'
};

const LAYER_LABELS: Record<MemoryLayer, string> = {
  'scratchpad': 'Scratchpad',
  'session': 'Session (24h)',
  'core-vault': 'Core Vault',
  'captain-logs': 'Captain\'s Logs',
  'rag-index': 'RAG Index'
};

interface MemoryBrowserPanelProps {
  className?: string;
  onMemorySelect?: (memory: Memory) => void;
}

export const MemoryBrowserPanel: React.FC<MemoryBrowserPanelProps> = ({
  className = '',
  onMemorySelect
}) => {
  const { memories, isLoading, error, query, clearResults } = useMemoryQuery();
  const [searchInput, setSearchInput] = useState('');
  const [selectedLayers, setSelectedLayers] = useState<MemoryLayer[]>([
    'session',
    'core-vault'
  ]);
  const [semanticSearch, setSemanticSearch] = useState(false);

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      clearResults();
      return;
    }

    await query(searchInput, {
      layers: selectedLayers,
      limit: 20,
      semanticSearch
    });
  };

  const handleLayerToggle = (layer: MemoryLayer) => {
    setSelectedLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]
    );
  };

  const sortedMemories = [...memories].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className={clsx('flex flex-col h-full bg-white rounded-lg border border-gray-200', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Memory Browser</h2>

        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Options */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="semantic"
              checked={semanticSearch}
              onChange={(e) => setSemanticSearch(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="semantic" className="text-sm text-gray-700">
              Semantic search
            </label>
          </div>

          {/* Layer Filter */}
          <div className="text-sm font-medium text-gray-700 mb-2">Layers:</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LAYER_LABELS) as MemoryLayer[]).map((layer) => (
              <button
                key={layer}
                onClick={() => handleLayerToggle(layer)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  selectedLayers.includes(layer)
                    ? LAYER_COLORS[layer]
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                )}
              >
                {LAYER_LABELS[layer]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">
            <p className="font-semibold">Error</p>
            <p>{error.message}</p>
          </div>
        )}

        {memories.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">
              {searchInput ? 'No memories found' : 'Search to browse memories'}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-500">Loading memories...</p>
          </div>
        )}

        {/* Memory Cards */}
        <div className="space-y-3">
          {sortedMemories.map((memory) => (
            <div
              key={memory.id}
              onClick={() => onMemorySelect?.(memory)}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{memory.key}</div>
                  <span className={clsx(
                    'inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium',
                    LAYER_COLORS[memory.layer]
                  )}>
                    {LAYER_LABELS[memory.layer]}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(memory.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Tags */}
              {memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {memory.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Value Preview */}
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                {JSON.stringify(memory.value).substring(0, 150)}...
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {memories.length > 0 && (
        <div className="border-t border-gray-200 p-4 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>{memories.length} memories loaded</span>
            <button
              onClick={clearResults}
              className="text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
