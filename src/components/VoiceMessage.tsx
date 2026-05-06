import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

interface VoiceMessageProps {
  audioUrl: string;
  duration?: string;
  size?: string;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({ audioUrl, duration, size }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [derivedDuration, setDerivedDuration] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      barHeight: 0.8,
      waveColor: '#ff0000',
      progressColor: '#3b82f6',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 30,
      url: audioUrl,
    });

    waveSurferRef.current = ws;

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    // Derive duration from the audio itself as fallback
    ws.on('ready', () => {
      const secs = ws.getDuration();
      if (secs > 0) {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        setDerivedDuration(`${m}:${s.toString().padStart(2, '0')}`);
      }
    });

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    waveSurferRef.current?.playPause();
  };

  // Prefer the prop if it looks like a real value, otherwise fall back to what WaveSurfer measured
  const isBlankDuration = !duration || duration === '0:00' || duration === '00:00';
  const displayDuration = isBlankDuration ? (derivedDuration ?? '0:00') : duration;

  return (
    <div className="flex items-center gap-3 min-w-[280px] w-full p-1">
      <button
        onClick={handlePlayPause}
        className="flex-shrink-0 w-11 h-11 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-all active:scale-90"
      >
        {isPlaying ? (
          <Pause size={22} fill="white" className="text-white" />
        ) : (
          <Play size={22} fill="white" className="text-white ml-1" />
        )}
      </button>

      <div className="flex flex-col flex-grow">
        <div ref={containerRef} className="w-full cursor-pointer" />

        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-blue-300/80">
          <span>{displayDuration}</span>
          <div className="w-2 h-2 bg-blue-400 rounded-full ml-0.5" />
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;
