import React, { useState } from 'react';
import { LayoutDashboard, Move, GripHorizontal } from 'lucide-react';

export const CustomizableAnalyticsDashboard: React.FC = () => {
    // Mock Customizable Dashboards (Item 159)
    const [widgets] = useState([
        { id: '1', title: 'Daily Streams', size: 'col-span-2 row-span-1', type: 'chart' },
        { id: '2', title: 'Revenue Forecast', size: 'col-span-1 row-span-1', type: 'metric' },
        { id: '3', title: 'Social Sentiment', size: 'col-span-1 row-span-1', type: 'donut' },
        { id: '4', title: 'Recent Audit Logs', size: 'col-span-2 row-span-1', type: 'list' },
    ]);

    return (
        <div className="p-6 min-h-screen bg-black text-gray-200">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <LayoutDashboard className="text-teal-400" size={24} />
                    <h2 className="text-xl font-bold font-mono">Custom Analytics Dashboard</h2>
                </div>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg border border-gray-700 transition-colors">
                    <Move size={16} /> Edit Layout
                </button>
            </div>

            <p className="text-sm text-gray-400 mb-8">
                Drag and drop components to build your custom analytics homepage.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
                {widgets.map((widget) => (
                    <div
                        key={widget.id}
                        className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col hover:border-gray-700 transition-colors cursor-move group ${widget.size}`}
                    >
                        <div className="flex justify-between items-center mb-4 border-b border-gray-800/50 pb-2">
                            <h3 className="font-medium text-gray-300">{widget.title}</h3>
                            <GripHorizontal className="text-gray-600 group-hover:text-gray-400 transition-colors" size={16} />
                        </div>
                        <div className="flex-1 min-h-[120px] flex items-center justify-center bg-black/20 rounded border border-gray-800/50 border-dashed">
                            <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">{widget.type} widget placeholder</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
