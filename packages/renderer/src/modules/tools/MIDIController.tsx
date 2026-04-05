import React, { useState, useCallback } from 'react';
import { Music2, Zap, Activity, Wifi, WifiOff, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MIDIDevice {
    id: string;
    name: string;
    manufacturer: string;
    type: 'input' | 'output';
    state: 'connected' | 'disconnected';
}

interface MIDIEvent {
    channel: number;
    type: string;
    note?: number;
    velocity?: number;
    controller?: number;
    value?: number;
    timestamp: number;
}

function noteName(n: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${notes[n % 12]}${Math.floor(n / 12) - 1}`;
}

function parseMIDI(data: Uint8Array): Omit<MIDIEvent, 'timestamp'> {
    const status = data[0]!;
    const channel = (status & 0x0F) + 1;
    const type = status & 0xF0;

    if (type === 0x90 && data[2]! > 0) {
        return { channel, type: 'Note On', note: data[1]!, velocity: data[2]! };
    }
    if (type === 0x80 || (type === 0x90 && data[2] === 0)) {
        return { channel, type: 'Note Off', note: data[1], velocity: data[2] };
    }
    if (type === 0xB0) {
        return { channel, type: 'CC', controller: data[1], value: data[2] };
    }
    if (type === 0xE0) {
        const pb = ((data[2]! << 7) | data[1]!) - 8192;
        return { channel, type: 'Pitch Bend', value: pb };
    }
    return { channel, type: `0x${type.toString(16).toUpperCase()}` };
}

export default function MIDIController() {
    const [supported] = useState(() => 'requestMIDIAccess' in navigator);
    const [devices, setDevices] = useState<MIDIDevice[]>([]);
    const [events, setEvents] = useState<MIDIEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);

    const refreshDevices = useCallback((access: MIDIAccess) => {
        const list: MIDIDevice[] = [];
        access.inputs.forEach(input => {
            list.push({
                id: input.id,
                name: input.name || 'Unknown Input',
                manufacturer: input.manufacturer || '',
                type: 'input',
                state: input.state as 'connected' | 'disconnected',
            });
        });
        access.outputs.forEach(output => {
            list.push({
                id: output.id,
                name: output.name || 'Unknown Output',
                manufacturer: output.manufacturer || '',
                type: 'output',
                state: output.state as 'connected' | 'disconnected',
            });
        });
        setDevices(list);
    }, []);

    const handleConnect = useCallback(async () => {
        if (!navigator.requestMIDIAccess) return;
        try {
            const access = await navigator.requestMIDIAccess({ sysex: false });
            setMidiAccess(access);
            setConnected(true);
            refreshDevices(access);

            // Wire up message handlers
            access.inputs.forEach(input => {
                input.onmidimessage = (msg) => {
                    if (!msg.data) return;
                    const parsed = parseMIDI(msg.data as Uint8Array);
                    setEvents(prev => [{ ...parsed, timestamp: msg.timeStamp }, ...prev].slice(0, 50));
                };
            });

            // State change listener
            access.onstatechange = () => refreshDevices(access);
        } catch {
            // User denied MIDI access
        }
    }, [refreshDevices]);

    const connectedInputs = devices.filter(d => d.type === 'input' && d.state === 'connected');

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-white tracking-tighter uppercase">
                        Hardware MIDI
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        WebMIDI API — connect physical gear to your workflows
                    </p>
                </div>
                {!supported && (
                    <span className="text-xs text-red-400 font-bold">WebMIDI not supported in this browser</span>
                )}
            </div>

            {/* Status card */}
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${connected ? 'bg-green-500/5 border-green-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                {connected ? (
                    <Wifi size={20} className="text-green-400" />
                ) : (
                    <WifiOff size={20} className="text-gray-500" />
                )}
                <div className="flex-1">
                    <p className="text-sm font-bold text-white">
                        {connected ? `${connectedInputs.length} input(s) active` : 'Not connected'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                        {connected ? 'Listening for MIDI messages' : 'Click connect to request WebMIDI access'}
                    </p>
                </div>
                {!connected && supported && (
                    <button
                        onClick={handleConnect}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        Connect
                    </button>
                )}
            </div>

            {/* Devices */}
            {devices.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                        Devices ({devices.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {devices.map(d => (
                            <div key={d.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-3 flex items-center gap-3">
                                {d.type === 'input' ? (
                                    <Activity size={16} className="text-purple-400 flex-shrink-0" />
                                ) : (
                                    <Sliders size={16} className="text-blue-400 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{d.name}</p>
                                    <p className="text-[10px] text-gray-500">{d.manufacturer || d.type}</p>
                                </div>
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.state === 'connected' ? 'bg-green-500' : 'bg-gray-600'}`} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Event Monitor */}
            <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Zap size={10} />
                    Live Event Monitor
                    {events.length > 0 && (
                        <button onClick={() => setEvents([])} className="ml-auto text-gray-600 hover:text-gray-400 text-[10px] font-normal">
                            Clear
                        </button>
                    )}
                </h3>
                <div className="rounded-xl bg-black/30 border border-white/5 p-3 font-mono text-[11px] min-h-[120px] max-h-[280px] overflow-y-auto space-y-1 custom-scrollbar">
                    {events.length === 0 ? (
                        <p className="text-gray-600 text-center mt-8">
                            {connected ? 'Play a note or move a knob…' : 'Connect a MIDI device to see events'}
                        </p>
                    ) : (
                        <AnimatePresence initial={false}>
                            {events.map((e, i) => (
                                <motion.div
                                    key={`${e.timestamp}-${i}`}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 text-[10px]"
                                >
                                    <span className="text-gray-600 w-20 flex-shrink-0">
                                        {e.timestamp.toFixed(0)}ms
                                    </span>
                                    <span className={`font-bold w-20 flex-shrink-0 ${
                                        e.type === 'Note On' ? 'text-green-400' :
                                        e.type === 'Note Off' ? 'text-red-400' :
                                        e.type === 'CC' ? 'text-yellow-400' : 'text-blue-400'
                                    }`}>
                                        {e.type}
                                    </span>
                                    <span className="text-gray-400">Ch {e.channel}</span>
                                    {e.note !== undefined && (
                                        <span className="text-purple-300">{noteName(e.note)} (vel {e.velocity})</span>
                                    )}
                                    {e.controller !== undefined && (
                                        <span className="text-purple-300">CC{e.controller} = {e.value}</span>
                                    )}
                                    {e.type === 'Pitch Bend' && (
                                        <span className="text-purple-300">{e.value}</span>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {!supported && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                    <p className="text-xs text-amber-400 font-bold">WebMIDI API Not Available</p>
                    <p className="text-[10px] text-amber-400/60 mt-1">
                        WebMIDI is supported in Chromium-based browsers. In the Electron desktop app, it's available by default.
                    </p>
                </div>
            )}
        </div>
    );
}
