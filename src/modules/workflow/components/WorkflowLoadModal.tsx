import React from 'react';
import { FolderOpen, X, ArrowRight } from 'lucide-react';
import { SavedWorkflow } from '../types';

interface WorkflowLoadModalProps {
    onClose: () => void;
    onLoadWorkflow: (workflow: SavedWorkflow) => void;
    savedWorkflows: SavedWorkflow[];
}

export default function WorkflowLoadModal({ onClose, onLoadWorkflow, savedWorkflows }: WorkflowLoadModalProps) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FolderOpen className="text-blue-500" /> Saved Workflows
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-2 overflow-y-auto p-1">
                    {savedWorkflows.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No saved workflows found.</p>
                    ) : (
                        savedWorkflows.map((workflow) => (
                            <button
                                key={workflow.id}
                                onClick={() => onLoadWorkflow(workflow)}
                                className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group"
                            >
                                <div className="text-left">
                                    <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                        {workflow.name}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        Last updated: {new Date(workflow.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <ArrowRight size={16} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
