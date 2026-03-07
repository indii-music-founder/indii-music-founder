import React, { useState } from 'react';
import { Plane, Calendar, FileText, CheckCircle } from 'lucide-react';

export const VisaImmigrationChecklist: React.FC = () => {
    // Visa/Immigration Checklist Module mock (Item 140)
    // Note: I will also complete item 140 now so it fits logically with the tour planning features
    const [tasks, setTasks] = useState([
        { id: '1', title: 'File Petition for Nonimmigrant Worker (Form I-129)', completed: true },
        { id: '2', title: 'Collect union advisory opinions (AFM/AGMA)', completed: false },
        { id: '3', title: 'Schedule Consular Interview', completed: false },
        { id: '4', title: 'Submit Tour Itinerary', completed: true },
    ]);

    const toggleTask = (id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const progress = (tasks.filter(t => t.completed).length / tasks.length) * 100;

    return (
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 text-gray-200 w-full max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                <Plane className="text-blue-400" size={24} />
                <div>
                    <h2 className="text-lg font-bold">International Touring: US P-2 Visa Checklist</h2>
                    <p className="text-sm text-gray-400">Automated documentation tracker for immigration requirements.</p>
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2 text-gray-400">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="space-y-3">
                {tasks.map(task => (
                    <div
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors border
                            ${task.completed ? 'bg-blue-900/10 border-blue-500/20 text-gray-400' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}
                        `}
                    >
                        <div className="mt-0.5">
                            {task.completed ? (
                                <CheckCircle className="text-blue-400" size={20} />
                            ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-500" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                {task.title}
                            </h4>
                        </div>
                    </div>
                ))}
            </div>

            <button className="w-full mt-6 py-3 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors">
                <FileText size={18} />
                Export Checklist for Legal Counsel
            </button>
        </div>
    );
};
