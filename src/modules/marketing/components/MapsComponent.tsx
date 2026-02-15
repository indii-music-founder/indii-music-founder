import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

const render = (status: Status) => {
    if (status === Status.LOADING) return <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-500">Loading Maps...</div>;
    if (status === Status.FAILURE) return <div className="h-full w-full flex items-center justify-center bg-gray-900 text-red-500">Error Loading Maps</div>;
    return <></>;
};

interface MapProps {
    center: google.maps.LatLngLiteral;
    zoom: number;
    markers?: { position: google.maps.LatLngLiteral; title: string }[];
}

const Map: React.FC<MapProps> = ({ center, zoom, markers }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();

    // Initialize map once on mount
    useEffect(() => {
        if (ref.current && !map) {
            setMap(new window.google.maps.Map(ref.current, {
                center,
                zoom,
                styles: [
                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                    {
                        featureType: "administrative.locality",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#d59563" }],
                    },
                    // ... more dark mode styles can be added
                ]
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount - center/zoom updates handled by separate effect

    useEffect(() => {
        if (map) {
            map.setCenter(center);
            map.setZoom(zoom);
        }
    }, [map, center, zoom]);

    useEffect(() => {
        if (map && markers) {
            markers.forEach(marker => {
                new window.google.maps.Marker({
                    position: marker.position,
                    map: map,
                    title: marker.title,
                });
            });
        }
    }, [map, markers]);

    return <div ref={ref} className="w-full h-full rounded-xl overflow-hidden" />;
};

export default function MapsComponent() {
    // Default to a placeholder if no key is present, to avoid crashing in dev without key
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

    if (!apiKey) {
        return (
            <div className="w-full h-full bg-gray-900 rounded-xl flex flex-col items-center justify-center text-gray-500 p-6 text-center border border-gray-800">
                <p className="mb-2 font-medium text-gray-400">Google Maps Integration</p>
                <p className="text-sm">Add VITE_GOOGLE_MAPS_KEY to .env to enable live campaign tracking.</p>
            </div>
        );
    }

    return (
        <Wrapper apiKey={apiKey} render={render}>
            <Map
                center={{ lat: 40.7128, lng: -74.0060 }}
                zoom={11}
                markers={[
                    { position: { lat: 40.7128, lng: -74.0060 }, title: "Campaign HQ" },
                    { position: { lat: 40.7580, lng: -73.9855 }, title: "Times Square Activation" }
                ]}
            />
        </Wrapper>
    );
}
