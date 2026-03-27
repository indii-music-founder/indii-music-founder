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
                        <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center bg-black/20 rounded border border-gray-800/50 border-dashed gap-2">
                            {widget.type === 'chart' && (
                                <div className="flex items-end gap-1 h-10">
                                    {[40, 65, 50, 80, 55, 70, 90].map((h, i) => (
                                        <div key={i} className="w-3 bg-teal-500/30 rounded-t" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                            )}
                            {widget.type === 'metric' && (
                                <span className="text-2xl font-bold text-teal-400/60 font-mono">—</span>
                            )}
                            {widget.type === 'donut' && (
                                <div className="w-10 h-10 rounded-full border-4 border-teal-500/20 border-t-teal-500/60" />
                            )}
                            {widget.type === 'list' && (
                                <div className="space-y-1.5 w-3/4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-2 bg-gray-800 rounded-full" style={{ width: `${100 - i * 15}%` }} />
                                    ))}
                                </div>
                            )}
                            <span className="text-[10px] text-gray-700 font-mono uppercase tracking-widest">Connect data source</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
