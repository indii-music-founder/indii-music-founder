
import { useState, useEffect, useRef } from 'react';
import { TouringService } from '@/services/touring/TouringService';
import { VehicleStats, Itinerary } from '../types';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

export const useTouring = () => {
    const { userProfile } = useStore();
    const [vehicleStats, setVehicleStats] = useState<VehicleStats | null>(null);
    const [itineraries, setItineraries] = useState<Itinerary[]>([]);
    const [currentItinerary, setCurrentItinerary] = useState<Itinerary | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Use ref to avoid stale closure in subscription
    const currentItineraryRef = useRef<Itinerary | null>(null);
    useEffect(() => { currentItineraryRef.current = currentItinerary; }, [currentItinerary]);

    useEffect(() => {
        if (!userProfile?.id) return;

        setLoading(true);

        // Fetch vehicle stats
        TouringService.getVehicleStats(userProfile.id).then(stats => {
            if (stats) {
                setVehicleStats(stats);
            } else {
                // Seed default stats if none exist
                TouringService.seedDatabase(userProfile.id).then(newStats => {
                    setVehicleStats(newStats);
                }).catch(err => {
                    console.error("Failed to seed vehicle stats:", err);
                    // Fallback local state if seeding/fetch fails
                    setVehicleStats({
                        userId: userProfile.id,
                        milesDriven: 0,
                        fuelLevelPercent: 100,
                        tankSizeGallons: 150,
                        mpg: 8,
                        gasPricePerGallon: 4.50
                    });
                });
            }
        }).catch(error => {
            console.error('Failed to fetch vehicle stats:', error);
        });

        // Subscribe to itineraries
        const unsubscribe = TouringService.subscribeToItineraries(userProfile.id, (data) => {
            setItineraries(data);

            // Safer logic to set current itinerary only if none is selected
            setCurrentItinerary(prev => {
                if (data.length > 0 && !prev) {
                    return data[0];
                }
                return prev;
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    const updateItineraryStop = async (index: number, stop: any) => {
        if (!currentItinerary || !currentItinerary.id) return;

        const updatedStops = [...currentItinerary.stops];
        updatedStops[index] = stop;

        const updatedItinerary = { ...currentItinerary, stops: updatedStops };
        setCurrentItinerary(updatedItinerary); // Optimistic update

        try {
            await TouringService.updateItinerary(currentItinerary.id, { stops: updatedStops });
        } catch (error) {
            console.error("Failed to update itinerary", error);
            toast.error("Failed to save changes");
            // Optionally revert logical state here if needed
        }
    };

    const saveItinerary = async (itinerary: Omit<Itinerary, 'id' | 'userId'>) => {
        if (!userProfile?.id) return;
        try {
            await TouringService.saveItinerary({
                ...itinerary,
                userId: userProfile.id
            });
            toast.success("Itinerary saved");
        } catch (error) {
            console.error("Failed to save itinerary", error);
            toast.error("Failed to save itinerary");
        }
    };

    const saveVehicleStats = async (stats: VehicleStats) => {
        if (!userProfile?.id) return;
        setVehicleStats(stats); // Optimistic update
        try {
            await TouringService.saveVehicleStats(userProfile.id, stats);
            toast.success("Vehicle stats updated");
        } catch (error) {
            console.error("Failed to save vehicle stats", error);
            toast.error("Failed to save vehicle stats");
        }
    };

    return {
        vehicleStats,
        itineraries,
        currentItinerary,
        setCurrentItinerary,
        loading,
        updateItineraryStop,
        saveItinerary,
        saveVehicleStats
    };
};
