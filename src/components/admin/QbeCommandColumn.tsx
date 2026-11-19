import React, { useState, useEffect, useRef } from 'react';
import { Qbi } from '../qbi/Qbi';
import { useQbePreferences } from '../qbi/qbePreferences';
import {
  handleAdminAction,
  QbeActionResponse,
} from '../qbi/qbeAssistantActions';
import { api } from '../../services/api';
import { AdminReminderRecord } from '../../types';
import { toLocalDateString } from '../qbi/slotReminderEngine';
import {
  scheduleNativeAlarmNotification,
  triggerImmediateAlarmNotification,
} from '../../utils/nativeNotifications';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  X,
  Bot,
  Settings,
  PhoneCall,
  Clock,
  Calendar,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
  Bell,
  Vibrate,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  ExternalLink,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QbeCommandColumnProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onTriggerTestCall: (callData?: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export const QbeCommandColumn: React.FC<QbeCommandColumnProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  onTriggerTestCall,
  onNavigateTab,
}) => {
  const { prefs, updatePref, customName, setCustomName } = useQbePreferences();
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'settings' | 'reminders'>('console');

  // Voice & Input states
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingTrace, setThinkingTrace] = useState<string[]>([]);
  const [lastResponse, setLastResponse] = useState<QbeActionResponse | null>(null);

  // Interactive Calendar & Time Picker states
  const [reminderDate, setReminderDate] = useState<string>(() => toLocalDateString());
  const [reminderTime, setReminderTime] = useState<string>(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [reminderNote, setReminderNote] = useState<string>('');
  const [todayMinDate, setTodayMinDate] = useState<string>(() => toLocalDateString());
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [isTestingCall, setIsTestingCall] = useState(false);

  // Midnight auto-update of min date & date
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      const currentToday = toLocalDateString();
      setTodayMinDate(currentToday);
      setReminderDate((prev) => (prev < currentToday ? currentToday : prev));
    }, 60000);
    return () => clearInterval(checkMidnight);
  }, []);

  const handleQuickPreset = (addedMinutes: number) => {
    const target = new Date(Date.now() + addedMinutes * 60 * 1000);
    setReminderDate(toLocalDateString(target));
    setReminderTime(`${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`);
  };

  // Reminders list
  const [reminders, setReminders] = useState<AdminReminderRecord[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);

  // Load reminders
  const fetchReminders = async () => {
    try {
      setIsLoadingReminders(true);
      const res = await api.getAdminReminders();
      if (res && res.success) {
        setReminders(res.reminders || []);
      }
    } catch (e) {
      console.debug('[Qbe] Reminders fetch error:', e);
    } finally {
      setIsLoadingReminders(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReminders();
    }
  }, [isOpen]);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN'; // Indian English / Tanglish friendly

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          if (transcript) {
            setInputText(transcript);
            executeCommand(transcript);
          }
        };
        recognitionRef.current = recognition;
      }
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. Please type your command below.');
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {}
    }
  };

  // Execute Command (Natural / Voice / Chip)
  const executeCommand = async (command: string) => {
    if (!command.trim() || isThinking) return;
    setIsThinking(true);
    setThinkingTrace(['1. Analyzing executive intent & telemetry query...']);

    try {
      const res = await handleAdminAction('custom', command);
      setLastResponse(res);
      if (res.trace && res.trace.length > 0) {
        setThinkingTrace(res.trace);
      } else {
        setThinkingTrace(['1. Query verified', '2. Telemetry inspected', '3. Response delivered']);
      }

      // Spoken voice reply if enabled
      if (prefs.voiceOutputEnabled && res.spokenText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(res.spokenText);
          utter.rate = prefs.speechRate || 1.0;
          utter.pitch = 1.05;
          utter.lang = 'en-IN';
          window.speechSynthesis.speak(utter);
        } catch {}
      }

      // Refresh reminders if a reminder was scheduled
      if (res.actionData?.type === 'schedule_reminder') {
        fetchReminders();
      }
    } catch (err: any) {
      setLastResponse({
        text: `Error executing command: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsThinking(false);
      setInputText('');
    }
  };

  const handleScheduleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTime.trim() || !reminderDate.trim() || isCreatingReminder) return;

    setIsCreatingReminder(true);
    try {
      const [rH, rM] = reminderTime.split(':').map(Number);
      const ampm = rH >= 12 ? 'PM' : 'AM';
      const dispH = rH % 12 === 0 ? 12 : rH % 12;
      const displayTime = `${String(dispH).padStart(2, '0')}:${String(rM).padStart(2, '0')} ${ampm}`;

      const [rYear, rMonth, rDay] = reminderDate.split('-').map(Number);
      const targetTimestamp = new Date(rYear, rMonth - 1, rDay, rH, rM, 0, 0).getTime();

      const res = await api.createAdminReminder({
        targetTime: displayTime,
        targetDate: reminderDate,
        scheduledDate: reminderDate,
        scheduledTime: reminderTime,
        targetTimestamp,
        title: reminderNote.trim() || 'Executive Reminder',
        note: `Scheduled via Qbe Interactive Calendar for ${displayTime} on ${reminderDate}`,
        notifyPhone: prefs.adminPhone || '9600971886',
      });

      if (res && res.success && res.reminder) {
        // Arm native lock-screen notification if on mobile/Capacitor
        void scheduleNativeAlarmNotification({
          id: res.reminder.id,
          title: `Executive Reminder: ${res.reminder.title}`,
          note: `Call alert scheduled for ${displayTime} (+91 ${prefs.adminPhone || '9600971886'})`,
          targetDate: new Date(targetTimestamp),
        });
      }

      setReminderNote('');
      fetchReminders();
      executeCommand(`Scheduled call reminder for ${displayTime} on ${reminderDate} regarding ${reminderNote.trim() || 'Executive Reminder'}`);
    } catch (err: any) {
      alert(`Could not save reminder: ${err.message}`);
    } finally {
      setIsCreatingReminder(false);
    }
  };

  const handleRunTestCall = async () => {
    if (isTestingCall) return;
    setIsTestingCall(true);
    try {
      const adminPhone = prefs.adminPhone || '9600971886';

      // 1. Trigger server API (Twilio cellular SIM call)
      const testResult = await api.testQbeCall(adminPhone);

      // 2. Open WhatsApp URL in new window/tab
      if (testResult && testResult.whatsappUrl && typeof window !== 'undefined') {
        window.open(testResult.whatsappUrl, '_blank', 'noopener,noreferrer');
      }

      // 3. Trigger immediate native lock-screen notification
      void triggerImmediateAlarmNotification(
        'Qbe Executive Alert',
        'Test incoming call & WhatsApp alert to +91 ' + adminPhone
      );

      // 4. Open full-screen incoming call overlay with delivery channel status
      onTriggerTestCall({
        title: 'Executive Test Call',
        subtitle: testResult?.deliveryChannel === 'twilio_cellular_call'
          ? 'Twilio Cellular SIM Call Dispatched'
          : 'In-App & Lock-Screen Alarm Alert',
        message: testResult?.message || 'Attention Kishore, this is a verified test call from Qbe.',
        data: {
          phone: adminPhone,
          deliveryChannel: testResult?.deliveryChannel,
          twilioStatus: testResult?.twilioStatus,
          whatsappUrl: testResult?.whatsappUrl,
        },
      });
    } catch (err: any) {
      alert(`Could not initiate test call: ${err.message || 'Unknown error'}`);
    } finally {
      setIsTestingCall(false);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await api.deleteAdminReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  };

  const handleTriggerReminderNow = async (reminder: AdminReminderRecord) => {
    try {
      await api.triggerAdminReminder(reminder.id);
      onTriggerTestCall({
        title: reminder.title,
        message: `Scheduled Reminder Triggered: ${reminder.title} (Set for ${reminder.targetTime}).`,
      });
      fetchReminders();
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <aside
      role="complementary"
      aria-label="Qbe Super Admin Executive Command Column"
      className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-[380px] md:w-[420px] bg-white/95 dark:bg-[#141417]/95 backdrop-blur-2xl border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between text-zinc-900 dark:text-zinc-100 animate-in slide-in-from-right duration-300"
    >
      {/* ─── 1. COLUMN HEADER ─── */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E73229] to-amber-500 flex items-center justify-center text-white shadow-md shadow-[#E73229]/20">
              <Qbi mood={isThinking ? 'thinking' : isListening ? 'excited' : 'happy'} size={32} animate={true} />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-50 leading-tight">
                {customName}
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#E73229]/10 text-[#E73229] dark:bg-[#E73229]/20">
                JARVIS Tier 1
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              24/7 Super Admin Autonomous AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
            title="Minimize Qbe Column"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ─── 2. SUB-NAVIGATION TABS ─── */}
      <div className="px-4 py-2 bg-zinc-100/80 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('console')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'console'
              ? 'bg-white dark:bg-zinc-800 text-[#E73229] shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Qbi size={16} mood="happy" animate={false} />
          <span>Voice &amp; AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('reminders')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'reminders'
              ? 'bg-white dark:bg-zinc-800 text-[#E73229] shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Clock size={13} />
          <span>Reminders ({reminders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'settings'
              ? 'bg-white dark:bg-zinc-800 text-[#E73229] shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Sliders size={13} />
          <span>Settings</span>
        </button>
      </div>

      {/* ─── 3. SCROLLABLE TAB CONTENT ─── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
        {/* ================= TAB 1: CONSOLE ================= */}
        {activeSubTab === 'console' && (
          <div className="space-y-4">
            {/* Live Status Pill */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[11px]">
                  {isThinking ? 'THINKING & EXECUTING...' : isListening ? 'LISTENING TO VOICE...' : '24/7 AUTO-PILOT ACTIVE'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                +91 {prefs.adminPhone || '9600971886'}
              </span>
            </div>

            {/* Large Voice Command Mic & Wave */}
            <div className="p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
              <button
                type="button"
                onClick={toggleListening}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isListening
                    ? 'bg-red-600 text-white shadow-xl shadow-red-600/40 animate-pulse'
                    : 'bg-[#E73229] hover:bg-[#D42B22] text-white shadow-lg shadow-[#E73229]/25'
                }`}
                aria-label={isListening ? 'Stop listening' : 'Start voice command'}
              >
                {isListening ? <MicOff size={28} /> : <Mic size={28} />}
                {isListening && (
                  <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping duration-1000" />
                )}
              </button>

              <div>
                <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  {isListening ? 'Listening to voice command…' : 'Tap Mic for Two-Way Voice'}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Speaks &amp; understands English and Tanglish commands
                </p>
              </div>

              {/* Text command input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeCommand(inputText);
                }}
                className="w-full flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mt-1"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask Qbe or say '12:40-ku call pannu'…"
                  className="flex-1 px-3 py-1.5 text-xs bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none placeholder:text-zinc-400"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isThinking}
                  className="p-2 rounded-xl bg-[#E73229] disabled:opacity-40 text-white shadow-xs transition cursor-pointer"
                  title="Send command"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>

            {/* Smart Thinking Trace Display */}
            {(isThinking || thinkingTrace.length > 0) && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 text-xs font-bold">
                  {isThinking ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <CheckCircle2 size={14} className="text-blue-600" />}
                  <span>JARVIS Smart-Thinking Trace</span>
                </div>
                <div className="space-y-1 pl-1">
                  {thinkingTrace.map((step, idx) => (
                    <p key={idx} className="text-[11px] text-blue-800 dark:text-blue-200 font-mono leading-relaxed">
                      {step}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Last Execution Result / Card */}
            {lastResponse && (
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5 animate-in fade-in">
                <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                  {lastResponse.text}
                </p>

                {lastResponse.card && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{lastResponse.card.title}</span>
                      {lastResponse.card.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                          {lastResponse.card.badge}
                        </span>
                      )}
                    </div>
                    {lastResponse.card.subtitle && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{lastResponse.card.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Tanglish / English Command Chips */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                Quick Autonomous Tasks
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => executeCommand('Pending turf/salon approve pannu')}
                  className="p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 text-left font-semibold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                >
                  ⚡ Approve Pending
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('Download payments and profit Excel')}
                  className="p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 text-left font-semibold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                >
                  📊 Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('Send weekly payout details to 9600971886')}
                  className="p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 text-left font-semibold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                >
                  💬 WhatsApp Alert
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('Analyze slot demand and suggest pricing')}
                  className="p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 text-left font-semibold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                >
                  📈 Demand Advisor
                </button>
              </div>
            </div>

            {/* 1-Tap "Test Qbe Call & WhatsApp" CTA Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunTestCall}
                disabled={isTestingCall}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isTestingCall ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PhoneCall size={16} className="animate-bounce" />
                )}
                <span>
                  {isTestingCall
                    ? 'Placing Cellular SIM Call...'
                    : 'Test Qbe Call & WhatsApp (9600971886)'}
                </span>
              </button>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center mt-1.5">
                Tests Twilio cellular SIM ringing, full-screen incoming call UI &amp; WhatsApp alert
              </p>
            </div>
          </div>
        )}

        {/* ================= TAB 2: REMINDERS ================= */}
        {activeSubTab === 'reminders' && (
          <div className="space-y-4">
            {/* Interactive Calendar Date + Time + Countdown Timer Form */}
            <form onSubmit={handleScheduleReminderSubmit} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-zinc-100">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#E73229]" />
                  Schedule Call Reminder
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">IST (+05:30)</span>
              </div>

              {/* Quick Countdown Presets */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1.5">
                  Quick Countdown Presets
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '+5 mins', mins: 5 },
                    { label: '+15 mins', mins: 15 },
                    { label: '+30 mins', mins: 30 },
                    { label: '+1 hr', mins: 60 },
                  ].map((preset) => (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => handleQuickPreset(preset.mins)}
                      className="px-2 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-[#E73229]/10 hover:text-[#E73229] border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 transition cursor-pointer active:scale-95 text-center"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time Picker Row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    min={todayMinDate}
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                    Time (24h)
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
              </div>

              {/* Reminder Note */}
              <div>
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1">
                  Reminder Title / Task Note
                </label>
                <input
                  type="text"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="e.g. Check Turf 1 Payout & Disburse IMPS"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                />
              </div>

              {/* Arm Button */}
              <button
                type="submit"
                disabled={!reminderTime.trim() || !reminderDate.trim() || isCreatingReminder}
                className="w-full py-2.5 rounded-xl bg-[#E73229] hover:bg-[#D42B22] disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isCreatingReminder ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                <span>Arm 24/7 Call Reminder</span>
              </button>
            </form>

            {/* Pending Reminders List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Pending Scheduled Reminders ({reminders.length})
                </span>
                <button
                  type="button"
                  onClick={fetchReminders}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                  title="Refresh reminders"
                >
                  <RotateCw size={12} className={isLoadingReminders ? 'animate-spin' : ''} />
                </button>
              </div>

              {reminders.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500 italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  No pending call reminders. Say "12:40-ku call panni remind pannu" or add above!
                </div>
              ) : (
                reminders.map((r) => (
                  <div
                    key={r.id}
                    className={`p-3.5 rounded-2xl border transition flex flex-col gap-2 ${
                      r.triggered
                        ? 'bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 opacity-70'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                            {r.scheduledTime || r.targetTime}
                          </span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                            {r.scheduledDate || r.targetDate}
                          </span>
                          {r.scheduledDate && r.scheduledDate === todayMinDate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              Today
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-1">
                          {r.title}
                        </h5>
                        {r.note && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {r.note}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(r.id)}
                        className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-zinc-400 hover:text-red-600 transition"
                        title="Delete reminder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[10px] text-zinc-400">
                        {r.triggered ? 'Triggered ✓' : '24/7 Armed on Server'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTriggerReminderNow(r)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={10} />
                        <span>Trigger Call Now</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: SETTINGS ================= */}
        {activeSubTab === 'settings' && (
          <div className="space-y-4 text-xs">
            {/* Master Toggle */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Master Qbe Assistant</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Enable or mute Qbe globally</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.adminEnabled}
                onChange={(e) => updatePref('adminEnabled', e.target.checked)}
                className="w-5 h-5 accent-[#E73229] cursor-pointer"
              />
            </div>

            {/* 24/7 Background Auto-Pilot Watchdog */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">24/7 Background Watchdog</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Evaluates reminders &amp; anomaly detection</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.autopilotWatchdog}
                onChange={(e) => updatePref('autopilotWatchdog', e.target.checked)}
                className="w-5 h-5 accent-[#E73229] cursor-pointer"
              />
            </div>

            {/* Spoken Voice Replies & Speed */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Two-Way Voice Output</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Spoken replies upon call answer</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.voiceOutputEnabled}
                  onChange={(e) => updatePref('voiceOutputEnabled', e.target.checked)}
                  className="w-5 h-5 accent-[#E73229] cursor-pointer"
                />
              </div>

              {prefs.voiceOutputEnabled && (
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                  <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">
                    <span>Speech Rate</span>
                    <span className="font-mono font-bold text-[#E73229]">{prefs.speechRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={prefs.speechRate}
                    onChange={(e) => updatePref('speechRate', parseFloat(e.target.value))}
                    className="w-full accent-[#E73229] cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Ringtone & Vibration */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Incoming Call Ringtone</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Play chime loop during call</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.ringtoneEnabled}
                  onChange={(e) => updatePref('ringtoneEnabled', e.target.checked)}
                  className="w-5 h-5 accent-[#E73229] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Device Vibration</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Vibrate during incoming alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.vibrationEnabled}
                  onChange={(e) => updatePref('vibrationEnabled', e.target.checked)}
                  className="w-5 h-5 accent-[#E73229] cursor-pointer"
                />
              </div>
            </div>

            {/* Admin Phone Number */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <label className="font-bold text-zinc-900 dark:text-zinc-100 block">
                Target Admin Mobile / WhatsApp Number
              </label>
              <input
                type="text"
                value={prefs.adminPhone}
                onChange={(e) => updatePref('adminPhone', e.target.value)}
                placeholder="9600971886"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
              <p className="text-[10px] text-zinc-400">
                WhatsApp alerts and server webhooks are dispatched strictly to this mobile number.
              </p>
            </div>

            {/* Scheduled Executive Run Toggles */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">Automated Run Schedules</p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Daily 9:00 PM IST Briefing</p>
                  <p className="text-[10px] text-zinc-400">End-of-day revenue &amp; operations pulse</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.dailyBriefingSchedule}
                  onChange={(e) => updatePref('dailyBriefingSchedule', e.target.checked)}
                  className="w-4 h-4 accent-[#E73229] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Weekly Monday 9:00 AM Payouts</p>
                  <p className="text-[10px] text-zinc-400">Alerts for completed weekly cycles</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.weeklyPayoutSchedule}
                  onChange={(e) => updatePref('weeklyPayoutSchedule', e.target.checked)}
                  className="w-4 h-4 accent-[#E73229] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Monthly 1st 9:00 AM Payouts</p>
                  <p className="text-[10px] text-zinc-400">Monthly owner disbursement alarms</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.monthlyPayoutSchedule}
                  onChange={(e) => updatePref('monthlyPayoutSchedule', e.target.checked)}
                  className="w-4 h-4 accent-[#E73229] cursor-pointer"
                />
              </div>
            </div>

            {/* Autonomous Execution Permissions */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">Autonomous Execution Permissions</p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Auto-Approve Compliant Venues</p>
                  <p className="text-[10px] text-zinc-400">Permits Qbe to approve pending venues on command</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.autoApproveVenues}
                  onChange={(e) => updatePref('autoApproveVenues', e.target.checked)}
                  className="w-4 h-4 accent-[#E73229] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Auto-Reply to 4★ / 5★ Reviews</p>
                  <p className="text-[10px] text-zinc-400">Permits gratitude responses to positive feedback</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.autoReplyReviews}
                  onChange={(e) => updatePref('autoReplyReviews', e.target.checked)}
                  className="w-4 h-4 accent-[#E73229] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. COLUMN FOOTER (Positioned above Profile) ─── */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onOpenProfile}
          className="text-xs font-bold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
        >
          <Settings size={14} />
          <span>Profile &amp; Preferences</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
        >
          Close
        </button>
      </div>
    </aside>
  );
};
