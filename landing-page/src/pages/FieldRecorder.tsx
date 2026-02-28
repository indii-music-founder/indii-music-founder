import React, { useState, useRef, useEffect } from 'react';

type RecordingState = 'idle' | 'recording' | 'stopped';

export default function FieldRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setError(null);
    } catch {
      setError('Microphone access denied. Please allow microphone access to use Field Recorder.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecordingState('stopped');
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingState('idle');
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold mb-2">Field Recorder</h1>
      <p className="text-gray-400 mb-12">Capture audio in the field</p>

      {error && (
        <p className="text-red-400 mb-6 text-sm text-center max-w-sm">{error}</p>
      )}

      <div className="flex flex-col items-center gap-6">
        {recordingState === 'idle' && (
          <button
            onClick={startRecording}
            className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center text-white text-sm font-medium"
          >
            Record
          </button>
        )}

        {recordingState === 'recording' && (
          <button
            onClick={stopRecording}
            className="w-24 h-24 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center text-white text-sm font-medium animate-pulse"
          >
            Stop
          </button>
        )}

        {recordingState === 'stopped' && audioUrl && (
          <div className="flex flex-col items-center gap-4">
            <audio controls src={audioUrl} className="w-72" />
            <div className="flex gap-4">
              <a
                href={audioUrl}
                download="field-recording.webm"
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors"
              >
                Download
              </a>
              <button
                onClick={reset}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                New Recording
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
