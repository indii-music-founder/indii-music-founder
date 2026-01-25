import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { Loader2, MapPinOff } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

import { MapMarker } from '../types';

interface TourMapProps {
    locations?: string[]; // Legacy/Simple mode
    markers?: MapMarker[]; // Rich mode (Performance)
    center?: { lat: number; lng: number };
    rangeRadiusMiles?: number;
}
// Internal Map Component that has access to the loaded Google Maps API
const MapComponent: React.FC<TourMapProps> = ({ locations = [], markers = [], center, rangeRadiusMiles }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const markersRef = useRef<google.maps.Marker[]>([]);

    // Initialize Map
    useEffect(() => {
        if (ref.current && !map) {
            const initialMap = new google.maps.Map(ref.current, {
                center: center || { lat: 39.8283, lng: -98.5795 }, // Center of USA or provided center
                zoom: 4,
                styles: [ // Dark Mode Styles
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
                disableDefaultUI: true, // Clean look
                zoomControl: true, // Allow zoom
                backgroundColor: '#0d1117'
            });
            setMap(initialMap);
        } else if (map && center) {
            map.panTo(center);
            map.setZoom(14); // Closer zoom if focused
        }
    }, [ref, map, center]);

    // Update Markers and Range Ring
    useEffect(() => {
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Clear existing circles (if we were tracking them, but for now we'll just clear the specific one we add or re-render)
        // Ideally we track circles in a ref too, improving this:
        // const circlesRef = useRef<google.maps.Circle[]>([]);

        const bounds = new google.maps.LatLngBounds();

        // 1. Handle Pre-defined Markers (Performance Optimization)
        if (markers && markers.length > 0) {
            markers.forEach((m: MapMarker) => {
                // Determine icon based on type
                // Google Maps default markers are fine for now, but we'd ideally use SVGs
                // We'll use color coding via standard charts API or built-in symbols

                const marker = new google.maps.Marker({
                    position: m.position,
                    map,
                    title: m.title,
                    animation: google.maps.Animation.DROP,
                    // Basic separation of types
                    icon: m.type === 'current' ? {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#3B82F6",
                        fillOpacity: 1,
                        strokeColor: "white",
                        strokeWeight: 2,
                    } : m.type === 'gas' ? {
                        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", // Simple pin path or use default
                        fillColor: "#22c55e",
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: "#ffffff",
                        scale: 1.5,
                        anchor: new google.maps.Point(12, 24),
                        // Note: Path-based icons can be tricky without SVG path data.
                        // Falling back to standard markers with distinct colors if path fails visually.
                        // For reliability in this iteration:
                    } : undefined,
                    // Use standard color markers if SVG path is complex
                    // label: m.type === 'gas' ? { text: '⛽', color: 'white' } : undefined
                });

                // Range Ring Logic
                if (m.type === 'current' && rangeRadiusMiles) {
                    new google.maps.Circle({
                        strokeColor: "#F59E0B", // Amber for logistics
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: "#F59E0B",
                        fillOpacity: 0.15,
                        map,
                        center: m.position,
                        radius: rangeRadiusMiles * 1609.34 // Convert miles to meters
                    });
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

        // 2. Handle String Locations (Fallback / Touring Mode)
        // Only run if we don't have rich markers OR if explicitly mixed (rare case)
        // Prioritize markers for bounds if present.
        if (locations && locations.length > 0) {
            const geocoder = new google.maps.Geocoder();

            // Promise.all to handle multiple async geocodes
            const geocodeProms = locations.map((location, index) => {
                return new Promise<void>((resolve) => {
                    geocoder.geocode({ address: location }, (results, status) => {
                        if (status === 'OK' && results && results[0]) {
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
            });

            // Wait for all, then fit bounds
            // Note: This mixes async and sync bounds updates.
            // If we have strict markers, we fit bounds immediately below.
            // If we depend on geocoding, we might need to wait.
            // For now, simple "if no markers, wait for location" approach.
            if (markers.length === 0) {
                Promise.all(geocodeProms).then(() => {
                    if (!bounds.isEmpty()) {
                        map.fitBounds(bounds);
                        if (locations.length === 1) map.setZoom(10);
                    }
                });
            }
        }

        // Immediate FitBounds for Markers
        if (markers.length > 0 && !bounds.isEmpty()) {
            map.fitBounds(bounds);
            // Don't zoom in *too* close for a single point unless it's user location
            if (markers.length === 1 && markers[0].type === 'current') {
                map.setZoom(15);
            } else if (markers.length === 1) {
                map.setZoom(rangeRadiusMiles ? 10 : 12);
            }
        }

    }, [map, locations, markers, rangeRadiusMiles]);

    return <div ref={ref} className="w-full h-full rounded-xl overflow-hidden" />;
};

const renderMapStatus = (status: Status) => {
    if (status === Status.FAILURE) {
        return (
            <div className="w-full h-full bg-[#161b22] flex flex-col items-center justify-center rounded-xl border border-gray-800 text-gray-500 gap-4 p-8 text-center">
                <MapPinOff size={48} className="text-gray-700" />
                <div>
                    <h3 className="text-lg font-bold text-gray-300">Map Unavailable</h3>
                    <p className="text-xs font-mono mt-2 max-w-xs">
                        Google Maps API Key is missing or invalid.
                        Please check your environment configuration.
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="w-full h-full bg-[#161b22] flex items-center justify-center rounded-xl border border-gray-800">
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );
};

export const TourMap: React.FC<TourMapProps> = (props) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        // Graceful fallback if no API key is present in env
        return (
            <div className="w-full h-full bg-[#161b22] flex flex-col items-center justify-center rounded-xl border border-gray-800 text-gray-500 gap-4 p-8 text-center relative overflow-hidden group">
                {/* Abstract grid background to look "pro" even without map */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#161b22]" />

                <MapPinOff size={48} className="text-gray-700 relative z-10 group-hover:text-blue-500/50 transition-colors" />
                <div className="relative z-10">
                    <h3 className="text-lg font-bold text-gray-300">Map Visualization Disabled</h3>
                    <p className="text-xs font-mono mt-2 max-w-xs mx-auto">
                        Add `VITE_GOOGLE_MAPS_API_KEY` to your environment to enable real-time satellite routing.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <Wrapper apiKey={apiKey} render={renderMapStatus}>
            <MapComponent {...props} />
        </Wrapper>
    );
};
