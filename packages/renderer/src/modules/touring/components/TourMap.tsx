import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff } from 'lucide-react';
import type { MapMarker } from '../types';

interface TourMapProps {
    locations?: string[];
    markers?: MapMarker[];
    center?: { lat: number; lng: number } | string;
    currentLocation?: { lat: number; lng: number } | string;
    rangeRadiusMiles?: number;
}

type LatLngLiteral = google.maps.LatLngLiteral;
type PointLike = LatLngLiteral | string | null | undefined;

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#101318' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#101318' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8b949e' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1720' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1b2330' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2b3443' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#233042' }] },
];

let googleMapsScriptPromise: Promise<void> | null = null;

function parseLatLngString(value: string): LatLngLiteral | null {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function toLatLngLiteral(input: PointLike): LatLngLiteral | null {
    if (!input) return null;
    if (typeof input === 'string') return parseLatLngString(input);
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return null;
    return { lat: input.lat, lng: input.lng };
}

async function loadGoogleMapsScript(apiKey: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (window.google?.maps) return;
    if (googleMapsScriptPromise) return googleMapsScriptPromise;

    googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('tour-map-google-maps-js') as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = 'tour-map-google-maps-js';
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps script.'));
        document.head.appendChild(script);
    });

    return googleMapsScriptPromise;
}

async function resolvePoint(input: PointLike, geocoder: google.maps.Geocoder): Promise<LatLngLiteral | null> {
    const direct = toLatLngLiteral(input);
    if (direct) return direct;
    if (typeof input !== 'string') return null;
    try {
        const { results } = await geocoder.geocode({ address: input });
        return results[0]?.geometry.location.toJSON() ?? null;
    } catch {
        return null;
    }
}

export const TourMap: React.FC<TourMapProps> = ({
    locations = [],
    markers = [],
    center,
    currentLocation,
    rangeRadiusMiles,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRefs = useRef<google.maps.Marker[]>([]);
    const circleRef = useRef<google.maps.Circle | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

    useEffect(() => {
        let cancelled = false;
        if (!apiKey) {
            queueMicrotask(() => setLoadError('Google Maps API key is unavailable.'));
            return;
        }

        loadGoogleMapsScript(apiKey)
            .then(() => {
                if (!cancelled) {
                    setLoadError(null);
                    setIsReady(true);
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setLoadError(error instanceof Error ? error.message : 'Google Maps failed to load.');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [apiKey]);

    useEffect(() => {
        if (!isReady || !containerRef.current || !window.google?.maps) return;

        let cancelled = false;
        const geocoder = new window.google.maps.Geocoder();
        const defaultCenter = { lat: 39.8283, lng: -98.5795 };

        const clearOverlays = () => {
            markerRefs.current.forEach(marker => marker.setMap(null));
            markerRefs.current = [];
            circleRef.current?.setMap(null);
            circleRef.current = null;
        };

        const addMarker = (
            map: google.maps.Map,
            bounds: google.maps.LatLngBounds,
            marker: { position: LatLngLiteral; title: string; label?: string; type: MapMarker['type'] },
        ) => {
            const instance = new window.google.maps.Marker({
                map,
                position: marker.position,
                title: marker.title,
                label: marker.label,
                icon: marker.type === 'current'
                    ? {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 9,
                        fillColor: '#22c55e',
                        fillOpacity: 1,
                        strokeColor: '#ecfdf5',
                        strokeWeight: 2,
                    }
                    : marker.type === 'gas'
                        ? {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#3b82f6',
                            fillOpacity: 1,
                            strokeColor: '#dbeafe',
                            strokeWeight: 1,
                        }
                        : undefined,
            });

            markerRefs.current.push(instance);
            bounds.extend(marker.position);
        };

        const run = async () => {
            const focusPoint =
                (await resolvePoint(center, geocoder)) ||
                (await resolvePoint(currentLocation, geocoder)) ||
                markers[0]?.position ||
                (locations[0] ? await resolvePoint(locations[0], geocoder) : null) ||
                defaultCenter;

            if (cancelled) return;

            if (!mapRef.current) {
                mapRef.current = new window.google.maps.Map(containerRef.current, {
                    center: focusPoint,
                    zoom: 4,
                    disableDefaultUI: true,
                    clickableIcons: false,
                    gestureHandling: 'greedy',
                    styles: DARK_MAP_STYLES,
                    backgroundColor: '#101318',
                });
            } else {
                mapRef.current.setOptions({ styles: DARK_MAP_STYLES, backgroundColor: '#101318' });
                mapRef.current.setCenter(focusPoint);
            }

            const map = mapRef.current;
            clearOverlays();
            const bounds = new window.google.maps.LatLngBounds();

            if (currentLocation) {
                const currentPoint = await resolvePoint(currentLocation, geocoder);
                if (cancelled) return;
                if (currentPoint) {
                    addMarker(map, bounds, {
                        position: currentPoint,
                        title: 'Current location',
                        type: 'current',
                        label: 'You',
                    });

                    if (rangeRadiusMiles) {
                        circleRef.current = new window.google.maps.Circle({
                            map,
                            center: currentPoint,
                            radius: rangeRadiusMiles * 1609.34,
                            fillColor: '#22c55e',
                            fillOpacity: 0.08,
                            strokeColor: '#22c55e',
                            strokeOpacity: 0.25,
                            strokeWeight: 1,
                        });
                        bounds.union(circleRef.current.getBounds() ?? bounds);
                    }
                }
            }

            markers.forEach((marker) => addMarker(map, bounds, marker));

            const waypointMarkers = await Promise.all(
                locations.map(async (location, index) => {
                    const position = await resolvePoint(location, geocoder);
                    if (!position) return null;
                    return {
                        position,
                        title: location,
                        type: 'waypoint' as const,
                        label: String(index + 1),
                    };
                }),
            );

            if (cancelled) return;

            waypointMarkers.forEach((item) => {
                if (!item) return;
                addMarker(map, bounds, item);
            });

            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, 48);
                window.google.maps.event.addListenerOnce(map, 'idle', () => {
                    const zoom = map.getZoom();
                    if (zoom && zoom > 12) {
                        map.setZoom(12);
                    }
                });
            } else {
                map.setCenter(focusPoint);
                map.setZoom(6);
            }
        };

        void run().catch(() => {
            if (!cancelled) {
                setLoadError('Google Maps could not render this route.');
            }
        });

        return () => {
            cancelled = true;
        };
    }, [currentLocation, isReady, locations, markers, rangeRadiusMiles, center]);

    if (loadError) {
        return (
            <div className="w-full h-full bg-[#161b22] flex flex-col items-center justify-center rounded-xl border border-gray-800 text-gray-500 gap-4 p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute inset-0 bg-linear-to-b from-transparent to-[#161b22]" />
                <MapPinOff size={48} className="text-gray-700 relative z-10" />
                <div className="relative z-10">
                    <h3 className="text-lg font-bold text-gray-300">Map unavailable</h3>
                    <p className="text-xs font-mono mt-2 max-w-xs mx-auto text-gray-500">
                        {loadError}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full rounded-xl border border-gray-800 bg-[#101318] relative overflow-hidden">
            <div ref={containerRef} className="absolute inset-0" data-testid="tour-map-canvas" />
            {!isReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#161b22] text-gray-500 text-center p-8">
                    <Loader2 size={24} className="animate-spin text-yellow-500" />
                    <div>
                        <h3 className="text-lg font-bold text-gray-300">Loading route map</h3>
                        <p className="text-xs font-mono mt-2 max-w-xs mx-auto text-gray-500">
                            Rendering live stops, nearby places, and route context.
                        </p>
                    </div>
                </div>
            )}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_20%,rgba(34,197,94,0.08),transparent_45%),linear-gradient(to_bottom,transparent,rgba(16,19,24,0.55))]" />
            <div className="absolute top-3 left-3 z-10 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-green-300 backdrop-blur-md">
                Live Map
            </div>
        </div>
    );
};
