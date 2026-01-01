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
                });
            }
            setLoading(false);
        }).catch(error => {
            console.error('Failed to fetch vehicle stats:', error);
            setLoading(false);
        });

        const unsubscribe = TouringService.subscribeToItineraries(userProfile.id, (data) => {
            setItineraries(data);

            // Only set if no current selection exists using Ref to check actual current state
            // OR use functional update if setting state, but here we decide based on current state.
            // A safer way is:
            setCurrentItinerary(prev => {
                if (data.length > 0 && !prev) {
                    return data[0];
                }
                return prev;
            });
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    const updateItineraryStop = async (index: number, stop: any) => {
        if (!currentItinerary) return;
        const updatedStops = [...currentItinerary.stops];
        updatedStops[index] = stop;

        const updatedItinerary = { ...currentItinerary, stops: updatedStops };
        setCurrentItinerary(updatedItinerary); // Optimistic update

        try {
            await TouringService.updateItinerary(currentItinerary.id, { stops: updatedStops });
        } catch (error) {
            console.error("Failed to update itinerary", error);
            toast.error("Failed to save changes");
            // Revert?
        }
    };

    return {
        vehicleStats,
        itineraries,
        currentItinerary,
        setCurrentItinerary,
        loading,
        updateItineraryStop
    };
};
