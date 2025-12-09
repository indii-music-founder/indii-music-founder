import React from 'react';

interface ScenarioBuilderProps {
    scenePrompt: string;
    motionPrompt: string;
    onSceneChange: (val: string) => void;
    onMotionChange: (val: string) => void;
}

const PRESETS = [
    { label: "Urban Street", scene: "A streetwear model leaning against a graffiti wall in Tokyo at night, neon lights reflect on the fabric.", motion: "Slow camera pan left." },
    { label: "Studio Minimal", scene: "Professional studio photography, white cyclorama background, soft box lighting.", motion: "Subtle zoom in." },
    { label: "Nature Hike", scene: "Hiker standing on a mountain peak during golden hour, lens flare.", motion: "Drone orbit shot." },
];

export default function ScenarioBuilder({ scenePrompt, motionPrompt, onSceneChange, onMotionChange }: ScenarioBuilderProps) {
    return (
        <div className="flex flex-col h-full bg-[#161b22] border-r border-gray-800 p-4">
            <h2 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">2. The Scenario</h2>

            {/* Presets */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {PRESETS.map(p => (
                    <button
                        key={p.label}
                        onClick={() => { onSceneChange(p.scene); onMotionChange(p.motion); }}
                        className="px-3 py-1 bg-[#21262d] hover:bg-[#30363d] rounded-full text-xs text-blue-400 whitespace-nowrap border border-blue-900/30"
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Scene Prompt */}
            <div className="mb-4 flex-1 flex flex-col">
                <label className="block text-xs text-gray-500 mb-2">Scene Context</label>
                <textarea
                    value={scenePrompt}
                    onChange={(e) => onSceneChange(e.target.value)}
                    className="w-full flex-1 bg-[#0d1117] border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none resize-none"
                    placeholder="Describe the environment, lighting, and model..."
                />
            </div>

            {/* Motion Prompt */}
            <div className="h-32 flex flex-col">
                <label className="block text-xs text-gray-500 mb-2">Camera Motion</label>
                <textarea
                    value={motionPrompt}
                    onChange={(e) => onMotionChange(e.target.value)}
                    className="w-full flex-1 bg-[#0d1117] border border-gray-700 text-white rounded p-3 text-sm focus:border-purple-500 outline-none resize-none cool-scrollbar"
                    placeholder="Describe camera movement..."
                />
            </div>
        </div>
    );
}
