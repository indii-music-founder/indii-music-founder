import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { Loader2, MapPinOff, Map as MapIcon } from 'lucide-react';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';

import { MapMarker } from '../types';

const MAPS_LIBRARIES: ("places")[] = ["places"];

interface TourMapProps {
    locations?: string[]; // Legacy/Simple mode
    markers?: MapMarker[]; // Rich mode (Performance)
    center?: { lat: number; lng: number } | string;
    currentLocation?: { lat: number; lng: number } | string;
    rangeRadiusMiles?: number;
}

// ─── Graceful Map Unavailable Fallback ─────────────────────────────────────────
const MapUnavailableFallback: React.FC<{ reason: 'missing_key' | 'auth_failure' | 'load_failure' | 'feature_disabled' }> = ({ reason }) => {
    const messages: Record<string, { title: string; detail: string }> = {
        missing_key: {
            title: 'Map Visualization Disabled',
            detail: 'Add VITE_GOOGLE_MAPS_API_KEY to your environment to enable real-time satellite routing.',
        },
        auth_failure: {
            title: 'Map Authentication Failed',
            detail: 'The Google Maps handshake failed. This usually indicates a missing App Check / reCAPTCHA key in the development environment.',
        },
        load_failure: {
            title: 'Map Could Not Load',
            detail: 'Google Maps failed to initialize. Check your API key and ensure the Maps JavaScript API is enabled.',
        },
        feature_disabled: {
            title: 'Map Visualization Disabled',
            detail: 'Google Maps is currently disabled by feature flag (VITE_ENABLE_GOOGLE_MAPS=false).',
        },
    };

    const msg = messages[reason] || messages.auth_failure;

    return (
        <div className="w-full h-full bg-[#161b22] flex flex-col items-center justify-center rounded-xl border border-gray-800 text-gray-500 gap-4 p-8 text-center relative overflow-hidden group">
            {/* Abstract grid background for pro look */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-[#161b22]" />

            {/* Decorative map silhouette */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <MapIcon size={320} strokeWidth={0.5} />
            </div>

            <MapPinOff size={48} className="text-gray-700 relative z-10 group-hover:text-yellow-500/50 transition-colors duration-500" />
            <div className="relative z-10">
                <h3 className="text-lg font-bold text-gray-300">{msg!.title}</h3>
                <p className="text-xs font-mono mt-2 max-w-xs mx-auto text-gray-500">
                    {msg!.detail}
                </p>
            </div>

            {/* Subtle animated pulse ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 rounded-full border border-gray-800 animate-ping opacity-10" />
            </div>
        </div>
    );
};

// ─── Internal Map Component ────────────────────────────────────────────────────
const MapComponent: React.FC<TourMapProps & { onAuthFailure: () => void }> = ({ locations = [], markers = [], center, currentLocation, rangeRadiusMiles, onAuthFailure }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const markersRef = useRef<google.maps.Marker[]>([]);
    const circlesRef = useRef<google.maps.Circle[]>([]);
    const prevCenterRef = useRef<string | { lat: number; lng: number }>();
    const prevMarkersJsonRef = useRef<string>('');
    const prevLocationsJsonRef = useRef<string>('');
    const prevCurrentLocationJsonRef = useRef<string>('');
    const prevRangeRadiusRef = useRef<number>();

    // Detect Google Maps auth failure via global callback + MutationObserver
    useEffect(() => {
        // Google Maps fires this global function when API key auth fails
        window.gm_authFailure = () => {
            logger.warn('[TourMap] Google Maps authentication failure detected');
            onAuthFailure();
        };

        // Also watch for Google's injected error overlay div
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof HTMLElement) {
                        // Google Maps injects a dismissible error div with specific styles
                        const errorDiv = node.querySelector?.('.dismissButton') ||
                            node.querySelector?.('[style*="background-color: white"]');
                        if (errorDiv || node.textContent?.includes('This page didn\'t load Google Maps correctly')) {
                            logger.warn('[TourMap] Google Maps error overlay detected, hiding it');
                            node.style.display = 'none';
                            onAuthFailure();
                            return;
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            delete window.gm_authFailure;
            observer.disconnect();
        };
    }, [onAuthFailure]);

    // Initialize Map
    useEffect(() => {
        let active = true;
        let initialMap: google.maps.Map | undefined;

        if (ref.current && ref.current.isConnected && !map) {
            try {
                // Safely resolve initial center coordinates
                let initialCenter: google.maps.LatLngLiteral = { lat: 39.8283, lng: -98.5795 };
                if (center) {
                    if (typeof center === 'object' && !isNaN(center.lat) && !isNaN(center.lng)) {
                        initialCenter = center;
                    } else if (typeof center === 'string') {
                        const parts = center.split(',').map(p => p.trim());
                        if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                            initialCenter = { lat: Number(parts[0]), lng: Number(parts[1]) };
                        }
                    }
                }

                initialMap = new google.maps.Map(ref.current, {
                    center: initialCenter,
                    zoom: 4,
                    styles: [
                        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                        {
                            featureType: "administrative.locality",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#d59563" }],
                        },
                        {
                            featureType: "poi",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#d59563" }],
                        },
                        {
                            featureType: "poi.park",
                            elementType: "geometry",
                            stylers: [{ color: "#263c3f" }],
                        },
                        {
                            featureType: "poi.park",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#6b9a76" }],
                        },
                        {
                            featureType: "road",
                            elementType: "geometry",
                            stylers: [{ color: "#38414e" }],
                        },
                        {
                            featureType: "road",
                            elementType: "geometry.stroke",
                            stylers: [{ color: "#212a37" }],
                        },
                        {
                            featureType: "road",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#9ca5b3" }],
                        },
                        {
                            featureType: "road.highway",
                            elementType: "geometry",
                            stylers: [{ color: "#746855" }],
                        },
                        {
                            featureType: "road.highway",
                            elementType: "geometry.stroke",
                            stylers: [{ color: "#1f2835" }],
                        },
                        {
                            featureType: "road.highway",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#f3d19c" }],
                        },
                        {
                            featureType: "transit",
                            elementType: "geometry",
                            stylers: [{ color: "#2f3948" }],
                        },
                        {
                            featureType: "transit.station",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#d59563" }],
                        },
                        {
                            featureType: "water",
                            elementType: "geometry",
                            stylers: [{ color: "#17263c" }],
                        },
                        {
                            featureType: "water",
                            elementType: "labels.text.fill",
                            stylers: [{ color: "#515c6d" }],
                        },
                        {
                            featureType: "water",
                            elementType: "labels.text.stroke",
                            stylers: [{ color: "#17263c" }],
                        },
                    ],
                    disableDefaultUI: true,
                    zoomControl: true,
                    backgroundColor: '#0d1117'
                });
                if (active) {
                    setMap(initialMap);
                } else {
                    google.maps.event.clearInstanceListeners(initialMap);
                }
            } catch (err: unknown) {
                logger.error('[TourMap] Failed to initialize Google Maps:', err);
                onAuthFailure();
            }
        }

        return () => {
            active = false;
            if (initialMap) {
                google.maps.event.clearInstanceListeners(initialMap);
            }
            if (map) {
                google.maps.event.clearInstanceListeners(map);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref, map, onAuthFailure]);

    // Center and Zoom Updates
    useEffect(() => {
        if (!map || !center) return;

        // Check if center has changed to avoid overriding user's manual dragging/zooming on unrelated renders
        const isSame = (
            typeof center === 'string' && typeof prevCenterRef.current === 'string' && center === prevCenterRef.current
        ) || (
            typeof center === 'object' && typeof prevCenterRef.current === 'object' &&
            center !== null && prevCenterRef.current !== null &&
            center.lat === prevCenterRef.current.lat && center.lng === prevCenterRef.current.lng
        );

        if (isSame) return;
        prevCenterRef.current = center;

        let active = true;

        if (typeof center === 'string') {
            const parts = center.split(',').map(p => p.trim());
            if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                map.panTo({ lat: Number(parts[0]), lng: Number(parts[1]) });
                map.setZoom(14);
            } else {
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: center }, (results, status) => {
                    if (active && status === 'OK' && results && results[0]) {
                        map.panTo(results[0].geometry.location);
                        map.setZoom(14);
                    }
                });
            }
        } else if (!isNaN(center.lat) && !isNaN(center.lng)) {
            map.panTo(center);
            map.setZoom(14);
        }

        return () => {
            active = false;
        };
    }, [map, center]);

    // Update Markers and Range Ring
    useEffect(() => {
        if (!map) return;
        let active = true;

        // Clear existing markers
        markersRef.current.forEach(marker => {
            google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
        });
        markersRef.current = [];

        // Clear existing circles
        circlesRef.current.forEach(circle => {
            google.maps.event.clearInstanceListeners(circle);
            circle.setMap(null);
        });
        circlesRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        // 1. Handle Pre-defined Markers (Performance Optimization)
        if (markers && markers.length > 0) {
            markers.forEach((m: MapMarker) => {
                if (!m.position || isNaN(m.position.lat) || isNaN(m.position.lng)) return;
                if (m.position.lat === 0 && m.position.lng === 0) return; // Skip Null Island placeholders

                const marker = new google.maps.Marker({
                    position: m.position,
                    map,
                    title: m.title,
                    animation: google.maps.Animation.DROP,
                    icon: m.type === 'current' ? {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#3B82F6",
                        fillOpacity: 1,
                        strokeColor: "white",
                        strokeWeight: 2,
                    } : m.type === 'gas' ? {
                        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                        fillColor: "#22c55e",
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: "#ffffff",
                        scale: 1.5,
                        anchor: new google.maps.Point(12, 24),
                    } : undefined,
                });

                // Range Ring Logic
                if (m.type === 'current' && rangeRadiusMiles) {
                    const circle = new google.maps.Circle({
                        strokeColor: "#F59E0B",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: "#F59E0B",
                        fillOpacity: 0.15,
                        map,
                        center: m.position,
                        radius: rangeRadiusMiles * 1609.34
                    });
                    circlesRef.current.push(circle);
                }

                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="color:black; padding:4px;"><b>${m.title}</b><br/><small>${m.type.toUpperCase()}</small></div>`
                });

                marker.addListener("click", () => {
                    infoWindow.open(map, marker);
                });

                markersRef.current.push(marker);
                bounds.extend(m.position);
            });
        }

        // Helper to draw a current location marker
        const drawCurrentLocation = (pos: google.maps.LatLng | google.maps.LatLngLiteral) => {
            const marker = new google.maps.Marker({
                position: pos,
                map,
                title: "My Location",
                animation: google.maps.Animation.DROP,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#3B82F6",
                    fillOpacity: 1,
                    strokeColor: "white",
                    strokeWeight: 2,
                }
            });
            markersRef.current.push(marker);
            bounds.extend(pos);

            if (rangeRadiusMiles) {
                const circle = new google.maps.Circle({
                    strokeColor: "#F59E0B",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#F59E0B",
                    fillOpacity: 0.15,
                    map,
                    center: pos,
                    radius: rangeRadiusMiles * 1609.34
                });
                circlesRef.current.push(circle);
            }
        };

        const promises: Promise<void>[] = [];

        // 2. Handle currentLocation prop (geocode or parse)
        if (currentLocation) {
            if (typeof currentLocation === 'string') {
                const parts = currentLocation.split(',').map(p => p.trim());
                if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                    drawCurrentLocation({ lat: Number(parts[0]), lng: Number(parts[1]) });
                } else {
                    const geocoder = new google.maps.Geocoder();
                    const p = new Promise<void>((resolve) => {
                        geocoder.geocode({ address: currentLocation }, (results, status) => {
                            if (active && status === 'OK' && results && results[0]) {
                                drawCurrentLocation(results[0].geometry.location);
                            }
                            resolve();
                        });
                    });
                    promises.push(p);
                }
            } else if (!isNaN(currentLocation.lat) && !isNaN(currentLocation.lng)) {
                drawCurrentLocation(currentLocation);
            }
        }

        // 3. Handle String Locations (Fallback / Touring Mode)
        if (locations && locations.length > 0) {
            const geocoder = new google.maps.Geocoder();

            locations.forEach((location, index) => {
                const p = new Promise<void>((resolve) => {
                    geocoder.geocode({ address: location }, (results, status) => {
                        if (active && status === 'OK' && results && results[0]) {
                            const position = results[0].geometry.location;
                            const marker = new google.maps.Marker({
                                position,
                                map,
                                title: location,
                                label: {
                                    text: (index + 1).toString(),
                                    color: "white",
                                    fontWeight: "bold"
                                },
                            });
                            markersRef.current.push(marker);
                            bounds.extend(position);
                        }
                        resolve();
                    });
                });
                promises.push(p);
            });
        }

        // Adjust map bounds when all promises complete
        if (promises.length > 0) {
            Promise.all(promises).then(() => {
                if (active && !bounds.isEmpty()) {
                    map.fitBounds(bounds);
                    const totalItems = (locations?.length || 0) + (currentLocation ? 1 : 0);
                    if (totalItems === 1) {
                        map.setZoom(12);
                    }
                }
            });
        } else if (active && !bounds.isEmpty()) {
            map.fitBounds(bounds);
            const activeMarkersCount = markersRef.current.length;
            if (activeMarkersCount === 1) {
                map.setZoom(12);
            }
        }

        return () => {
            active = false;
            markersRef.current.forEach(marker => {
                google.maps.event.clearInstanceListeners(marker);
                marker.setMap(null);
            });
            markersRef.current = [];
            circlesRef.current.forEach(circle => {
                google.maps.event.clearInstanceListeners(circle);
                circle.setMap(null);
            });
            circlesRef.current = [];
        };
    }, [map, locations, markers, currentLocation, rangeRadiusMiles]);

    return <div ref={ref} className="w-full h-full rounded-xl overflow-hidden" />;
};

// ─── TourMap Wrapper ───────────────────────────────────────────────────────────

export const TourMap: React.FC<TourMapProps> = (props) => {
    const apiKey = env.googleMapsApiKey;
    const [authFailed, setAuthFailed] = useState(false);

    const handleAuthFailure = useCallback(() => {
        setAuthFailed(true);
    }, []);

    if (!env.enableGoogleMaps) {
        return <MapUnavailableFallback reason="feature_disabled" />;
    }

    // No API key at all — show clean fallback
    if (!apiKey) {
        return <MapUnavailableFallback reason="missing_key" />;
    }

    // API key exists but auth failed post-load — show fallback
    if (authFailed) {
        return <MapUnavailableFallback reason="auth_failure" />;
    }

    const renderMapStatus = (status: Status) => {
        if (status === Status.LOADING) {
            return (
                <div className="w-full h-full bg-[#161b22] flex items-center justify-center rounded-xl border border-gray-800">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            );
        }
        if (status === Status.FAILURE) {
            return <MapUnavailableFallback reason="load_failure" />;
        }
        return <MapComponent {...props} onAuthFailure={handleAuthFailure} />;
    };

    return <Wrapper apiKey={apiKey} render={renderMapStatus} libraries={MAPS_LIBRARIES} />;
};
