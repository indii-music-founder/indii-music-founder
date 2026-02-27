import React, { useState, useRef } from 'react';
import { Mic, Square, Send, Music, Loader2 } from 'lucide-react';

const FieldRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const uploadToStudio = async () => {
    if (!audioUrl) return;
    setIsUploading(true);
    
    // Simulate upload to indiiOS Studio
    // In production, this would use Firebase Storage or a specialized bridge
    setTimeout(() => {
      setIsUploading(false);
      alert('Voice memo sent to your indiiOS Studio! The Sonic Director will analyze it shortly.');
      setAudioUrl(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center space-y-8 shadow-2xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Field Recorder</h1>
          <p className="text-zinc-400">Capture inspiration anywhere. Sent directly to your studio.</p>
        </div>

        <div className="relative flex items-center justify-center">
          {isRecording && (
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-150" />
          )}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-600 scale-95' : 'bg-primary hover:bg-primary/90'
            } shadow-[0_0_30px_rgba(var(--primary),0.3)]`}
          >
            {isRecording ? <Square size={40} fill="white" /> : <Mic size={48} />}
          </button>
        </div>

        <div className="h-12 flex items-center justify-center">
          {isRecording ? (
            <div className="flex items-center gap-2 text-red-500 font-mono font-bold animate-pulse">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              RECORDING...
            </div>
          ) : audioUrl ? (
            <div className="text-primary font-medium flex items-center gap-2">
              <Music size={18} /> Memo Captured
            </div>
          ) : (
            <div className="text-zinc-500 text-sm">Tap to record</div>
          )}
        </div>

        {audioUrl && !isRecording && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <audio src={audioUrl} controls className="w-full h-10 filter invert opacity-80" />
            <button
              onClick={uploadToStudio}
              disabled={isUploading}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
              {isUploading ? 'SENDING...' : 'SEND TO STUDIO'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 text-zinc-600 text-[10px] uppercase tracking-widest font-mono">
        Sovereign Field Protocol v1.0
      </div>
    </div>
  );
};

export default FieldRecorder;
