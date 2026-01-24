
import { WhiskService } from '@/services/WhiskService';
import { STYLE_PRESETS } from '@/modules/creative/components/whisk/WhiskPresetStyles';
import { WhiskState } from '@/core/store/slices/creativeSlice';

async function runVerification() {
    console.log('🧪 Starting Whisk Video Verification...');

    // 1. Setup Mock Whisk State
    const mockState: WhiskState = {
        subjects: [{
            id: 's1', type: 'text', checked: true, category: 'subject',
            content: 'A futuristic cyborg singer'
        }],
        scenes: [{
            id: 'sc1', type: 'text', checked: true, category: 'scene',
            content: 'Neon lit cyberpunk stage'
        }],
        styles: [{
            id: 'st1', type: 'text', checked: true, category: 'style',
            content: 'Cinematic music video aesthetic, dramatic lighting, film grain, 16:9 composition, storytelling mood, professional color grading'
            // Matching the Music Video preset prompt exactly
        }],
        motion: [{
            id: 'm1', type: 'text', checked: true, category: 'motion',
            content: 'Slow motion orbital camera, high energy'
        }],
        activePresets: [],
        preciseReference: false,
        targetMedia: 'video'
    };

    // 2. Test Prompt Synthesis
    console.log('\n--- Testing Prompt Synthesis ---');
    const synthesizedPrompt = WhiskService.synthesizeVideoPrompt('Singing into microphone', mockState);
    console.log('Synthesized Prompt:', synthesizedPrompt);

    const hasSubject = synthesizedPrompt.includes('A futuristic cyborg singer');
    const hasScene = synthesizedPrompt.includes('Neon lit cyberpunk stage');
    const hasMotion = synthesizedPrompt.includes('Slow motion orbital camera');
    const hasVideoKeywords = synthesizedPrompt.includes('Cinematic quality');

    if (hasSubject && hasScene && hasMotion && hasVideoKeywords) {
        console.log('✅ Prompt synthesis passed!');
    } else {
        console.error('❌ Prompt synthesis failed missing keywords');
        console.log({ hasSubject, hasScene, hasMotion, hasVideoKeywords });
    }

    // 3. Test Parameter Extraction
    console.log('\n--- Testing Parameter Extraction ---');
    const params = await WhiskService.getVideoParameters(mockState);
    console.log('Extracted Params:', params);

    // Music Video preset has: duration 8, aspectRatio 16:9, motionIntensity 'high'
    // Motion content "Slow motion... high energy" should trigger 'high' intensity heuristic if not overridden

    const matchingPreset = STYLE_PRESETS.find(p => p.id === 'music-video');

    if (params.aspectRatio === '16:9' && params.duration === 8) {
        console.log('✅ Parameter extraction passed!');
    } else {
        console.error('❌ Parameter extraction failed');
        console.log('Expected:', { aspectRatio: '16:9', duration: 8 });
        console.log('Received:', params);
    }

    console.log('\n✨ Verification Complete');
}

runVerification().catch(console.error);
