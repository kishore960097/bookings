import React, { useState, useEffect } from 'react';
import { Salon, QueueEntry, Staff, Service } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmt12 } from '../../utils/timeFormat';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  CheckCircle2,
  XCircle,
  Pause,
  Plus,
  Clock,
  Scissors,
  Phone,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  User,
} from 'lucide-react';

interface QueueManagerProps {
  salon: Salon;
  onOpenScanner: () => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({ salon, onOpenScanner }) => {
  const { t } = useAuth();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);

  // Walk-in form states
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInServiceId, setWalkInServiceId] = useState('');
  const [walkInStaffId, setWalkInStaffId] = useState('');
  const [pauseReason, setPauseReason] = useState('Brief 15-minute tea break / shift cleaning');

  const fetchLiveQueue = async () => {
    try {
      const res = await api.getLiveQueue(
        salon.id,
        selectedStaffFilter === 'all' ? undefined : selectedStaffFilter
      );
      if (res) {
        setEntries(res.entries || []);
        setStaffList(res.staff || []);
      }
    } catch (e) {
      console.error('Error fetching live queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveQueue();
    const interval = setInterval(fetchLiveQueue, 4000);
    return () => clearInterval(interval);
  }, [salon.id, selectedStaffFilter]);

  // Load services for walk-in form
  useEffect(() => {
    const loadServices = async () => {
      try {
        const detail = await api.getSalonDetail(salon.id);
        if (detail) {
          setServices(detail.services);
          if (detail.services.length > 0) {
            setWalkInServiceId(detail.services[0].id);
          }
        }
      } catch (e) {}
    };
    loadServices();
  }, [salon.id]);

  const handleCallNext = async (staffId?: string) => {
    try {
      const res = await api.callNextCustomer(salon.id, staffId);
      if (res.success) {
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch (e) {}
        fetchLiveQueue();
      }
    } catch (e) {
      console.error('Error calling next customer:', e);
    }
  };

  const handleMarkServed = async (entry: QueueEntry) => {
    try {
      const res = await api.markServed(salon.id, {
        queueEntryId: entry.id,
        bookingId: entry.bookingId,
        staffId: entry.staffId,
      });
      if (res.success) {
        fetchLiveQueue();
      }
    } catch (e) {
      console.error('Error marking served:', e);
    }
  };

  const handleMarkNoShow = async (entry: QueueEntry) => {
    if (window.confirm(`Mark ${entry.customerName} (${entry.tokenNumber}) as No-Show?`)) {
      try {
        await api.markNoShow(salon.id, {
          queueEntryId: entry.id,
          bookingId: entry.bookingId,
        });
        fetchLiveQueue();
      } catch (e) {
        console.error('Error marking no-show:', e);
      }
    }
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.addWalkIn(salon.id, {
        customerName: walkInName || undefined,
        customerPhone: walkInPhone || undefined,
        serviceId: walkInServiceId || undefined,
        staffId: walkInStaffId || undefined,
      });
      if (res.success) {
        setIsWalkInModalOpen(false);
        setWalkInName('');
        setWalkInPhone('');
        fetchLiveQueue();
      }
    } catch (e) {
      console.error('Error adding walk-in:', e);
    }
  };

  const handlePauseQueue = async () => {
    try {
      await api.pauseQueue(salon.id, pauseReason);
      setIsPauseModalOpen(false);
      alert('Queue paused and notification sent to all waiting customers.');
    } catch (e) {
      console.error('Error pausing queue:', e);
    }
  };

  const callingEntries = entries.filter((e) => e.status === 'calling');
  const waitingEntries = entries.filter((e) => e.status === 'waiting');

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Staff Lane Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedStaffFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              selectedStaffFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Chairs ({entries.length})
          </button>
          {staffList.map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStaffFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedStaffFilter === st.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{st.name}</span>
              {st.waitingCount !== undefined && st.waitingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-[10px] flex items-center justify-center font-black">
                  {st.waitingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="add-walkin-btn"
            onClick={() => setIsWalkInModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-xs uppercase tracking-wider shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addWalkIn}</span>
          </button>

          <button
            id="scan-qr-btn"
            onClick={onOpenScanner}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>{t.scanQrCheckIn}</span>
          </button>

          <button
            onClick={() => setIsPauseModalOpen(true)}
            className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
            title={t.pauseQueue}
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Currently In Chair / Calling Section */}
      {callingEntries.length > 0 && (
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xs uppercase tracking-widest text-indigo-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
              Now Calling to Chair
            </h3>
            <span className="text-xs text-indigo-800 font-bold font-mono">
              {callingEntries.length} in progress
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {callingEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl p-4 border border-indigo-200 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-slate-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      #{entry.tokenNumber.split('-').pop()}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{entry.customerName}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {entry.serviceName} • Stylist: <strong className="text-slate-900">{entry.staffName || 'Any'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMarkServed(entry)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete</span>
                  </button>
                  <button
                    onClick={() => handleMarkNoShow(entry)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Mark No-Show"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Waiting Queue Lane */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 uppercase tracking-wide">{t.waitingQueue}</h3>
            <span className="text-xs text-slate-500 font-mono">
              {waitingEntries.length} customers waiting in line
            </span>
          </div>

          <button
            id="call-next-header-btn"
            disabled={waitingEntries.length === 0}
            onClick={() => handleCallNext(selectedStaffFilter === 'all' ? undefined : selectedStaffFilter)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t.callNextCustomer}</span>
          </button>
        </div>

        {waitingEntries.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">0 customers waiting in line</p>
            <p className="text-xs text-slate-400 mt-0.5">
              No customers are currently waiting.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {waitingEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                    #{idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        #{entry.tokenNumber.split('-').pop()}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{entry.customerName}</span>
                      {entry.isArriving && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                          Arriving
                        </span>
                      )}
                      {entry.isAppointment && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800">
                          Apt: {fmt12(entry.scheduledTime)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {entry.serviceName} ({entry.serviceDuration}m) • Stylist:{' '}
                      <strong className="text-slate-800">{entry.staffName || 'Any'}</strong> • Phone: {entry.customerPhone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCallNext(entry.staffId)}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-xs uppercase tracking-wider transition-colors flex items-center gap-1"
                  >
                    <span>Call Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMarkNoShow(entry)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Mark No-Show"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Walk-in Modal */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            onClick={() => setIsWalkInModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl z-10 border border-neutral-200 animate-in zoom-in-95">
            <button
              onClick={() => setIsWalkInModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-800"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-neutral-900 mb-1">{t.walkInModalTitle}</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Add walk-in guest into unified queue stream with instant token.
            </p>

            <form onSubmit={handleAddWalkIn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.customerName}</label>
                <input
                  type="text"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Rahul S (or leave empty for anonymous)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.customerPhone}</label>
                <input
                  type="tel"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="+91 98990 01122"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Service</label>
                <select
                  value={walkInServiceId}
                  onChange={(e) => setWalkInServiceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (₹{s.price} - {s.durationMinutes}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Assign Stylist</label>
                <select
                  value={walkInStaffId}
                  onChange={(e) => setWalkInStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">Any Available Stylist</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.waitingCount || 0} in queue)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs shadow-md transition-colors mt-2"
              >
                Issue Token & Add to Queue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pause Queue Modal */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            onClick={() => setIsPauseModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl z-10 border border-neutral-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-neutral-900 mb-1">{t.pauseQueue}</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Notifies waiting customers of brief delay while holding their positions.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Pause Reason</label>
                <input
                  type="text"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsPauseModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePauseQueue}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs"
                >
                  Pause & Notify Customers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
