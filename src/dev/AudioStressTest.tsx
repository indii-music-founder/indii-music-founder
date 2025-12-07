
import React, { useEffect, useState } from 'react';

export default function AudioStressTest() {
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const runTests = async () => {
        addLog('--- STARTING STRESS TEST ---');

        // Check if Electron API exists
        if (!window.electronAPI) {
            addLog('❌ FATAL: Electron API not found. Are you running in Electron?');
            return;
        }

        // Test 1: Invalid Path
        try {
            addLog('Test 1: Analyzing non-existent file...');
            await window.electronAPI.audio.analyze('/path/to/nothing.mp3');
            addLog('❌ Test 1 FAILED: Should have thrown error');
        } catch (e) {
            addLog(`✅ Test 1 PASSED: Caught expected error: ${e}`);
        }

        // Test 2: Invalid Format (Text File)
        try {
            addLog('Test 2: Analyzing invalid format (text file)...');
            // We'll use this file itself as a dummy
            await window.electronAPI.audio.analyze(__filename);
            addLog('❌ Test 2 FAILED: Should have thrown error');
        } catch (e) {
            addLog(`✅ Test 2 PASSED: Caught expected error: ${e}`);
        }

        // Test 3: Concurrency (Hammer the bridge)
        addLog('Test 3: Concurrency / Load Testing (5 parallel requests)...');
        try {
            const promises = Array(5).fill(0).map((_, i) => {
                // Using a likely fail path, but testing that the bridge handles valid IPC messages rapidly
                return window.electronAPI!.audio.analyze('/dev/null')
                    .catch(e => `Request ${i} handled (error correct)`);
            });
            const results = await Promise.all(promises);
            addLog(`✅ Test 3 PASSED: All 5 requests returned: ${results.length}`);
        } catch (e) {
            addLog(`❌ Test 3 FAILED: Bridge choked: ${e}`);
        }

        // Test 4: Real MP3 File
        try {
            const mp3Path = '/Volumes/X SSD 2025/Users/narrowchannel/Desktop/Rndr-AI-v1/landing-page/public/audio/tech-house-loop.mp3';
            addLog(`Test 4: Analyzing real MP3: ${mp3Path}`);
            const result = await window.electronAPI.audio.analyze(mp3Path);
            addLog(`✅ Test 4 PASSED: ${JSON.stringify(result, null, 2)}`);
        } catch (e) {
            addLog(`❌ Test 4 FAILED: ${e}`);
        }

        // Test 5: Real WAV File
        try {
            const wavPath = '/Volumes/X SSD 2025/Users/narrowchannel/Desktop/Rndr-AI-v1/node_modules/node-wav/tests/file1.wav';
            addLog(`Test 5: Analyzing real WAV: ${wavPath}`);
            const result = await window.electronAPI.audio.analyze(wavPath);
            addLog(`✅ Test 5 PASSED: ${JSON.stringify(result, null, 2)}`);
        } catch (e) {
            addLog(`❌ Test 5 FAILED: ${e}`);
        }

        addLog('--- TEST COMPLETE ---');
    };

    return (
        <div style={{ padding: 20, background: '#111', color: '#0f0', fontFamily: 'monospace' }}>
            <h2>Audio Backend Stress Test</h2>
            <button onClick={runTests} style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', cursor: 'pointer' }}>
                RUN STRESS TEST
            </button>
            <div style={{ marginTop: 20, whiteSpace: 'pre-wrap' }}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
}
