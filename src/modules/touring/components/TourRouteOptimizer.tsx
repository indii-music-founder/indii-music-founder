/**
 * TourRouteOptimizer — Item 131 (PRODUCTION_200)
 * Plots geo-optimized tour routes based on regional Spotify listener density.
 * Greedy nearest-neighbor sort on mock city coordinates + listener weighting.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Music2, Plus, X, ArrowRight, Zap, Users, Clock, Route } from 'lucide-react';

interface City {
    id: string;
    name: string;
    state: string;
    lat: number;
    lng: number;
    listeners: number; // mock Spotify monthly listeners in region
    avgTicketPrice: number;
    venues: number;
}

const CITY_POOL: City[] = [
    { id: 'nyc', name: 'New York', state: 'NY', lat: 40.71, lng: -74.01, listeners: 1240000, avgTicketPrice: 45, venues: 82 },
    { id: 'la', name: 'Los Angeles', state: 'CA', lat: 34.05, lng: -118.24, listeners: 980000, avgTicketPrice: 42, venues: 67 },
    { id: 'chi', name: 'Chicago', state: 'IL', lat: 41.88, lng: -87.63, listeners: 620000, avgTicketPrice: 35, venues: 48 },
    { id: 'hou', name: 'Houston', state: 'TX', lat: 29.76, lng: -95.37, listeners: 490000, avgTicketPrice: 30, venues: 41 },
    { id: 'phi', name: 'Philadelphia', state: 'PA', lat: 39.95, lng: -75.17, listeners: 410000, avgTicketPrice: 33, venues: 35 },
    { id: 'atl', name: 'Atlanta', state: 'GA', lat: 33.75, lng: -84.39, listeners: 560000, avgTicketPrice: 32, venues: 44 },
    { id: 'mia', name: 'Miami', state: 'FL', lat: 25.77, lng: -80.19, listeners: 380000, avgTicketPrice: 38, venues: 29 },
    { id: 'sea', name: 'Seattle', state: 'WA', lat: 47.61, lng: -122.33, listeners: 340000, avgTicketPrice: 36, venues: 31 },
    { id: 'den', name: 'Denver', state: 'CO', lat: 39.74, lng: -104.98, listeners: 280000, avgTicketPrice: 31, venues: 26 },
    { id: 'aus', name: 'Austin', state: 'TX', lat: 30.27, lng: -97.74, listeners: 310000, avgTicketPrice: 29, venues: 55 },
    { id: 'nas', name: 'Nashville', state: 'TN', lat: 36.17, lng: -86.78, listeners: 260000, avgTicketPrice: 28, venues: 38 },
    { id: 'det', name: 'Detroit', state: 'MI', lat: 42.33, lng: -83.05, listeners: 230000, avgTicketPrice: 27, venues: 22 },
];

function haversine(a: City, b: City): number {
    const R = 3958.8; // miles
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function optimizeRoute(cities: City[]): City[] {
    if (cities.length <= 2) return [...cities];
    const unvisited = [...cities];
    const route: City[] = [unvisited.splice(0, 1)[0]];
    while (unvisited.length > 0) {
        const last = route[route.length - 1];
        // Score = distance penalized, listener-weighted
        let bestIdx = 0;
        let bestScore = Infinity;
        unvisited.forEach((city, i) => {
            const dist = haversine(last, city);
            const listenerBonus = 1 - city.listeners / 1500000; // closer to 0 → more listeners
            const score = dist * (0.7 + 0.3 * listenerBonus);
            if (score < bestScore) { bestScore = score; bestIdx = i; }
        });
        route.push(unvisited.splice(bestIdx, 1)[0]);
    }
    return route;
}

function driveHours(dist: number): string {
    const h = Math.round(dist / 55); // avg 55 mph
    if (h < 1) return '< 1 hr';
    return `${h} hr${h !== 1 ? 's' : ''}`;
}

function formatListeners(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    return `${Math.round(n / 1000)}K`;
}

export function TourRouteOptimizer() {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['nyc', 'chi', 'atl', 'aus']));
    const [optimized, setOptimized] = useState(false);

    const selected = CITY_POOL.filter(c => selectedIds.has(c.id));
    const available = CITY_POOL.filter(c => !selectedIds.has(c.id));

    const route = useMemo(() => optimized ? optimizeRoute(selected) : selected, [selected, optimized]);

    const totalDistance = useMemo(() => {
        let d = 0;
        for (let i = 0; i < route.length - 1; i++) d += haversine(route[i], route[i + 1]);
        return Math.round(d);
    }, [route]);

    const totalListeners = route.reduce((s, c) => s + c.listeners, 0);
    const estimatedRevenue = route.reduce((s, c) => s + c.avgTicketPrice * Math.round(c.listeners * 0.002), 0);

    const toggleCity = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setOptimized(false);
    };

    return (
        <div className="flex gap-6 h-full">
            {/* Left — city picker */}
            <div className="w-56 flex-shrink-0 space-y-4">
                <div>
                    <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Add Cities</h4>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        {available.map(city => (
                            <button
                                key={city.id}
                                onClick={() => toggleCity(city.id)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/5 transition-all text-left group"
                            >
                                <div>
                                    <div className="text-xs font-bold text-neutral-300 group-hover:text-white">{city.name}</div>
                                    <div className="flex items-center gap-1 text-[9px] text-neutral-600 mt-0.5">
                                        <Users size={8} />
                                        <span>{formatListeners(city.listeners)}</span>
                                    </div>
                                </div>
                                <Plus size={12} className="text-neutral-600 group-hover:text-[#FFE135]" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2 text-[10px]">
                    <div className="text-neutral-500 font-bold uppercase tracking-widest mb-1">Summary</div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Stops</span>
                        <span className="text-white font-bold">{route.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Distance</span>
                        <span className="text-white font-bold">{totalDistance.toLocaleString()} mi</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Reach</span>
                        <span className="text-white font-bold">{formatListeners(totalListeners)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-neutral-600">Est. Revenue</span>
                        <span className="text-[#FFE135] font-bold">${(estimatedRevenue / 1000).toFixed(0)}K</span>
                    </div>
                </div>
            </div>

            {/* Right — route display */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-white">Route Planner</h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                            {optimized ? 'Geo-optimized by listener density' : 'Add cities and optimize'}
                        </p>
                    </div>
                    <button
                        onClick={() => setOptimized(true)}
                        disabled={selected.length < 2}
                        className="flex items-center gap-2 px-4 py-2 bg-[#FFE135] text-black text-xs font-black rounded-xl hover:bg-[#FFD700] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Zap size={13} /> Optimize Route
                    </button>
                </div>

                {/* Route cards */}
                {route.length === 0 ? (
                    <div className="py-16 text-center text-neutral-600 text-sm">
                        Add cities from the left panel to begin.
                    </div>
                ) : (
                    <div className="space-y-2">
                        <AnimatePresence>
                            {route.map((city, idx) => {
                                const nextCity = route[idx + 1];
                                const dist = nextCity ? Math.round(haversine(city, nextCity)) : null;
                                const maxListeners = Math.max(...route.map(c => c.listeners));
                                const barPct = Math.round((city.listeners / maxListeners) * 100);
                                return (
                                    <React.Fragment key={city.id}>
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.2, delay: idx * 0.04 }}
                                            className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all group"
                                        >
                                            {/* Stop number */}
                                            <div className="w-7 h-7 rounded-full bg-[#FFE135]/10 border border-[#FFE135]/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[11px] font-black text-[#FFE135]">{idx + 1}</span>
                                            </div>

                                            {/* City info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-bold text-white">{city.name}</span>
                                                    <span className="text-[10px] text-neutral-500">{city.state}</span>
                                                    <span className="text-[9px] text-neutral-700">· {city.venues} venues</span>
                                                </div>
                                                {/* Listener density bar */}
                                                <div className="flex items-center gap-2">
                                                    <Music2 size={9} className="text-neutral-600 flex-shrink-0" />
                                                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#FFE135] rounded-full"
                                                            style={{ width: `${barPct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-neutral-500 font-mono flex-shrink-0">
                                                        {formatListeners(city.listeners)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Avg ticket */}
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-xs font-bold text-[#FFE135]">${city.avgTicketPrice}</div>
                                                <div className="text-[9px] text-neutral-600">avg ticket</div>
                                            </div>

                                            {/* Remove */}
                                            <button
                                                onClick={() => toggleCity(city.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </motion.div>

                                        {/* Leg connector */}
                                        {dist !== null && (
                                            <div className="flex items-center gap-2 px-4 py-0.5">
                                                <div className="flex-1 h-px bg-white/5" />
                                                <div className="flex items-center gap-1.5 text-[9px] text-neutral-600">
                                                    <Route size={9} />
                                                    <span>{dist.toLocaleString()} mi</span>
                                                    <ArrowRight size={9} />
                                                    <Clock size={9} />
                                                    <span>{driveHours(dist)}</span>
                                                </div>
                                                <div className="flex-1 h-px bg-white/5" />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
