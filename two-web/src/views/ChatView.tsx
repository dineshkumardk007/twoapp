import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, NeedItem } from '../types';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { VoiceMemoPlayer } from '../components/VoiceMemoPlayer';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { Send, Plus, Sparkles, Mic, Square, Trash2, Heart } from 'lucide-react';

interface ChatViewProps {
  messages: ChatMessage[];
  activeUser: 'user' | 'partner';
  onSendMessage: (
    text: string,
    isNeed?: boolean,
    extra?: { isVoiceMemo?: boolean; audioDataUrl?: string; audioDurationSeconds?: number }
  ) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, activeUser, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [showNeedModal, setShowNeedModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Auto-scroll to the bottom whenever a new message is sent or received
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fallbackSimulatedVoiceMemo();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          onSendMessage('🎙️ Whisper voice note', false, {
            isVoiceMemo: true,
            audioDataUrl: base64Data,
            audioDurationSeconds: recordingSeconds || 6
          });
        };
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('[Microphone Access Declined or Unavailable - Using Calming Demo Voice Note]', err);
      fallbackSimulatedVoiceMemo();
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // discard chunks
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
  };

  const fallbackSimulatedVoiceMemo = () => {
    // Elegant fallback simulation when browser microphone is unavailable/blocked
    onSendMessage('🎙️ Whisper voice note', false, {
      isVoiceMemo: true,
      audioDurationSeconds: 8
    });
  };

  const partnerName = activeUser === 'user' ? 'Partner' : 'You';

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-linen-surface rounded-2xl border border-linen-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-linen-border bg-linen-variant/40 flex items-center justify-between">
        <div>
          <h3 className="font-serif text-base font-medium text-linen-primary">{partnerName}</h3>
          <div className="flex items-center text-xs text-linen-secondary space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>Encrypted Room</span>
          </div>
        </div>
        <button
          onClick={() => setShowNeedModal(true)}
          className="text-xs font-medium text-linen-accent hover:underline flex items-center"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          Ask For What You Need
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map(msg => {
          const isFromCurrentPerspective = msg.authorId === activeUser;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isFromCurrentPerspective ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.isNeedCard
                    ? 'bg-gold-50 border border-gold-500/40 text-linen-primary'
                    : isFromCurrentPerspective
                    ? 'bg-linen-primary text-linen-surface'
                    : 'bg-linen-variant text-linen-primary border border-linen-border'
                }`}
              >
                {msg.isNeedCard && (
                  <div className="text-[11px] font-semibold tracking-wider text-gold-600 uppercase mb-1 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Structured Need Request
                  </div>
                )}

                {msg.isVoiceMemo ? (
                  <VoiceMemoPlayer
                    audioDataUrl={msg.audioDataUrl}
                    durationSeconds={msg.audioDurationSeconds || 8}
                    isFromCurrentPerspective={isFromCurrentPerspective}
                  />
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
              <span className="text-[10px] text-linen-secondary mt-1 px-1">
                {msg.authorName} • {msg.timestamp}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-linen-border bg-linen-surface flex items-center space-x-2">
        {isRecording ? (
          /* Live Recording Controls */
          <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 animate-pulse">
            <div className="flex items-center space-x-2 text-rose-700 text-xs font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block animate-ping" />
              <span>Recording quiet whisper... {recordingSeconds}s</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={cancelVoiceRecording}
                className="p-1.5 text-rose-600 hover:text-rose-800 transition-colors"
                title="Cancel voice memo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={stopVoiceRecording}
                className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center space-x-1 text-xs px-2.5"
                title="Finish & send voice memo"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Input Bar */
          <>
            <button
              onClick={() => setShowNeedModal(true)}
              className="p-2.5 rounded-xl text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
              title="Ask for what you need"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button
              onClick={startVoiceRecording}
              className="p-2.5 rounded-xl text-linen-secondary hover:text-linen-accent hover:bg-linen-variant transition-colors"
              title="Record a whisper voice memo"
            >
              <Mic className="w-5 h-5" />
            </button>

            <button
              onClick={() => triggerGlobalPulse('Thinking of you')}
              className="p-2.5 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Send 'Thinking of You' sensory pulse (528Hz chime & gentle vibration)"
            >
              <Heart className="w-5 h-5 fill-rose-500 hover:scale-110 transition-transform" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder={`Write a quiet thought to ${partnerName}...`}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary placeholder:text-linen-secondary/60"
            />

            <button
              onClick={handleSendText}
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <NeedMenuModal
        isOpen={showNeedModal}
        onClose={() => setShowNeedModal(false)}
        onSelectNeed={(need) => {
          onSendMessage(`I need: ${need.title} — ${need.description}`, true);
          setShowNeedModal(false);
        }}
      />
    </div>
  );
};
