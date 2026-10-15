import React, { useState, useEffect, useRef } from 'react';
import { WhisperMemoItem, WhisperCategory } from '../types';
import { Mic, Square, Play, Pause, RotateCcw, Volume2, Plus, Sparkles, Heart, MessageSquare, Clock, Check, Radio, Trash2, X, Send } from 'lucide-react';
import { newId } from '../core/ids';
import { whenLabel } from '../core/when';
import { who } from '../core/who';
import { MAX_RECORD_BYTES, recordSizeOf } from '../core/ws';
import {
  canRecordVoice,
  claimVoicePlayback,
  holdRadioDown,
  markWaitingForMic,
  startVoiceRecording,
  summarizePeaks,
  VoiceRecording
} from '../core/voice';
import { useBackLayer } from '../core/backStack';

interface WhisperMemosViewProps {
  memos: WhisperMemoItem[];
  activeUser: 'user' | 'partner';
  /** The other person's name, as this phone knows it. */
  partnerName?: string;
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

/**
 * How long a memo may run.
 *
 * A memo travels as one encrypted record, and the relay takes a megabyte. The
 * recording is base64 inside the memo, and the encrypted memo is base64 again
 * on the way out, so what is sent is about 1.8 times the recording. At
 * the speech rate openRecorder asks for (VOICE_BITS_PER_SECOND) three minutes
 * is about 360 KB of audio - 640 KB sent.
 *
 * The recorder, and the most audio a memo may hold (VOICE_MAX_AUDIO_BYTES,
 * where recording stops even inside the time limit, for a phone that ignores
 * the rate), are the chat's voice notes' own (core/voice.ts): a memo and a
 * note are made the same way and fit the same record.
 */
const MAX_MEMO_SECONDS = 180;

/** The live meter at rest. */
const QUIET_BARS = new Array(12).fill(0.15);

/** Bars kept in a memo's waveform - the shape of the voice actually recorded. */
const MEMO_BARS = 28;

/** What went wrong asking for the microphone, in words that say what to do. */
function micErrorText(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return "Two can't use the microphone - allow it in the phone's settings, then try again.";
  }
  if (name === 'NotFoundError') return 'No microphone found.';
  return "Couldn't start recording. Try again.";
}

type RecorderState = 'idle' | 'starting' | 'recording' | 'recorded';

export const WhisperMemosView: React.FC<WhisperMemosViewProps> = ({
  memos,
  activeUser,
  partnerName,
  onAddMemo,
  onMarkListened,
  onSendToChat
}) => {
  // Names are worked out here, from the seat on each memo. The name stored with
  // a memo was decided on the phone that recorded it, so it said "You" on both.
  const partnerLabel = who(activeUser === 'user' ? 'partner' : 'user', activeUser, partnerName);

  const [filterCategory, setFilterCategory] = useState<WhisperCategory | 'all'>('all');
  const [filterRecipient, setFilterRecipient] = useState<'all' | 'for_you' | 'from_you'>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);

  // Recording State
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const isRecording = recorderState === 'recording';
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveVolumeBars, setLiveVolumeBars] = useState<number[]>(QUIET_BARS);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
  /** Why recording stopped by itself, or why a memo could not be made or sent. */
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  // Form State
  const [memoTitle, setMemoTitle] = useState('');
  const [memoCategory, setMemoCategory] = useState<WhisperCategory>('morning');
  const [transcriptSnippet, setTranscriptSnippet] = useState('');

  // Audio Playback State
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const [playbackSpeed] = useState<number>(1.0);
  /** A memo that could not be played, and why - said under it. */
  const [playError, setPlayError] = useState<{ id: string; text: string } | null>(null);

  const recordingRef = useRef<VoiceRecording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * Bumped whenever a recording is finished with - stopped, thrown away, the
   * window closed - so a microphone that answers late is let go of instead of
   * starting a recording nobody is looking at.
   */
  const recordSessionRef = useRef(0);

  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const releasePlaybackRef = useRef<(() => void) | null>(null);
  const releaseRadioRef = useRef<(() => void) | null>(null);

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  };

  /** Lets go of the microphone, keeping nothing. */
  const dropRecording = () => {
    recordSessionRef.current++;
    clearRecordingTimer();
    recordingRef.current?.cancel();
    recordingRef.current = null;
  };

  /** Back to an empty recorder: nothing recording, nothing recorded. */
  const resetRecorder = () => {
    dropRecording();
    setRecorderState('idle');
    setRecordingSeconds(0);
    setLiveVolumeBars(QUIET_BARS);
    setRecordedAudioUrl(null);
    setRecordedWaveform([]);
    setLimitNotice(null);
  };

  /** Stops whatever memo is playing. */
  const stopPlayback = () => {
    const audio = activeAudioElementRef.current;
    activeAudioElementRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.onerror = null;
      audio.pause();
    }
    releasePlaybackRef.current?.();
    releasePlaybackRef.current = null;
    releaseRadioRef.current?.();
    releaseRadioRef.current = null;
    setPlayingMemoId(null);
  };

  // Leaving the screen: the microphone and any memo playing are let go of.
  // Closing the recorder used to leave the microphone on until then.
  useEffect(() => {
    return () => {
      recordSessionRef.current++;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingRef.current?.cancel();
      recordingRef.current = null;
      const audio = activeAudioElementRef.current;
      activeAudioElementRef.current = null;
      if (audio) {
        audio.onended = null;
        audio.pause();
      }
      releasePlaybackRef.current?.();
      releaseRadioRef.current?.();
    };
  }, []);

  /**
   * Ends the recording and keeps it for listening back and sending.
   *
   * `notice` says why, when it was not the stop button.
   */
  const finishRecording = async (notice?: string) => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    clearRecordingTimer();
    const session = recordSessionRef.current;
    const levels = recording.levels().slice();
    const note = await recording.stop();
    if (recordSessionRef.current !== session) return;
    if (!note) {
      setRecorderState('idle');
      setRecordingSeconds(0);
      setLiveVolumeBars(QUIET_BARS);
      setLimitNotice(
        recording.elapsedMs() < 1000 ? 'Too short - record for a little longer.' : "Couldn't keep that recording. Try again."
      );
      return;
    }
    setRecordedAudioUrl(note.dataUrl);
    setRecordedWaveform(summarizePeaks(levels, MEMO_BARS).map(peak => peak / 100));
    setRecordingSeconds(Math.max(1, Math.round(note.durationSeconds)));
    setRecorderState('recorded');
    setLimitNotice(notice || null);
  };

  /**
   * Records from the microphone - the chat's voice-note recorder, so a memo
   * is made, limited and cleaned up the same way.
   *
   * There is no pretending any more. When the microphone could not be had,
   * this used to run a six-second timer and hand over an empty sound file,
   * which could be sent - your partner received a silent memo.
   */
  const startRecording = async () => {
    if (recorderState !== 'idle') return;
    if (!canRecordVoice()) {
      setLimitNotice("This phone can't record voice here.");
      return;
    }
    const session = ++recordSessionRef.current;
    setLimitNotice(null);
    setRecorderState('starting');
    setLiveVolumeBars(QUIET_BARS);

    markWaitingForMic(true);
    let recording: VoiceRecording | null = null;
    try {
      recording = await startVoiceRecording({
        onLevel: level => {
          if (recordSessionRef.current !== session) return;
          setLiveVolumeBars(prev => [...prev.slice(1), Math.max(0.12, level)]);
        },
        onLimit: () => {
          if (recordSessionRef.current === session) void finishRecording('Stopped here - the longest a memo can be.');
        }
      });
    } catch (err) {
      if (recordSessionRef.current === session) {
        setRecorderState('idle');
        setLimitNotice(micErrorText(err));
      }
      return;
    } finally {
      markWaitingForMic(false);
    }
    if (!recording) return;

    // Closed while the microphone was being asked for, or the app went out of
    // sight: nothing on screen would say the microphone is on.
    if (recordSessionRef.current !== session || document.visibilityState === 'hidden') {
      recording.cancel();
      if (recordSessionRef.current === session) {
        setRecorderState('idle');
        // Most often Android's permission prompt, which takes the screen for
        // a moment: the microphone is allowed now, and one more tap records.
        setLimitNotice('Microphone ready - tap the button to record.');
      }
      return;
    }

    const live = recording;
    recordingRef.current = live;
    setRecorderState('recording');
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(Math.min(MAX_MEMO_SECONDS, Math.floor(live.elapsedMs() / 1000)));
    }, 250);
  };

  const stopRecording = () => {
    void finishRecording();
  };

  // Leaving the app mid-memo stops it there, kept to listen back to - as a
  // voice note in the chat does - rather than recording on, unseen.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && recordingRef.current) {
        void finishRecording('Stopped when you left the app.');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
    // finishRecording reads only refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRecordModal = () => {
    resetRecorder();
    setShowRecordModal(true);
  };

  const closeRecordModal = () => {
    resetRecorder();
    setShowRecordModal(false);
  };

  useBackLayer(showRecordModal, closeRecordModal);

  const handleSaveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter in the title box submits the form too - mid-recording, that sent
    // a memo with no recording in it.
    if (recorderState !== 'recorded' || !recordedAudioUrl) return;
    const duration = Math.max(1, recordingSeconds);
    const authorName = activeUser === 'user' ? 'You' : 'Partner';
    const recipientId = activeUser === 'user' ? 'partner' : 'user';

    const newMemo: WhisperMemoItem = {
      id: newId('whisper'),
      title: memoTitle.trim() || `${CATEGORY_META[memoCategory].label}`,
      category: memoCategory,
      authorId: activeUser,
      authorName,
      recipientId,
      at: Date.now(),
      recordedAt: 'Just now',
      durationSeconds: duration,
      audioDataUrl: recordedAudioUrl || undefined,
      transcriptSnippet: transcriptSnippet.trim() || undefined,
      isListened: false,
      waveformData: recordedWaveform.length ? recordedWaveform : [0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.7, 0.9, 0.7, 0.4, 0.2]
    };

    // The last word, whatever the recorder did: a memo the relay would refuse
    // is kept here with the choice to re-record, not added to the letterbox
    // looking sent while it never arrives.
    if (recordSizeOf(newMemo) > MAX_RECORD_BYTES) {
      setLimitNotice('This memo is too long to send. Re-record a shorter one.');
      return;
    }

    onAddMemo(newMemo);
    resetRecorder();
    setShowRecordModal(false);

    // Reset form
    setMemoTitle('');
    setTranscriptSnippet('');

    if (onSendToChat) {
      onSendToChat(`🎙️ Sent an encrypted voice whisper: "${newMemo.title}" (${duration}s)`);
    }
  };

  /**
   * Plays a memo, or stops it.
   *
   * A memo that cannot be played now says why, and is not marked heard. It
   * used to run the progress bar along in silence instead - and then tell
   * the other phone it had been listened to.
   */
  const togglePlayMemo = (memo: WhisperMemoItem) => {
    if (playingMemoId === memo.id) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setPlayError(null);

    const url = memo.audioDataUrl || '';
    if (url.startsWith('two-media:')) {
      setPlayError({ id: memo.id, text: 'Still loading this recording - try again in a moment.' });
      return;
    }
    if (!url.startsWith('data:audio')) {
      setPlayError({ id: memo.id, text: "This recording isn't on this phone." });
      return;
    }

    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    activeAudioElementRef.current = audio;
    const recorded = memo.durationSeconds || 0;

    audio.ontimeupdate = () => {
      // A recording straight from a phone often reports no length at all
      // until it has played through; the length it was recorded at stands in.
      const length = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : recorded;
      if (length > 0) {
        setPlaybackProgress(prev => ({ ...prev, [memo.id]: Math.min(1, audio.currentTime / length) }));
      }
    };

    audio.onended = () => {
      if (activeAudioElementRef.current !== audio) return;
      setPlaybackProgress(prev => ({ ...prev, [memo.id]: 1 }));
      stopPlayback();
      // Heard means its listener played it to the end. The one who
      // recorded it playing it back is not news for anyone.
      if (!memo.isListened && memo.authorId !== activeUser) onMarkListened(memo.id);
    };

    const fail = () => {
      if (activeAudioElementRef.current !== audio) return;
      stopPlayback();
      setPlayError({ id: memo.id, text: "Couldn't play this recording." });
    };
    audio.onerror = fail;

    // One voice at a time across the app, and the radio turned down under it.
    releasePlaybackRef.current = claimVoicePlayback(`whisper:${memo.id}`, () => {
      if (activeAudioElementRef.current === audio) stopPlayback();
    });
    releaseRadioRef.current = holdRadioDown();
    setPlayingMemoId(memo.id);
    audio.play().catch(fail);
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
            <span>Private voice notes</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-linen-primary font-medium">
            Whisper Memos
          </h1>
          <p className="text-sm text-linen-secondary mt-1 max-w-xl">
            Little voice notes, a good-morning or a goodnight, kept just between you two.
          </p>
        </div>

        <button
          onClick={openRecordModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 font-medium text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer shrink-0"
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
                  ? 'bg-linen-primary text-linen-surface shadow-xs'
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
            onClick={openRecordModal}
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
                      {/* Memos from before `at` was kept were stored as "Just now" for good: say nothing for those. */}
                      <span>{whenLabel(memo.at, memo.recordedAt === 'Just now' ? '' : memo.recordedAt)}</span>
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
                    Penned by <strong className="text-linen-primary font-medium">{who(memo.authorId, activeUser, partnerName, memo.authorName)}</strong> · {formatSeconds(memo.durationSeconds)} duration
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

                  {playError?.id === memo.id && (
                    <p role="status" className="text-[11px] text-amber-800 mb-2 px-1">
                      {playError.text}
                    </p>
                  )}

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
                    {memo.authorId === activeUser ? `From you to ${partnerLabel}` : `From ${partnerLabel} to you`}
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
                type="button"
                onClick={closeRecordModal}
                aria-label="Close"
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
                    <span className="text-xs text-stone-400">
                      {recorderState === 'starting' ? 'Waiting for the microphone…' : 'Tap the microphone to begin'}
                    </span>
                  )}
                </div>

                {/* Record Button */}
                {recorderState === 'idle' || recorderState === 'starting' ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={recorderState === 'starting'}
                    aria-label="Start recording"
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/40 transition-transform active:scale-95 cursor-pointer disabled:opacity-60 disabled:animate-pulse"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                ) : isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    aria-label="Stop recording"
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg animate-pulse transition-transform active:scale-95 cursor-pointer"
                  >
                    <Square className="w-5 h-5 fill-white" />
                  </button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={resetRecorder}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-xs hover:bg-stone-700 transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Re-record</span>
                    </button>
                    <span className="text-xs text-emerald-400">✓ Recorded ({formatSeconds(recordingSeconds)})</span>
                  </div>
                )}

                {limitNotice && (
                  <p role="status" className="mt-3 text-center text-[11px] text-amber-300">
                    {limitNotice}
                  </p>
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
                  onClick={closeRecordModal}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recorderState !== 'recorded' || !recordedAudioUrl}
                  className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-transform active:scale-95 ${
                    recorderState === 'recorded' && recordedAudioUrl
                      ? 'bg-linen-primary text-linen-surface hover:opacity-90 cursor-pointer'
                      : 'bg-linen-variant text-linen-secondary cursor-not-allowed opacity-60'
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
