import React from 'react';

import { useVideoEditorStore } from '../../store/videoEditorStore';
import {
    resolveTreatment,
    VIDEO_TREATMENT_PRESETS,
    VIDEO_TREATMENT_PRESET_IDS,
    type VideoTreatmentPresetId,
} from '@/services/video/treatmentPresets';

/**
 * Toolbar treatment picker — the user-facing surface for the cinematic
 * treatment presets. Applies the same resolver the Conductor's
 * `apply_video_treatment` tool uses, so a pick and a chat instruction
 * produce identical projects.
 */
export const TreatmentPicker: React.FC = () => {
    const project = useVideoEditorStore(state => state.project);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        if (value === '') return;
        const presetId = value as VideoTreatmentPresetId;
        const treatment = resolveTreatment({ preset: presetId });
        const state = useVideoEditorStore.getState();
        const clips = state.project.clips.map(clip => {
            if (clip.type === 'text' && treatment.entrance && treatment.entrance !== 'none') {
                return { ...clip, entrance: { type: treatment.entrance } };
            }
            if (treatment.audioFade && (clip.type === 'audio' || clip.hasAudio === true)) {
                return { ...clip, audioFade: treatment.audioFade };
            }
            return clip;
        });

        state.updateProjectSettings({
            treatmentPresetId: presetId,
            ...(treatment.background ? { background: treatment.background } : {}),
            ...(treatment.seam ? { seam: treatment.seam } : {}),
            clips,
        });
    };

    return (
        <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <span className="uppercase font-bold tracking-wide">Treatment</span>
            <select
                value={project.treatmentPresetId ?? ''}
                onChange={handleChange}
                disabled={project.clips.length === 0}
                data-testid="video-treatment-picker"
                className={`bg-gray-800 border border-gray-700 text-gray-200 rounded-md px-2 py-1.5 text-xs ${project.clips.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500'}`}
                aria-label="Apply a cinematic treatment preset"
            >
                <option value="">Choose treatment…</option>
                {VIDEO_TREATMENT_PRESET_IDS.map(id => (
                    <option key={id} value={id}>{VIDEO_TREATMENT_PRESETS[id].label}</option>
                ))}
            </select>
        </label>
    );
};
