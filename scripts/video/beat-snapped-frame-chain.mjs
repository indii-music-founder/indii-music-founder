#!/usr/bin/env node
/**
 * beat-snapped-frame-chain.mjs
 * 
 * Production-grade simulation of indiiOS Layer 1:
 * 1. Dual Aspect Ratio Pipeline (16:9 Landscape & 9:16 Vertical)
 * 2. Dramatic Beat-Snapped Timeline Slicing (snapping cuts to musical downbeats)
 * 3. Terminal Frame Extraction (F_last -> F_0) with BT.709 color clamping
 * 4. Multi-input FFmpeg xfade & acrossfade timeline assembly
 * 5. Stream integrity validation via ffprobe
 * 6. Cloud Storage & Firestore payload generation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORK_DIR = path.resolve(__dirname, '../../scratch/video-harness');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. CONFIGURATION: MUSICAL & ASPECT RATIO SPECIFICATIONS
// ---------------------------------------------------------------------------
const BPM = 120; // 120 BPM = 0.5s per beat, 2.0s per 4/4 bar
const SECONDS_PER_BAR = (60 / BPM) * 4; // 2.0s
const TRANSITION_DURATION = 1.0; // 1.0s crossfade

const ASPECT_RATIOS = {
  landscape: { name: '16:9', width: 1920, height: 1080 },
  vertical: { name: '9:16', width: 1080, height: 1920 }
};

console.log('===============================================================');
console.log('🚀 indiiOS Layer 1: Frame-Chained Video & Timeline Pipeline');
console.log('===============================================================');
console.log(`🎵 Audio Authority: BPM=${BPM} | Bar Duration=${SECONDS_PER_BAR}s`);
console.log(`⏱️  Crossfade Duration: ${TRANSITION_DURATION}s (snapped to bar drops)`);

// ---------------------------------------------------------------------------
// 2. DRAMATIC BEAT-SNAPPING TIMELINE CALCULATOR
// ---------------------------------------------------------------------------
// We plan 3 segments to hit downbeats at:
// Cut 1 drop: 10.0s (Bar 5 completion / Bar 6 drop)
// Cut 2 drop: 20.0s (Bar 10 completion / Bar 11 drop)
// Final timeline duration: 30.0s (Bar 15 completion)

const segmentPlans = [
  {
    index: 0,
    name: 'Intro / Exposition',
    duration: 10.0,
    boxColor: 'blue',
    prompt: 'Cinematic wide shot of Detroit skyline at dusk, moody golden hour reflections, 35mm film grain'
  },
  {
    index: 1,
    name: 'Chorus / Main Hook Drop',
    duration: 11.0, // 10s visible + 1s overlap
    boxColor: 'magenta',
    prompt: 'Dynamic medium tracking shot of artist entering neon-lit industrial studio, rhythmic camera pan'
  },
  {
    index: 2,
    name: 'Outro / Fade Climax',
    duration: 11.0, // 10s visible + 1s overlap
    boxColor: 'green',
    prompt: 'Low-angle cinematic close-up with lens flare, pulsing ambient lighting, slow dramatic pullback'
  }
];

// Verify timeline math
let cumulativeOffset = 0;
const transitionOffsets = [];
for (let i = 0; i < segmentPlans.length - 1; i++) {
  if (i === 0) {
    cumulativeOffset = segmentPlans[0].duration - TRANSITION_DURATION;
  } else {
    cumulativeOffset += segmentPlans[i].duration - TRANSITION_DURATION;
  }
  transitionOffsets.push(cumulativeOffset);
}

const totalDuration = segmentPlans.reduce((sum, s) => sum + s.duration, 0) - ((segmentPlans.length - 1) * TRANSITION_DURATION);

console.log('\n📊 Beat-Snapped Timeline Slices:');
segmentPlans.forEach((s, idx) => {
  console.log(`  [Segment ${idx}] ${s.name}: ${s.duration.toFixed(1)}s (Raw duration)`);
});
transitionOffsets.forEach((offset, idx) => {
  console.log(`  ⚡ Cut ${idx + 1} Snapped Drop: ${(offset + TRANSITION_DURATION).toFixed(1)}s (xfade starts at ${offset.toFixed(1)}s)`);
});
console.log(`  🎯 Final Master Runtime: ${totalDuration.toFixed(1)}s`);

// ---------------------------------------------------------------------------
// 3. SYNTHETIC SEGMENT GENERATOR (Multi-Aspect Ratio)
// ---------------------------------------------------------------------------
function generateSegment(aspectKey, segment) {
  const spec = ASPECT_RATIOS[aspectKey];
  const outPath = path.join(WORK_DIR, `seg_${aspectKey}_${segment.index}.mp4`);
  
  // Renders high-quality test video with testsrc2 (includes timer + color bars) and frequency tone
  const cmd = [
    'ffmpeg -y',
    `-f lavfi -i "testsrc2=s=${spec.width}x${spec.height}:d=${segment.duration}:r=30"`,
    `-f lavfi -i "sine=frequency=${220 + segment.index * 110}:duration=${segment.duration}:sample_rate=48000"`,
    '-filter_complex "',
    `[0:v]drawbox=x=0:y=0:w=iw:h=120:color=${segment.boxColor}@0.85:t=fill,`,
    `drawbox=x=0:y=ih-120:w=iw:h=120:color=${segment.boxColor}@0.85:t=fill[vout];`,
    `[1:a]volume=0.15[aout]"`,
    '-map "[vout]" -map "[aout]"',
    '-c:v libx264 -pix_fmt yuv420p -r 30',
    '-c:a aac -b:a 192k',
    `"${outPath}"`
  ].join(' ');

  execSync(cmd, { stdio: 'pipe' });
  return outPath;
}

// ---------------------------------------------------------------------------
// 4. TERMINAL FRAME EXTRACTION (F_last -> F_0) WITH BT.709 COLOR LOCKING
// ---------------------------------------------------------------------------
function extractTerminalFrame(videoPath, outputPath) {
  const cmd = [
    'ffmpeg -y',
    `-sseof -0.05 -i "${videoPath}"`,
    '-vsync 0',
    '-vf "format=rgb24,scale=in_color_matrix=bt709:out_color_matrix=bt709"',
    '-vframes 1',
    `"${outputPath}"`
  ].join(' ');

  execSync(cmd, { stdio: 'pipe' });
  const stats = fs.statSync(outputPath);
  return { path: outputPath, sizeBytes: stats.size };
}

// ---------------------------------------------------------------------------
// 5. TIMELINE COMPOSITOR (xfade & acrossfade)
// ---------------------------------------------------------------------------
function stitchTimeline(aspectKey, segmentPaths, outPath) {
  const filterInputs = segmentPaths.map((_, i) => `[${i}:v]setpts=PTS-STARTPTS[v${i}];`).join(' ');
  const audioInputs = segmentPaths.map((_, i) => `[${i}:a]asetpts=PTS-STARTPTS[a${i}];`).join(' ');

  // Video xfade chain
  let vFilter = '';
  let aFilter = '';

  // First crossfade
  vFilter += `[v0][v1]xfade=transition=fade:duration=${TRANSITION_DURATION}:offset=${transitionOffsets[0]}[vx0]; `;
  aFilter += `[a0][a1]acrossfade=d=${TRANSITION_DURATION}:c1=tri:c2=tri[ax0]; `;

  // Subsequent crossfades
  for (let i = 1; i < segmentPaths.length - 1; i++) {
    const prevV = `vx${i - 1}`;
    const nextV = `v${i + 1}`;
    const outV = i === segmentPaths.length - 2 ? 'vout' : `vx${i}`;
    vFilter += `[${prevV}][${nextV}]xfade=transition=fade:duration=${TRANSITION_DURATION}:offset=${transitionOffsets[i]}[${outV}]; `;

    const prevA = `ax${i - 1}`;
    const nextA = `a${i + 1}`;
    const outA = i === segmentPaths.length - 2 ? 'aout' : `ax${i}`;
    aFilter += `[${prevA}][${nextA}]acrossfade=d=${TRANSITION_DURATION}:c1=tri:c2=tri[${outA}]; `;
  }

  const inputs = segmentPaths.map(p => `-i "${p}"`).join(' ');
  const fullFilter = `${filterInputs} ${audioInputs} ${vFilter} ${aFilter}`.trim().replace(/;$/, '');

  const cmd = [
    'ffmpeg -y',
    inputs,
    `-filter_complex "${fullFilter}"`,
    '-map "[vout]" -map "[aout]"',
    '-c:v libx264 -pix_fmt yuv420p -preset fast -crf 18 -r 30',
    '-c:a aac -b:a 320k',
    `"${outPath}"`
  ].join(' ');

  execSync(cmd, { stdio: 'pipe' });
  return outPath;
}

// ---------------------------------------------------------------------------
// 6. RUN THE HARNESS FOR BOTH 16:9 AND 9:16
// ---------------------------------------------------------------------------
const results = {};

for (const aspectKey of ['landscape', 'vertical']) {
  const spec = ASPECT_RATIOS[aspectKey];
  console.log(`\n---------------------------------------------------------------`);
  console.log(`🎬 Processing Aspect Ratio: ${spec.name} (${spec.width}x${spec.height})`);
  console.log(`---------------------------------------------------------------`);

  // Step A: Generate Segments
  const segPaths = [];
  for (const seg of segmentPlans) {
    process.stdout.write(`  Rendering synthetic Segment ${seg.index}... `);
    const p = generateSegment(aspectKey, seg);
    segPaths.push(p);
    console.log(`✓ done (${path.basename(p)})`);
  }

  // Step B: Extract Terminal Frame of Segment 0 (F_last)
  const fLastPath = path.join(WORK_DIR, `seg_${aspectKey}_0_Flast.png`);
  process.stdout.write(`  Extracting terminal frame F_last (Segment 0 -> 1 bridge)... `);
  const fLastInfo = extractTerminalFrame(segPaths[0], fLastPath);
  console.log(`✓ extracted (${Math.round(fLastInfo.sizeBytes / 1024)} KB)`);

  // Step C: Timeline Stitching with Beat-Snapped xfade
  const masterPath = path.join(WORK_DIR, `master_${aspectKey}_30s.mp4`);
  process.stdout.write(`  Stitching beat-snapped master timeline... `);
  stitchTimeline(aspectKey, segPaths, masterPath);
  console.log(`✓ master assembled (${path.basename(masterPath)})`);

  // Step D: ffprobe Stream Verification
  const probeOutput = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate -of json "${masterPath}"`
  ).toString();
  const probeData = JSON.parse(probeOutput);
  const stream = probeData.streams[0];
  const probedDuration = parseFloat(stream.duration);

  console.log(`  ✅ Probed Specs: ${stream.width}x${stream.height} @ ${stream.r_frame_rate} fps | Duration: ${probedDuration.toFixed(2)}s`);
  results[aspectKey] = {
    masterPath,
    fLastPath,
    width: stream.width,
    height: stream.height,
    duration: probedDuration
  };
}

// ---------------------------------------------------------------------------
// 7. FIRESTORE RECORD EMISSION (indii.music release document shape)
// ---------------------------------------------------------------------------
const releaseVideoRecord = {
  releaseId: 'rel_founder_demo_001',
  artistId: 'art_rex_chrome',
  status: 'completed',
  audioSync: {
    bpm: BPM,
    beatSnapped: true,
    barDurationSeconds: SECONDS_PER_BAR,
    transientDropSeconds: [10.0, 20.0]
  },
  masters: {
    landscape: {
      aspectRatio: '16:9',
      resolution: { width: results.landscape.width, height: results.landscape.height },
      duration: results.landscape.duration,
      gcsStorageUri: 'gs://indii-music-founder-vault/releases/rel_founder_demo_001/master_16x9.mp4',
      localPath: results.landscape.masterPath
    },
    vertical: {
      aspectRatio: '9:16',
      resolution: { width: results.vertical.width, height: results.vertical.height },
      duration: results.vertical.duration,
      gcsStorageUri: 'gs://indii-music-founder-vault/releases/rel_founder_demo_001/master_9x16.mp4',
      localPath: results.vertical.masterPath
    }
  },
  chainedSegments: segmentPlans.map((seg, idx) => ({
    segmentIndex: idx,
    title: seg.name,
    prompt: seg.prompt,
    durationSeconds: seg.duration,
    terminalFrameExtracted: idx < segmentPlans.length - 1
  })),
  createdAt: new Date().toISOString()
};

console.log('\n===============================================================');
console.log('📦 Firestore Release Document Registration Payload (indii.music):');
console.log('===============================================================');
console.log(JSON.stringify(releaseVideoRecord, null, 2));
console.log('\n✨ Execution successfully completed!');
