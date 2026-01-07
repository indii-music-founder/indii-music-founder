
import React from 'react';
import { Calendar, MapPin, Users, Sun, Clock } from 'lucide-react';

interface CallSheetData {
    production: string;
    date: string;
    location: string;
    callTime: string;
    weather: string;
    nearestHospital: string;
    cast: { name: string; role: string; callTime: string }[];
    schedule: { time: string; scene: string; description: string }[];
}

interface CallSheetRendererProps {
    data: CallSheetData | string;
}

export default function CallSheetRenderer({ data }: CallSheetRendererProps) {
    const sheet: CallSheetData | null = typeof data === 'string' ? (() => {
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    })() : data;

    if (!sheet) return null;

    return (
        <div className="bg-white text-black font-sans text-sm rounded-none shadow-xl my-4 mx-auto max-w-2xl border border-gray-400">
            {/* Header */}
            <div className="border-b-2 border-black p-4 flex justify-between items-start bg-gray-50">
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-tight">{sheet.production || "PRODUCTION NAME"}</h1>
                    <h2 className="text-lg uppercase text-gray-600 font-bold">Daily Call Sheet</h2>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold">{sheet.date.split('-')[2] || 'DD'}</div>
                    <div className="uppercase font-bold text-gray-500">{new Date(sheet.date).toLocaleString('default', { month: 'short' })}</div>
                </div>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-2 border-b-2 border-black divide-x-2 divide-black">
                <div className="p-3">
                    <div className="flex items-center gap-2 font-bold uppercase text-xs text-gray-500 mb-1">
                        <MapPin size={12} /> Location
                    </div>
                    <div>{sheet.location}</div>
                </div>
                <div className="p-3">
                    <div className="flex items-center gap-2 font-bold uppercase text-xs text-gray-500 mb-1">
                        <Clock size={12} /> General Crew Call
                    </div>
                    <div className="text-xl font-bold">{sheet.callTime}</div>
                </div>
            </div>

            {/* Weather & Safety */}
            <div className="grid grid-cols-2 border-b-2 border-black divide-x-2 divide-black bg-gray-50">
                <div className="p-3">
                    <div className="flex items-center gap-2 font-bold uppercase text-xs text-gray-500 mb-1">
                        <Sun size={12} /> Weather
                    </div>
                    <div>{sheet.weather}</div>
                </div>
                <div className="p-3">
                    <div className="font-bold uppercase text-xs text-red-600 mb-1">
                        Nearest Hospital
                    </div>
                    <div className="text-xs">{sheet.nearestHospital}</div>
                </div>
            </div>

            {/* Cast Table */}
            <div className="border-b-2 border-black">
                <div className="bg-black text-white px-3 py-1 font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                    <Users size={12} /> Cast
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-300 text-xs text-gray-500 uppercase">
                            <th className="p-2 pl-3 font-normal">Artist</th>
                            <th className="p-2 font-normal">Character</th>
                            <th className="p-2 pr-3 font-normal text-right">Call Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sheet.cast?.map((actor, i) => (
                            <tr key={i}>
                                <td className="p-2 pl-3 font-bold">{actor.name}</td>
                                <td className="p-2 text-gray-600">{actor.role}</td>
                                <td className="p-2 pr-3 text-right font-mono font-bold">{actor.callTime}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Schedule Table */}
            <div>
                <div className="bg-black text-white px-3 py-1 font-bold uppercase text-xs tracking-wider">
                    Schedule
                </div>
                <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-gray-200">
                        {sheet.schedule?.map((item, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-2 pl-3 font-mono text-gray-500 w-20">{item.time}</td>
                                <td className="p-2 font-bold w-12 text-center border-r border-gray-200">{item.scene}</td>
                                <td className="p-2 pr-3 text-sm">{item.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="p-2 text-center text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50 border-t border-gray-300">
                Produced by indiiOS Studio
            </div>
        </div>
    );
}
