import React, { useState, useEffect, useRef } from 'react';
import { Qbi } from './Qbi';
import { Phone, PhoneOff, PhoneCall, Volume2, VolumeX, MessageSquare, ExternalLink, Clock, ShieldCheck, Check } from 'lucide-react';
import { useQbePreferences } from './qbePreferences';

export interface QbeIncomingCallProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  message: string;
  data?: any;
  onAnswer?: () => void;
  onDecline: () => void;
  onSnooze?: (minutes: number) => void;
  onAction?: (actionTarget: string, data?: any) => void;
}

export const QbeIncomingCallModal: React.FC<QbeIncomingCallProps> = ({
  isOpen,
  title,
  subtitle = 'QGo Executive AI • Incoming Call',
  message,
  data,
  onAnswer,
  onDecline,
  onSnooze,
  onAction,
}) => {
  const { prefs } = useQbePreferences();
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ringtoneTimerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play Web Audio Chime Melody while 'ringing'
  const playRingtoneChime = () => {
    if (!prefs.ringtoneEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const now = ctx.currentTime;
      // High-low-high musical call chime
      const notes = [
        { f: 587.33, t: 0.0, d: 0.2 }, // D5
        { f: 783.99, t: 0.2, d: 0.25 }, // G5
        { f: 880.0, t: 0.45, d: 0.3 }, // A5
        { f: 1046.5, t: 0.8, d: 0.35 }, // C6
      ];

      notes.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.2, now + t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + d);
      });

      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 1500);
    } catch {}
  };

  const stopRingtone = () => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  // Browser & Device Notifications
  useEffect(() => {
    if (isOpen && callState === 'ringing') {
      // 1. Device vibration
      if (prefs.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([400, 200, 400, 200, 400]);
        } catch {}
      }

      // 2. Play initial ringtone and loop every 2.8 seconds
      playRingtoneChime();
      ringtoneTimerRef.current = setInterval(playRingtoneChime, 2800);

      // 3. Native & Browser Notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('Qbe — Incoming Executive Call', {
              body: `${title}: ${message}`,
              icon: '/qgo-logo.svg',
            });
          } catch {}
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().catch(() => {});
        }
      }
    }

    return () => {
      stopRingtone();
    };
  }, [isOpen, callState, prefs.ringtoneEnabled, prefs.vibrationEnabled, title, message]);

  // Call duration counter once connected
  useEffect(() => {
    let interval: any = null;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDurationSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Handle Answer
  const handleAnswer = () => {
    stopRingtone();
    setCallState('connected');
    onAnswer?.();

    // Speak message aloud via SpeechSynthesis
    if (prefs.voiceOutputEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(message);
        speech.rate = prefs.speechRate || 1.0;
        speech.pitch = 1.05;
        speech.lang = 'en-IN';
        setIsSpeaking(true);
        speech.onend = () => setIsSpeaking(false);
        speech.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(speech);
      } catch {
        setIsSpeaking(false);
      }
    }
  };

  // Handle Decline
  const handleDecline = () => {
    stopRingtone();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCallState('ended');
    onDecline();
  };

  // Handle Snooze
  const handleSnooze = () => {
    stopRingtone();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onSnooze?.(10);
    onDecline();
  };

  // Format call duration MM:SS
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const adminPhone = prefs.adminPhone || '9600971886';
  const whatsappUrl = `https://wa.me/91${adminPhone}?text=${encodeURIComponent(
    `🚨 *Qbe Executive Alert Notification*\n*Title:* ${title}\n*Details:* ${message}`
  )}`;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#18181D] to-[#0D0D11] text-white border border-zinc-800/80 rounded-[36px] shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background ring */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#E73229]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Status */}
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
            {callState === 'ringing' ? 'JARVIS AI • Incoming Call' : `Call Connected • ${formatDuration(callDurationSeconds)}`}
          </span>
        </div>

        {/* Large Mascot Avatar with Pulse Wave */}
        <div className="relative mb-4 flex items-center justify-center">
          {callState === 'ringing' && (
            <div className="absolute inset-0 rounded-full bg-[#E73229]/25 animate-ping duration-1000 pointer-events-none" />
          )}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700/80 flex items-center justify-center shadow-2xl relative z-10">
            <Qbi mood={callState === 'connected' ? 'happy' : 'excited'} size={80} animate={true} />
          </div>
        </div>

        {/* Caller ID Display */}
        <h2 className="text-2xl font-black text-white tracking-tight mt-1">
          Qbe
        </h2>
        <p className="text-xs text-zinc-400 font-medium mt-0.5 tracking-wide">
          {subtitle}
        </p>

        {/* Real Delivery Channel Badge */}
        {data?.deliveryChannel === 'twilio_cellular_call' && (
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold">
            <PhoneCall size={12} className="animate-pulse" />
            <span>Twilio Cellular SIM Call Active (+91 {adminPhone})</span>
          </div>
        )}
        {data?.deliveryChannel === 'app_lockscreen_push' && (
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold">
            <ShieldCheck size={12} />
            <span>In-App &amp; Lock-Screen Alert Channel Active</span>
          </div>
        )}

        {/* Call Subject Banner */}
        <div className="mt-4 mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 w-full text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-bold text-[#E73229] uppercase tracking-wider">{title}</span>
            <span className="font-mono text-zinc-400">IST</span>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {/* Voice Wave Animation while Speaking */}
        {callState === 'connected' && (
          <div className="flex items-center justify-center gap-1.5 mb-6 h-6">
            <span className="text-[10px] text-zinc-400 uppercase font-bold mr-2">
              {isSpeaking ? 'Speaking...' : 'Listening'}
            </span>
            {[0.8, 1.4, 0.6, 1.8, 1.0, 1.5, 0.7].map((heightScale, i) => (
              <span
                key={i}
                style={{
                  height: isSpeaking ? `${heightScale * 14}px` : '4px',
                  animationDelay: `${i * 100}ms`,
                }}
                className={`w-1 rounded-full transition-all duration-200 ${
                  isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
            ))}
          </div>
        )}

        {/* Dynamic Controls based on State */}
        {callState === 'ringing' ? (
          <div className="w-full space-y-4">
            <div className="flex items-center justify-around w-full px-4">
              {/* Decline Call Button */}
              <button
                type="button"
                onClick={handleDecline}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all">
                  <PhoneOff size={28} />
                </div>
                <span className="text-xs font-bold text-zinc-400 group-hover:text-red-400 transition-colors">
                  Decline
                </span>
              </button>

              {/* Snooze Button */}
              <button
                type="button"
                onClick={handleSnooze}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 flex items-center justify-center shadow-md transition-all">
                  <Clock size={20} />
                </div>
                <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  Snooze 10m
                </span>
              </button>

              {/* Answer Call Button */}
              <button
                type="button"
                onClick={handleAnswer}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse transition-all">
                  <PhoneCall size={28} />
                </div>
                <span className="text-xs font-bold text-zinc-400 group-hover:text-emerald-400 transition-colors">
                  Answer Call
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <MessageSquare size={16} />
                <span>Dispatch WhatsApp Alert to 9600971886</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  onAction?.('admin_payments', data);
                  handleDecline();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <ExternalLink size={14} />
                <span>Open Payments &amp; Settlements</span>
              </button>
            </div>

            {/* End Call Button */}
            <button
              type="button"
              onClick={handleDecline}
              className="w-full py-3 px-4 rounded-2xl bg-red-600/90 hover:bg-red-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-2"
            >
              <PhoneOff size={16} />
              <span>Acknowledge &amp; End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
