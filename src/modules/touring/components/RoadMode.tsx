import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Mic,
    MicOff,
    Fuel,
    UtensilsCrossed,
    Bath,
    RefreshCw,
    Hotel,
    ShieldAlert,
    Navigation,
    MapPin,
    Clock,
    ChevronUp,
    Send,
    Loader2,
    Star,
    ExternalLink,
    X,
    ArrowLeft,
} from 'lucide-react';
import { useVoice } from '@/core/context/VoiceContext';
import { useTouring } from '../hooks/useTouring';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { agentService } from '@/services/agent/AgentService';
import { searchNearbyPlaces, navigateToPlace, type NearbyPlace, type NearbySearchResult } from '@/services/places/NearbyPlacesService';
import { logger } from '@/utils/logger';

// ============================================================================
// RoadMode — Phone-optimized voice-first road interface
// ============================================================================
// Replaces the full desktop Road Manager on phone viewports.
// Three zones: Status Strip → Quick Actions → Voice Command Bar
// Quick actions for search-type queries (gas, food, lodging, etc.) use the
// Google Places API directly for instant results — no agent conversation needed.

interface QuickAction {
    id: string;
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
    prompt: string;
    /** If true, this action queries Google Places API directly instead of the agent */
    usePlacesAPI: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        id: 'restroom',
        icon: Bath,
        label: 'Restroom',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/15 border-blue-500/20',
        prompt: 'Find me the nearest clean restroom or bathroom. I need one right now. Use my current GPS location.',
        usePlacesAPI: true,
    },
    {
        id: 'gas',
        icon: Fuel,
        label: 'Gas',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/15 border-orange-500/20',
        prompt: 'Find the nearest gas station close to my current location. Show me which ones are open right now with their prices if possible.',
        usePlacesAPI: true,
    },
    {
        id: 'food',
        icon: UtensilsCrossed,
        label: 'Food',
        color: 'text-green-400',
        bgColor: 'bg-green-500/15 border-green-500/20',
        prompt: 'Find me somewhere good to eat nearby. Show me options — fast food, sit-down, whatever is close and open right now.',
        usePlacesAPI: true,
    },
    {
        id: 'reroute',
        icon: RefreshCw,
        label: 'Reroute',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/15 border-purple-500/20',
        prompt: 'I need to change my route. Check for traffic issues or road closures on my current path and suggest an alternative route to my next destination.',
        usePlacesAPI: false, // Conversational — needs the agent
    },
    {
        id: 'lodging',
        icon: Hotel,
        label: 'Lodging',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/15 border-cyan-500/20',
        prompt: 'Find me a place to stay tonight. Show me hotels or motels near my current location with availability and prices. Budget-friendly options preferred.',
        usePlacesAPI: true,
    },
    {
        id: 'emergency',
        icon: ShieldAlert,
        label: 'Emergency',
        color: 'text-red-400',
        bgColor: 'bg-red-500/15 border-red-500/20',
        prompt: 'I need emergency assistance. Please identify the nearest hospital, police station, and emergency services from my current location. Also show me my current coordinates.',
        usePlacesAPI: true,
    },
];

// ============================================================================
// NearbyResultsView — Inline results card for Places API responses
// ============================================================================

interface NearbyResultsViewProps {
    results: NearbySearchResult;
    action: QuickAction;
    onClose: () => void;
    onNavigate: (place: NearbyPlace) => void;
}

const NearbyResultsView: React.FC<NearbyResultsViewProps> = ({ results, action, onClose, onNavigate }) => {
    const ActionIcon = action.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 overflow-y-auto px-4 py-4"
        >
            {/* Header — back button + title */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={16} />
                </button>
                <ActionIcon size={18} className={action.color} />
                <span className="text-sm font-bold text-white">{action.label} Nearby</span>
                <span className="text-[10px] text-slate-500 font-mono ml-auto">
                    {results.places.length} found
                </span>
            </div>

            {results.places.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    <MapPin size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No {action.label.toLowerCase()} found nearby.</p>
                    <p className="text-xs mt-1">Try widening your search area.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {results.places.map((place, idx) => (
                        <motion.button
                            key={place.placeId || idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => onNavigate(place)}
                            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all text-left active:scale-[0.98]"
                        >
                            {/* Rank badge */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${idx === 0
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-white/5 text-slate-500'
                                }`}>
                                {idx + 1}
                            </div>

                            {/* Place info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white truncate">
                                    {place.name}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                    {place.address}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                    {/* Rating */}
                                    {place.rating !== null && (
                                        <div className="flex items-center gap-1 text-xs">
                                            <Star size={10} className="text-amber-400 fill-amber-400" />
                                            <span className="text-amber-400 font-mono">{place.rating.toFixed(1)}</span>
                                            {place.totalRatings > 0 && (
                                                <span className="text-slate-600">({place.totalRatings})</span>
                                            )}
                                        </div>
                                    )}
                                    {/* Open/Closed */}
                                    {place.isOpen !== null && (
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${place.isOpen ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            {place.isOpen ? 'Open' : 'Closed'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Distance + navigate */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-xs font-mono text-slate-400">
                                    {place.distanceText}
                                </span>
                                <ExternalLink size={14} className="text-slate-600" />
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}

            {/* GPS context */}
            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-600 font-mono justify-center">
                <MapPin size={8} />
                <span>Searched near {results.locationText}</span>
            </div>
        </motion.div>
    );
};

// ============================================================================
// RoadMode Main Component
// ============================================================================

export const RoadMode: React.FC = () => {
    const { isListening, toggleListening, transcript } = useVoice();
    const { currentItinerary: itinerary } = useTouring();
    const { isAgentOpen, toggleAgentWindow } = useStore(
        useShallow(s => ({
            isAgentOpen: s.isAgentOpen,
            toggleAgentWindow: s.toggleAgentWindow,
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [manualInput, setManualInput] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [currentLocationText, setCurrentLocationText] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<NearbySearchResult | null>(null);
    const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Grab GPS on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCurrentLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    });
                    setCurrentLocationText(
                        `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
                    );
                },
                () => {
                    logger.warn('[RoadMode] Geolocation unavailable');
                }
            );
        }
    }, []);

    // Find next stop from itinerary
    const today = new Date();
    const nextStop = itinerary?.stops.find(
        (s) => new Date(s.date) >= today
    ) || itinerary?.stops[0];

    // Submit a prompt to the agent — forces native orchestrator mode for tool access
    const handleSubmitPrompt = useCallback(async (prompt: string) => {
        if (!prompt.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Add location context to the prompt
            const locationContext = currentLocationText
                ? `\n\n[Current GPS: ${currentLocationText}]`
                : '';

            const fullPrompt = prompt + locationContext;

            // Force native agent provider so quick actions use full orchestration
            // (not Direct LLM which has no tool access)
            const previousProvider = useStore.getState().activeAgentProvider;
            if (previousProvider === 'direct') {
                useStore.setState({ activeAgentProvider: 'native' });
            }

            // Open the agent chat panel so the response is visible
            if (!isAgentOpen) {
                toggleAgentWindow();
            }

            // Clear any lingering text in the command bar
            useStore.setState({ commandBarInput: '' });

            // Submit directly to agent service
            await agentService.sendMessage(fullPrompt);

            // Restore previous provider so user's preference is preserved
            if (previousProvider === 'direct') {
                useStore.setState({ activeAgentProvider: previousProvider });
            }
        } catch (error: unknown) {
            logger.error('[RoadMode] Failed to submit prompt:', error);
        } finally {
            setIsSubmitting(false);
        }
    }, [currentLocationText, isSubmitting, isAgentOpen, toggleAgentWindow]);

    // Handle quick action tap — either Places API or Agent
    const handleQuickAction = async (action: QuickAction) => {
        setLastAction(action.id);
        setSearchError(null);

        if (action.usePlacesAPI && currentLocation) {
            // Direct Places API — instant results, no agent
            setIsSubmitting(true);
            try {
                const results = await searchNearbyPlaces(
                    action.id,
                    currentLocation.lat,
                    currentLocation.lng
                );
                setSearchResults(results);
                setActiveAction(action);
            } catch (error: unknown) {
                logger.error('[RoadMode] Places search failed:', error);
                setSearchError(error instanceof Error ? error.message : 'Search failed');
                // Fallback to agent if Places API fails
                handleSubmitPrompt(action.prompt);
            } finally {
                setIsSubmitting(false);
            }
        } else if (action.usePlacesAPI && !currentLocation) {
            // No GPS — fall back to agent with a note
            setSearchError('GPS unavailable — using agent instead');
            handleSubmitPrompt(action.prompt);
        } else {
            // Conversational action (e.g., reroute) — use the agent
            handleSubmitPrompt(action.prompt);
        }
    };

    // Handle closing results view
    const handleCloseResults = () => {
        setSearchResults(null);
        setActiveAction(null);
        setLastAction(null);
    };

    // Handle navigating to a place
    const handleNavigate = (place: NearbyPlace) => {
        navigateToPlace(place);
    };

    // Handle voice transcript submission
    useEffect(() => {
        if (transcript && !isListening && transcript.length > 5) {
            handleSubmitPrompt(transcript);
        }
    }, [transcript, isListening, handleSubmitPrompt]);

    // Handle manual text submission
    const handleManualSubmit = () => {
        if (manualInput.trim()) {
            handleSubmitPrompt(manualInput);
            setManualInput('');
            setShowInput(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Status Strip — Next stop, ETA, location                     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="flex-shrink-0 bg-[#161b22] border-b border-white/5 px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Next destination */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Navigation size={16} className="text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-slate-500 font-mono uppercase tracking-widest">
                                Next Stop
                            </div>
                            <div className="text-sm font-bold text-white truncate">
                                {nextStop?.city || 'No itinerary active'}
                            </div>
                        </div>
                    </div>

                    {/* ETA / Date */}
                    {nextStop && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                            <Clock size={12} />
                            <span className="font-mono">
                                {new Date(nextStop.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                        </div>
                    )}
                </div>

                {/* GPS coordinates */}
                {currentLocationText && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 font-mono">
                        <MapPin size={10} />
                        <span>GPS: {currentLocationText}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Content — Either Quick Actions Grid or Search Results       */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <AnimatePresence mode="wait">
                {searchResults && activeAction ? (
                    <NearbyResultsView
                        key="results"
                        results={searchResults}
                        action={activeAction}
                        onClose={handleCloseResults}
                        onNavigate={handleNavigate}
                    />
                ) : (
                    <motion.div
                        key="actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 overflow-y-auto px-4 py-5"
                    >
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-3 px-1">
                            Quick Actions
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {QUICK_ACTIONS.map((action) => (
                                <motion.button
                                    key={action.id}
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => handleQuickAction(action)}
                                    disabled={isSubmitting && lastAction === action.id}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all active:shadow-lg ${action.bgColor} ${isSubmitting && lastAction === action.id
                                            ? 'opacity-50'
                                            : ''
                                        }`}
                                >
                                    {isSubmitting && lastAction === action.id ? (
                                        <Loader2 size={24} className={`${action.color} animate-spin`} />
                                    ) : (
                                        <action.icon size={24} className={action.color} />
                                    )}
                                    <span className="text-[11px] font-semibold text-white/80">
                                        {action.label}
                                    </span>
                                </motion.button>
                            ))}
                        </div>

                        {/* Error toast */}
                        {searchError && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2"
                            >
                                <ShieldAlert size={14} />
                                <span>{searchError}</span>
                                <button onClick={() => setSearchError(null)} className="ml-auto">
                                    <X size={12} />
                                </button>
                            </motion.div>
                        )}

                        {/* Venue quick-info — if we have an itinerary with venue */}
                        {nextStop?.venue && (
                            <div className="mt-5 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-2">
                                    Venue
                                </div>
                                <div className="text-sm font-semibold text-white">{nextStop.venue}</div>
                                <div className="text-xs text-slate-400 mt-1">{nextStop.city}</div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Voice Command Bar — Push-to-talk mic + text fallback         */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="flex-shrink-0 bg-[#161b22] border-t border-white/5 px-4 pt-4 pb-safe-bottom">
                {/* Expandable text input */}
                <AnimatePresence>
                    {showInput && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-3"
                        >
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                                    placeholder="Tell your agent what you need..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    autoFocus
                                />
                                <button
                                    onClick={handleManualSubmit}
                                    disabled={!manualInput.trim()}
                                    className="p-3 bg-indigo-500 rounded-xl text-white disabled:opacity-30 transition-opacity"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-center gap-4">
                    {/* Type toggle */}
                    <button
                        onClick={() => {
                            setShowInput(!showInput);
                            if (!showInput) {
                                setTimeout(() => inputRef.current?.focus(), 100);
                            }
                        }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronUp
                            size={18}
                            className={`transition-transform ${showInput ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Main mic button */}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleListening}
                        className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all ${isListening
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {isListening ? (
                            <>
                                <MicOff size={20} />
                                <span>Listening...</span>
                            </>
                        ) : (
                            <>
                                <Mic size={20} />
                                <span>Talk to Agent</span>
                            </>
                        )}
                    </motion.button>
                </div>

                {/* Live transcript */}
                {isListening && transcript && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-3 bg-white/5 rounded-xl text-sm text-slate-300 italic"
                    >
                        "{transcript}"
                    </motion.div>
                )}
            </div>
        </div>
    );
};
