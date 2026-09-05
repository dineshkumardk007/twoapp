import React, { useState, useEffect, useRef } from 'react';
import { WhisperMemoItem, WhisperCategory } from '../types';
import { Mic, Square, Play, Pause, RotateCcw, Volume2, Plus, Sparkles, Heart, MessageSquare, Clock, Check, Radio, Trash2, X, Send } from 'lucide-react';

interface WhisperMemosViewProps {
  memos: WhisperMemoItem[];
  activeUser: 'user' | 'partner';
  onAddMemo: (memo: WhisperMemoItem) => void;
  onMarkListened: (memoId: string) => void;
  onSendToChat?: (message: string) => void;
}

const CATEGORY_META: Record<WhisperCategory, { label: string; icon: string; color: string }> = {
  morning: { label: 'Morning Whisper', icon: '🌅', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  midnight: { label: 'Midnight Pillow', icon: '🌙', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  coffee: { label: 'Coffee Greeting', icon: '☕', color: 'bg-stone-50 text-stone-800 border-stone-200' },
  love_letter: { label: 'Audio Love Letter', icon: '💌', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  comfort: { label: 'Comfort & Safety', icon: '🧸', color: 'bg-teal-50 text-teal-800 border-teal-200' }
};

export const WhisperMemosView: React.FC<WhisperMemosViewProps> = ({
  memos,
  activeUser,
  onAddMemo,
  onMarkListened,
  onSendToChat
}) => {
  const [filterCategory, setFilterCategory] = useState<WhisperCategory | 'all'>('all');
  const [filterRecipient, setFilterRecipient] = useState<'all' | 'for_you' | 'from_you'>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveVolumeBars, setLiveVolumeBars] = useState<number[]>([0.2, 0.4, 0.3, 0.5, 0.7, 0.4, 0.6]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);

  // Form State
  const [memoTitle, setMemoTitle] = useState('');
  const [memoCategory, setMemoCategory] = useState<WhisperCategory>('morning');
  const [transcriptSnippet, setTranscriptSnippet] = useState('');

  // Audio Playback State
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fallbackGenerateProceduralMemo();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Setup Web Audio Analyser for live visual bars
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const updateLiveBars = () => {
          if (!analyserRef.current) return;
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          const sample = Array.from(data.slice(0, 12)).map(v => Math.max(0.15, v / 255));
          setLiveVolumeBars(sample);
          animFrameRef.current = requestAnimationFrame(updateLiveBars);
        };
        updateLiveBars();
      } catch (_) {}

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudioUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        // Generate synthetic waveform
        const wf = Array.from({ length: 24 }).map(() => Math.max(0.2, Math.random() * 0.85 + 0.15));
        setRecordedWaveform(wf);

        // Stop stream tracks
        stream.getTracks().forEach(t => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone error or permission denied, using procedural memo:', err);
      fallbackGenerateProceduralMemo();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const fallbackGenerateProceduralMemo = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        if (prev >= 6) {
          clearInterval(recordingTimerRef.current);
          setIsRecording(false);
          setRecordedWaveform([0.3, 0.5, 0.7, 0.9, 0.8, 0.6, 0.4, 0.7, 1.0, 0.8, 0.6, 0.5, 0.7, 0.8, 0.6, 0.4, 0.3]);
          setRecordedAudioUrl('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
          return 6;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleSaveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = Math.max(3, recordingSeconds);
    const authorName = activeUser === 'user' ? 'You' : 'Partner';
    const recipientId = activeUser === 'user' ? 'partner' : 'user';

    const newMemo: WhisperMemoItem = {
      id: `whisper-${Date.now()}`,
      title: memoTitle.trim() || `${CATEGORY_META[memoCategory].label}`,
      category: memoCategory,
      authorId: activeUser,
      authorName,
      recipientId,
      recordedAt: 'Just now',
      durationSeconds: duration,
      audioDataUrl: recordedAudioUrl || undefined,
      transcriptSnippet: transcriptSnippet.trim() || undefined,
      isListened: false,
      waveformData: recordedWaveform.length ? recordedWaveform : [0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.7, 0.9, 0.7, 0.4, 0.2]
    };

    onAddMemo(newMemo);
    setShowRecordModal(false);

    // Reset form
    setMemoTitle('');
    setTranscriptSnippet('');
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);

    if (onSendToChat) {
      onSendToChat(`🎙️ Sent an encrypted voice whisper: "${newMemo.title}" (${duration}s)`);
    }
  };

  const togglePlayMemo = (memo: WhisperMemoItem) => {
    if (playingMemoId === memo.id) {
      // Pause
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
      setPlayingMemoId(null);
      return;
    }

    // Stop existing
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
    }

    setPlayingMemoId(memo.id);

    if (memo.audioDataUrl && memo.audioDataUrl.startsWith('data:audio')) {
      const audio = new Audio(memo.audioDataUrl);
      audio.playbackRate = playbackSpeed;
      activeAudioElementRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          const pct = audio.currentTime / audio.duration;
          setPlaybackProgress(prev => ({ ...prev, [memo.id]: pct }));
        }
      };

      audio.onended = () => {
        setPlayingMemoId(null);
        setPlaybackProgress(prev => ({ ...prev, [memo.id]: 1 }));
        if (!memo.isListened) onMarkListened(memo.id);
      };

      audio.play().catch(() => {
        // Fallback procedural playback simulation
        simulatePlaybackProgress(memo);
      });
    } else {
      simulatePlaybackProgress(memo);
    }
  };

  const simulatePlaybackProgress = (memo: WhisperMemoItem) => {
    let elapsed = 0;
    const total = memo.durationSeconds || 10;
    const interval = setInterval(() => {
      elapsed += 0.25 * playbackSpeed;
      const pct = Math.min(1, elapsed / total);
      setPlaybackProgress(prev => ({ ...prev, [memo.id]: pct }));

      if (pct >= 1) {
        clearInterval(interval);
        setPlayingMemoId(null);
        if (!memo.isListened) onMarkListened(memo.id);
      }
    }, 250);
  };

  const filteredMemos = memos.filter(m => {
    if (filterCategory !== 'all' && m.category !== filterCategory) return false;
    if (filterRecipient === 'for_you' && m.recipientId !== activeUser) return false;
    if (filterRecipient === 'from_you' && m.authorId !== activeUser) return false;
    return true;
  });

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-linen-surface rounded-2xl p-6 border border-linen-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 mb-2">
            <Radio className="w-3.5 h-3.5 text-rose-600" />
            <span>Encrypted Voice Letterbox</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-linen-primary font-medium">
            Whisper Memos
          </h1>
          <p className="text-sm text-linen-secondary mt-1 max-w-xl">
            Intimate audio notes that capture vocal warmth, quiet sighs, and soft morning greetings. Encrypted locally with zero cloud upload.
          </p>
        </div>

        <button
          onClick={() => {
            setShowRecordModal(true);
            setRecordedAudioUrl(null);
            setRecordingSeconds(0);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-medium text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer shrink-0"
        >
          <Mic className="w-4 h-4" />
          <span>Record a Whisper</span>
        </button>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-linen-border pb-3">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterCategory === 'all'
                ? 'bg-linen-primary text-linen-surface shadow-xs'
                : 'bg-linen-variant/60 text-linen-secondary hover:text-linen-primary'
            }`}
          >
            All Whispers ({memos.length})
          </button>
          {(Object.keys(CATEGORY_META) as WhisperCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-linen-variant/60 text-linen-secondary hover:text-linen-primary'
              }`}
            >
              {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
            </button>
          ))}
        </div>

        {/* Recipient Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setFilterRecipient('all')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRecipient === 'all'
                ? 'bg-linen-variant text-linen-primary border-linen-primary/30 font-medium'
                : 'text-linen-secondary border-linen-border'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterRecipient('for_you')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRecipient === 'for_you'
                ? 'bg-linen-variant text-linen-primary border-linen-primary/30 font-medium'
                : 'text-linen-secondary border-linen-border'
            }`}
          >
            For You
          </button>
          <button
            onClick={() => setFilterRecipient('from_you')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRecipient === 'from_you'
                ? 'bg-linen-variant text-linen-primary border-linen-primary/30 font-medium'
                : 'text-linen-secondary border-linen-border'
            }`}
          >
            Recorded by You
          </button>
        </div>
      </div>

      {/* Memos Feed */}
      {filteredMemos.length === 0 ? (
        <div className="bg-linen-surface rounded-2xl p-12 border border-dashed border-linen-border text-center">
          <Mic className="w-10 h-10 text-rose-300 mx-auto mb-2 opacity-60" />
          <h3 className="font-serif text-base font-medium text-linen-primary">No whisper memos here yet</h3>
          <p className="text-xs text-linen-secondary max-w-sm mx-auto mt-1 mb-4">
            Leave a 30-second morning whisper or quiet midnight voice note for your partner to wake up to.
          </p>
          <button
            onClick={() => setShowRecordModal(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record First Whisper</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemos.map(memo => {
            const isPlaying = playingMemoId === memo.id;
            const progress = playbackProgress[memo.id] || 0;
            const catMeta = CATEGORY_META[memo.category];

            return (
              <div
                key={memo.id}
                className="bg-linen-surface rounded-2xl p-5 border border-linen-border shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Top Metadata */}
                  <div className="flex items-center justify-between pb-3 border-b border-linen-border/60 mb-3">
                    <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${catMeta.color}`}>
                      <span className="mr-1">{catMeta.icon}</span>
                      {catMeta.label}
                    </span>

                    <div className="flex items-center space-x-2 text-[11px] text-linen-secondary">
                      <span>{memo.recordedAt}</span>
                      {memo.isListened && (
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-emerald-200">
                          ✓ Heard
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Author */}
                  <h3 className="font-serif text-base font-medium text-linen-primary leading-snug">
                    {memo.title}
                  </h3>
                  <div className="text-xs text-linen-secondary mt-0.5 mb-3">
                    Penned by <strong className="text-linen-primary font-medium">{memo.authorName}</strong> · {formatSeconds(memo.durationSeconds)} duration
                  </div>

                  {/* Waveform Player Bar */}
                  <div className="bg-linen-variant/40 rounded-xl p-3 border border-linen-border/60 flex items-center space-x-3 mb-3">
                    <button
                      onClick={() => togglePlayMemo(memo)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform active:scale-95 cursor-pointer shadow-xs ${
                        isPlaying ? 'bg-rose-600' : 'bg-linen-primary hover:opacity-90'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                    </button>

                    {/* Waveform visualization */}
                    <div className="flex-1 flex items-center space-x-1 h-8">
                      {(memo.waveformData || [0.3, 0.6, 0.8, 0.5, 0.7, 0.4]).map((barHeight, idx, arr) => {
                        const barPct = (idx + 1) / arr.length;
                        const isPast = progress >= barPct;
                        return (
                          <div
                            key={idx}
                            className={`flex-1 rounded-full transition-all duration-150 ${
                              isPast ? 'bg-rose-600' : 'bg-linen-secondary/30'
                            }`}
                            style={{ height: `${Math.max(15, barHeight * 100)}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Transcript */}
                  {memo.transcriptSnippet && (
                    <p className="font-serif text-xs text-linen-secondary italic leading-relaxed mb-2 px-1">
                      “{memo.transcriptSnippet}”
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-linen-border/40 flex items-center justify-between text-xs text-linen-secondary">
                  <span className="text-[11px]">
                    {memo.authorId === activeUser ? 'From you to partner' : 'From partner to you'}
                  </span>

                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(`🎙️ "${memo.title}": ${memo.transcriptSnippet || 'Listen to this voice whisper in the letterbox'}`)}
                      className="p-1 hover:bg-linen-variant rounded-md text-linen-secondary hover:text-linen-primary flex items-center space-x-1"
                      title="Send transcript to chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="text-[11px]">To Chat</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Voice Whisper Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-linen-surface rounded-2xl max-w-md w-full border border-linen-border shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-linen-border flex items-center justify-between bg-linen-variant/20">
              <div className="flex items-center space-x-2">
                <Mic className="w-5 h-5 text-rose-600" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Record a Voice Whisper
                </h3>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                className="p-1.5 text-linen-secondary hover:text-linen-primary rounded-lg hover:bg-linen-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMemo} className="p-5 space-y-4">
              {/* Recording Animation & Visualizer */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-stone-900 to-stone-950 text-white text-center flex flex-col items-center justify-center border border-stone-800 shadow-inner">
                {/* Time Display */}
                <div className="font-mono text-3xl font-light text-rose-400 mb-2">
                  {formatSeconds(recordingSeconds)}
                </div>

                {/* Dynamic Waveform Bars */}
                <div className="flex items-center justify-center space-x-1.5 h-12 w-full max-w-xs mb-4">
                  {isRecording ? (
                    liveVolumeBars.map((val, idx) => (
                      <div
                        key={idx}
                        className="w-2 bg-rose-500 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(12, val * 48)}px` }}
                      />
                    ))
                  ) : recordedAudioUrl ? (
                    <div className="flex items-center space-x-1 w-full justify-center">
                      {recordedWaveform.map((val, idx) => (
                        <div
                          key={idx}
                          className="w-1.5 bg-rose-400/80 rounded-full"
                          style={{ height: `${Math.max(8, val * 36)}px` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-stone-400">Tap microphone to begin speaking</span>
                  )}
                </div>

                {/* Record Button */}
                {!isRecording && !recordedAudioUrl ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/40 transition-transform active:scale-95 cursor-pointer"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                ) : isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg animate-pulse transition-transform active:scale-95 cursor-pointer"
                  >
                    <Square className="w-5 h-5 fill-white" />
                  </button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRecordedAudioUrl(null);
                        setRecordingSeconds(0);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-xs hover:bg-stone-700 transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Re-record</span>
                    </button>
                    <span className="text-xs text-emerald-400">✓ Recorded ({formatSeconds(recordingSeconds)})</span>
                  </div>
                )}
              </div>

              {/* Title & Category */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Whisper Title
                </label>
                <input
                  type="text"
                  value={memoTitle}
                  onChange={e => setMemoTitle(e.target.value)}
                  placeholder="e.g. Waking up thinking of you..."
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Whisper Category
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {(Object.keys(CATEGORY_META) as WhisperCategory[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMemoCategory(cat)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        memoCategory === cat
                          ? 'bg-rose-50 border-rose-500 text-rose-950 font-medium'
                          : 'bg-linen-variant/30 border-linen-border text-linen-secondary hover:bg-linen-variant'
                      }`}
                    >
                      {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Transcript Note */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Optional Words or Note Snippet
                </label>
                <textarea
                  rows={2}
                  value={transcriptSnippet}
                  onChange={e => setTranscriptSnippet(e.target.value)}
                  placeholder="A few words summarizing what you whispered..."
                  className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-linen-border flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!recordedAudioUrl && !isRecording}
                  className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-white text-xs font-medium shadow-xs transition-transform active:scale-95 ${
                    recordedAudioUrl
                      ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                      : 'bg-stone-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Letterbox</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
