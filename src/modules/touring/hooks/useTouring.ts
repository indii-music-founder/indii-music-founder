import { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { TouringService } from '@/services/touring/TouringService';
import { Itinerary } from '../types';

export const useTouring = () => {
    const { userProfile } = useStore();
    const [itineraries, setItineraries] = useState<Itinerary[]>([]);
    const [currentItinerary, setCurrentItinerary] = useState<Itinerary | null>(null);
    const [vehicleStats, setVehicleStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.id) return;

        setLoading(true);

        // Subscribe to itineraries
        const unsubscribe = TouringService.subscribeToItineraries(userProfile.id, (data) => {
            setItineraries(data);
            if (data.length > 0 && !currentItinerary) {
                setCurrentItinerary(data[0]);
            }
        });

        // Fetch vehicle stats
        TouringService.getVehicleStats(userProfile.id).then(stats => {
            if (stats) {
                setVehicleStats(stats);
            } else {
                // Default stats if none exist
                setVehicleStats({
                    milesDriven: 0,
                    fuelLevelPercent: 100,
                    tankSizeGallons: 150,
                    mpg: 8,
                    gasPricePerGallon: 4.50
                });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    const saveItinerary = async (itinerary: Omit<Itinerary, 'id' | 'userId'>) => {
        if (!userProfile?.id) return;
        await TouringService.saveItinerary({
            ...itinerary,
            userId: userProfile.id
        });
    };

    const updateItineraryStop = async (stopIndex: number, updatedStop: any) => {
        if (!currentItinerary || !currentItinerary.id) return;

        const newStops = [...currentItinerary.stops];
        newStops[stopIndex] = updatedStop;

        await TouringService.updateItinerary(currentItinerary.id, {
            stops: newStops
        });
    };

    const saveVehicleStats = async (stats: any) => {
        if (!userProfile?.id) return;
        setVehicleStats(stats); // Optimistic update
        await TouringService.saveVehicleStats(userProfile.id, stats);
    };

    return {
        itineraries,
        currentItinerary,
        setCurrentItinerary,
        vehicleStats,
        saveVehicleStats,
        saveItinerary,
        updateItineraryStop,
        loading
    };
};
