import React from 'react';
import { LayoutTemplate, X, ArrowRight } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../services/workflowTemplates';

interface WorkflowTemplateModalProps {
    onClose: () => void;
    onLoadTemplate: (templateId: string) => void;
}

export default function WorkflowTemplateModal({ onClose, onLoadTemplate }: WorkflowTemplateModalProps) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <LayoutTemplate className="text-blue-500" /> Workflow Templates
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-1">
                    {WORKFLOW_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => onLoadTemplate(template.id)}
                            className="flex flex-col text-left p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group"
                        >
                            <h3 className="font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                {template.name}
                            </h3>
                            <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                                {template.description}
                            </p>
                            <div className="mt-auto flex items-center text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Load Template <ArrowRight size={12} className="ml-1" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
