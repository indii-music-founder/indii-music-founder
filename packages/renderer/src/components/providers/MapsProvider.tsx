import React, { createContext, useContext, ReactNode } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { env } from '@/config/env';

const MAPS_LIBRARIES: ("places")[] = ["places"];

interface MapsContextType {
    isLoaded: boolean;
    loadError: Error | null;
}

const MapsContext = createContext<MapsContextType>({
    isLoaded: false,
    loadError: null,
});

export const useMapsContext = () => useContext(MapsContext);

interface MapsProviderProps {
    children: ReactNode;
}

const renderMapsStatus = (status: Status): React.ReactElement => {
    if (status === Status.LOADING) return <></>; // Don't block the UI globally, maps components will handle their own loading state if needed, or simply render when window.google is ready
    if (status === Status.FAILURE) return <></>;
    return <></>;
};

export const MapsProvider: React.FC<MapsProviderProps> = ({ children }) => {
    const apiKey = env.googleMapsApiKey || '';

    // If Google Maps is disabled or API key is missing, we still render children
    // The individual map components (TourMap, MapsComponent) are responsible for showing fallbacks
    if (!env.enableGoogleMaps || !apiKey) {
        return (
            <MapsContext.Provider value={{ isLoaded: false, loadError: new Error("Maps disabled or missing API key") }}>
                {children}
            </MapsContext.Provider>
        );
    }

    return (
        <Wrapper apiKey={apiKey} libraries={MAPS_LIBRARIES} render={renderMapsStatus}>
            <MapsContext.Provider value={{ isLoaded: true, loadError: null }}>
                {children}
            </MapsContext.Provider>
        </Wrapper>
    );
};
