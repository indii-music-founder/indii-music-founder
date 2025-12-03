import React, { useState } from 'react';
import { MapPin, Calendar, Truck, CheckCircle, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

interface ItineraryStop {
    date: string;
    city: string;
    venue: string;
    activity: string;
    notes: string;
}

interface Itinerary {
    tourName: string;
    stops: ItineraryStop[];
    totalDistance: string;
    estimatedBudget: string;
}

interface LogisticsReport {
    isFeasible: boolean;
    issues: string[];
    suggestions: string[];
}

const RoadManager: React.FC = () => {
    const toast = useToast();
    const [locations, setLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [itinerary, setItinerary] = useState<Itinerary | null>(null);
    const [isCheckingLogistics, setIsCheckingLogistics] = useState(false);
    const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);

    const handleAddLocation = () => {
        if (newLocation.trim()) {
            setLocations([...locations, newLocation.trim()]);
            setNewLocation('');
        }
    };

    const handleRemoveLocation = (index: number) => {
        setLocations(locations.filter((_, i) => i !== index));
    };

    const handleGenerateItinerary = async () => {
        if (locations.length === 0 || !startDate || !endDate) {
            toast.error("Please provide locations and dates.");
            return;
        }

        setIsGenerating(true);
        setItinerary(null);
        setLogisticsReport(null);

        try {
            const generateItinerary = httpsCallable(functions, 'generateItinerary');
            const response = await generateItinerary({ locations, dates: { start: startDate, end: endDate } });
            const result = response.data as Itinerary;
            setItinerary(result);
            toast.success("Itinerary generated");
        } catch (error) {
            console.error("Itinerary Generation Failed:", error);
            toast.error("Failed to generate itinerary");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCheckLogistics = async () => {
        if (!itinerary) return;

        setIsCheckingLogistics(true);
        try {
            const checkLogistics = httpsCallable(functions, 'checkLogistics');
            const response = await checkLogistics({ itinerary });
            const result = response.data as LogisticsReport;
            setLogisticsReport(result);
            toast.success("Logistics check complete");
        } catch (error) {
            console.error("Logistics Check Failed:", error);
            toast.error("Failed to check logistics");
        } finally {
            setIsCheckingLogistics(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Truck className="text-yellow-500" />
                        Road Manager
                    </h1>
                    <p className="text-gray-400">Plan your tour logistics and itineraries.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <MapPin className="text-blue-500" size={20} />
                            Tour Details
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Dates</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        aria-label="Start Date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none"
                                    />
                                    <input
                                        type="date"
                                        aria-label="End Date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Locations</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={newLocation}
                                        onChange={(e) => setNewLocation(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                                        placeholder="Add a city..."
                                        className="flex-1 bg-black/20 border border-gray-700 rounded-lg p-2 text-sm text-gray-300 focus:border-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={handleAddLocation}
                                        aria-label="Add location"
                                        className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {locations.map((loc, idx) => (
                                        <div key={idx} className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded text-sm text-gray-300">
                                            {loc}
                                            <button onClick={() => handleRemoveLocation(idx)} aria-label={`Remove ${loc}`} className="hover:text-red-400">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateItinerary}
                                disabled={isGenerating || locations.length === 0 || !startDate || !endDate}
                                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Planning Tour...
                                    </>
                                ) : (
                                    <>
                                        <Truck size={20} />
                                        Generate Itinerary
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Itinerary Display */}
                <div className="lg:col-span-2 space-y-6">
                    {itinerary ? (
                        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{itinerary.tourName}</h2>
                                    <p className="text-gray-400 text-sm">
                                        Total Distance: {itinerary.totalDistance} • Est. Budget: {itinerary.estimatedBudget}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCheckLogistics}
                                    disabled={isCheckingLogistics}
                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                                >
                                    {isCheckingLogistics ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                    Check Logistics
                                </button>
                            </div>

                            {logisticsReport && (
                                <div className={`mb-6 p-4 rounded-xl border ${logisticsReport.isFeasible ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'}`}>
                                    <h4 className={`font-semibold mb-2 flex items-center gap-2 ${logisticsReport.isFeasible ? 'text-green-400' : 'text-red-400'}`}>
                                        {logisticsReport.isFeasible ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                        Logistics Report
                                    </h4>
                                    {logisticsReport.issues.length > 0 && (
                                        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 mb-2">
                                            {logisticsReport.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                        </ul>
                                    )}
                                    {logisticsReport.suggestions.length > 0 && (
                                        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                            {logisticsReport.suggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}
                                        </ul>
                                    )}
                                </div>
                            )}

                            <div className="space-y-4">
                                {itinerary.stops.map((stop, idx) => (
                                    <div key={idx} className="flex gap-4 p-4 bg-black/20 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                                        <div className="flex-shrink-0 w-16 text-center">
                                            <div className="text-sm text-gray-400">{new Date(stop.date).toLocaleDateString(undefined, { month: 'short' })}</div>
                                            <div className="text-xl font-bold text-white">{new Date(stop.date).getDate()}</div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-semibold text-white">{stop.city}</h4>
                                                <span className={`text-xs px-2 py-1 rounded-full ${stop.activity === 'Show' ? 'bg-purple-500/20 text-purple-400' :
                                                    stop.activity === 'Travel' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-gray-700 text-gray-300'
                                                    }`}>
                                                    {stop.activity}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mb-1">{stop.venue}</p>
                                            <p className="text-xs text-gray-500 italic">{stop.notes}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-xl p-12">
                            <Truck size={48} className="mb-4 opacity-20" />
                            <p>Enter tour details to generate an itinerary.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoadManager;
