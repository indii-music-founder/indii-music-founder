import React from 'react';

export default function MapsComponent() {
    return (
        <div className="w-full h-full bg-gray-900 rounded-xl flex flex-col items-center justify-center text-gray-500 p-6 text-center border border-gray-800">
            <p className="mb-2 font-medium text-gray-400">Google Maps Integration</p>
            <p className="text-sm">Live campaign maps require a secured backend Maps proxy before browser rendering can be enabled.</p>
        </div>
    );
}
