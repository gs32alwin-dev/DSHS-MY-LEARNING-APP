
import React, { useState, useRef } from 'react';

interface AudioPlayerProps {
  audioData: Uint8Array | null;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const playAudio = async () => {
    if (!audioData) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    const ctx = audioContextRef.current;
    const dataInt16 = new Int16Array(audioData.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    source.start();
    
    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 group cursor-pointer" onClick={playAudio}>
        {isPlaying ? (
          <i className="fas fa-pause text-indigo-600 text-3xl"></i>
        ) : (
          <i className="fas fa-play text-indigo-600 text-3xl ml-1"></i>
        )}
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">
        {isPlaying ? 'Playing Audio Summary...' : 'Ready to Listen'}
      </h3>
      <p className="text-slate-500 text-center max-w-sm">
        Listen to a condensed AI-generated audio summary of this topic.
      </p>
    </div>
  );
};

export default AudioPlayer;
