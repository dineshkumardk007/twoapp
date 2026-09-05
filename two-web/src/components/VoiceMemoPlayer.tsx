import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Mic } from 'lucide-react';

interface VoiceMemoPlayerProps {
  audioDataUrl?: string;
  durationSeconds?: number;
  isFromCurrentPerspective: boolean;
}

export const VoiceMemoPlayer: React.FC<VoiceMemoPlayerProps> = ({
  audioDataUrl,
  durationSeconds = 12,
  isFromCurrentPerspective
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100%
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioDataUrl) {
      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
          setCurrentTime(audio.currentTime);
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
      };

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
  }, [audioDataUrl]);

  const togglePlay = () => {
    if (!audioRef.current && !audioDataUrl) {
      // Synthetic demo playback if no physical audio blob recorded
      setIsPlaying(!isPlaying);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // 18 calm waveform bar heights
  const bars = [28, 45, 70, 55, 80, 100, 65, 40, 60, 90, 75, 50, 85, 95, 60, 45, 30, 20];

  return (
    <div className="flex flex-col space-y-2 py-1 min-w-[220px]">
      <div className="flex items-center space-x-1.5 text-[11px] font-semibold tracking-wider uppercase opacity-80 mb-0.5">
        <Mic className="w-3 h-3 text-linen-accent" />
        <span>Whisper Note</span>
      </div>

      <div className="flex items-center space-x-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`p-2.5 rounded-full transition-all shadow-xs ${
            isFromCurrentPerspective
              ? 'bg-linen-surface text-linen-primary hover:bg-linen-variant'
              : 'bg-linen-primary text-linen-surface hover:opacity-90'
          }`}
          title={isPlaying ? 'Pause voice memo' : 'Listen to voice memo'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* Tactile Waveform Bars */}
        <div className="flex-1 flex items-center space-x-1 h-8 cursor-pointer" onClick={togglePlay}>
          {bars.map((heightPercent, idx) => {
            const barProgress = (idx / bars.length) * 100;
            const isPlayed = progress >= barProgress;
            return (
              <div
                key={idx}
                className="w-1 rounded-full transition-all duration-150"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: isPlayed
                    ? isFromCurrentPerspective
                      ? '#ffffff'
                      : 'var(--color-linen-primary, #2d2621)'
                    : isFromCurrentPerspective
                    ? 'rgba(255, 255, 255, 0.35)'
                    : 'rgba(0, 0, 0, 0.2)'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Progress Duration & Discrete Indicator */}
      <div className="flex items-center justify-between text-[10px] opacity-70 px-1 font-mono">
        <span>{formatSeconds(currentTime)}</span>
        <span>{formatSeconds(durationSeconds)}</span>
      </div>
    </div>
  );
};
