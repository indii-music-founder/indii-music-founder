import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { Loader2, MapPinOff } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface TourMapProps {
    locations: string[]; // List of location strings to plot
}

// Internal Map Component that has access to the loaded Google Maps API
const MapComponent: React.FC<TourMapProps> = ({ locations }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const markersRef = useRef<google.maps.Marker[]>([]);
    const toast = useToast();

    // Initialize Map
    useEffect(() => {
        if (ref.current && !map) {
            const initialMap = new window.google.maps.Map(ref.current, {
                center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
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
        }
    }, [ref, map]);

    // Update Markers when locations change
    useEffect(() => {
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        if (locations.length === 0) return;

        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();

        locations.forEach((location, index) => {
            geocoder.geocode({ address: location }, (
                results: google.maps.GeocoderResult[] | null,
                status: google.maps.GeocoderStatus
            ) => {
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
                        animation: google.maps.Animation.DROP
                    });

                    markersRef.current.push(marker);
                    bounds.extend(position);

                    // If it's the last one, confirm set and fit bounds
                    // Note: Geocoding is async, this logic is a bit naive for order but works for visualization
                    if (markersRef.current.length > 0) {
                        map.fitBounds(bounds);
                        // If only one marker, zoom out a bit so we're not too close
                        if (locations.length === 1) {
                            map.setZoom(10);
                        }
                    }
                } else {
                    console.warn(`Geocode was not successful for the following reason: ${status}`);
                    // Don't toast for every failure to avoid spam, maybe just log
                }
            });
        });
    }, [map, locations]); // Re-run when locations list changes

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
