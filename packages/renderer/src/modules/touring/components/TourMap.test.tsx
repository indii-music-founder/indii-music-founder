import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TourMap } from './TourMap';

const createGoogleMapsMock = () => {
    const mapInstance = {
        fitBounds: vi.fn(),
        getZoom: vi.fn(() => 14),
        setCenter: vi.fn(),
        setOptions: vi.fn(),
        setZoom: vi.fn(),
    };

    const boundsInstance = {
        extend: vi.fn(),
        isEmpty: vi.fn(() => false),
        union: vi.fn(),
    };

    const circleInstance = {
        getBounds: vi.fn(() => boundsInstance),
        setMap: vi.fn(),
    };

    const geocode = vi.fn(async ({ address }: { address: string }) => {
        const coordinates: Record<string, { lat: number; lng: number }> = {
            'Austin, TX': { lat: 30.2672, lng: -97.7431 },
            'New York, NY': { lat: 40.7128, lng: -74.006 },
        };
        const location = coordinates[address];

        return {
            results: location
                ? [{ geometry: { location: { toJSON: () => location } } }]
                : [],
        };
    });

    const google = {
        maps: {
            Circle: vi.fn().mockImplementation(function CircleMock() {
                return circleInstance;
            }),
            Geocoder: vi.fn().mockImplementation(function GeocoderMock() {
                return { geocode };
            }),
            LatLngBounds: vi.fn().mockImplementation(function LatLngBoundsMock() {
                return boundsInstance;
            }),
            Map: vi.fn().mockImplementation(function MapMock() {
                return mapInstance;
            }),
            Marker: vi.fn().mockImplementation(function MarkerMock(options: Record<string, unknown>) {
                return {
                    ...options,
                    setMap: vi.fn(),
                };
            }),
            SymbolPath: {
                CIRCLE: 'CIRCLE',
            },
            event: {
                addListenerOnce: vi.fn((_map: unknown, _event: string, callback: () => void) => {
                    callback();
                    return { remove: vi.fn() };
                }),
                removeListener: vi.fn(),
            },
        },
    };

    return { google, geocode, mapInstance };
};

describe('TourMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        delete (window as typeof window & { google?: unknown }).google;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete (window as typeof window & { google?: unknown }).google;
    });

    it('renders live markers and geocodes string locations when Google Maps is available', async () => {
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'maps-key');

        const { google, geocode, mapInstance } = createGoogleMapsMock();
        Object.defineProperty(window, 'google', {
            configurable: true,
            writable: true,
            value: google,
        });

        render(
            <TourMap
                center="Austin, TX"
                currentLocation="40.0, -75.0"
                locations={['New York, NY']}
                markers={[
                    {
                        position: { lat: 34.0522, lng: -118.2437 },
                        title: 'Venue Stop',
                        type: 'venue',
                        label: '1',
                    },
                ]}
                rangeRadiusMiles={50}
            />
        );

        await waitFor(() => {
            expect(google.maps.Map).toHaveBeenCalledTimes(1);
            expect(google.maps.Marker).toHaveBeenCalledTimes(3);
            expect(google.maps.Circle).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByTestId('tour-map-canvas')).toBeInTheDocument();
        expect(screen.queryByText('Loading route map')).not.toBeInTheDocument();
        expect(geocode).toHaveBeenCalledWith({ address: 'Austin, TX' });
        expect(geocode).toHaveBeenCalledWith({ address: 'New York, NY' });
        expect(mapInstance.fitBounds).toHaveBeenCalled();
        expect(mapInstance.setZoom).toHaveBeenCalledWith(12);

        const mapOptions = vi.mocked(google.maps.Map).mock.calls[0]?.[1] as { center: { lat: number; lng: number } };
        expect(mapOptions.center).toEqual({ lat: 30.2672, lng: -97.7431 });
    });

    it('shows an honest fallback when the Maps key is missing', async () => {
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
        render(<TourMap />);

        expect(await screen.findByText('Map unavailable')).toBeInTheDocument();
        expect(screen.getByText('Google Maps API key is unavailable.')).toBeInTheDocument();
    });
});
