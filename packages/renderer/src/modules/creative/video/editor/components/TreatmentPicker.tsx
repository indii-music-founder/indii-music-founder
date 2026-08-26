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
        if (treatment.background) state.updateProjectSettings({ background: treatment.background });
        if (treatment.seam) state.updateProjectSettings({ seam: treatment.seam });
        if (treatment.entrance && treatment.entrance !== 'none') {
            for (const clip of state.project.clips) {
                if (clip.type !== 'text') continue;
                state.updateClip(clip.id, { entrance: { type: treatment.entrance } });
            }
        }
        if (treatment.audioFade) {
            for (const clip of state.project.clips) {
                if (clip.type === 'audio' || clip.hasAudio === true) {
                    state.updateClip(clip.id, { audioFade: treatment.audioFade });
                }
            }
        }
    };

    return (
        <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <span className="uppercase font-bold tracking-wide">Treatment</span>
            <select
                value=""
                onChange={handleChange}
                disabled={project.clips.length === 0}
                data-testid="video-treatment-picker"
                className={`bg-gray-800 border border-gray-700 text-gray-200 rounded-md px-2 py-1.5 text-xs ${project.clips.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500'}`}
                aria-label="Apply a cinematic treatment preset"
            >
                <option value="">None</option>
                {VIDEO_TREATMENT_PRESET_IDS.map(id => (
                    <option key={id} value={id}>{VIDEO_TREATMENT_PRESETS[id].label}</option>
                ))}
            </select>
        </label>
    );
};
