import React, { useState, useEffect } from 'react';
import { Salon, Service, Staff, Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import confetti from 'canvas-confetti';
import {
  X,
  Ticket,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Scissors,
  Check,
} from 'lucide-react';

interface JoinQueueModalProps {
  salon: Salon;
  preselectedService?: Service;
  onClose: () => void;
  onQueueSuccess: (booking: Booking) => void;
}

export const JoinQueueModal: React.FC<JoinQueueModalProps> = ({
  salon,
  preselectedService,
  onClose,
  onQueueSuccess,
}) => {
  const { user, t } = useAuth();
  const { refreshActiveBooking } = useQueue();

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedService?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('any');

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSalonData = async () => {
      try {
        const detail = await api.getSalonDetail(salon.id);
        if (detail) {
          setServices(detail.services);
          setStaffList(detail.staff);
          if (!selectedServiceId && detail.services.length > 0) {
            setSelectedServiceId(detail.services[0].id);
          }
        }
      } catch (e) {
        console.error('Error loading salon details:', e);
      }
    };
    loadSalonData();
  }, [salon.id]);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) {
      setError('Please select a service to join the queue.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await api.createBooking({
        salonId: salon.id,
        customerName: customerName.trim() || 'Customer',
        customerPhone: customerPhone.trim() || '+91 98765 00000',
        serviceId: selectedServiceId,
        staffId: selectedStaffId === 'any' ? undefined : selectedStaffId,
        mode: 'token',
      });

      if (res.success && res.booking) {
        try {
          confetti({ particleCount: 70, spread: 50, origin: { y: 0.6 } });
        } catch (e) {}
        await refreshActiveBooking();
        onQueueSuccess(res.booking);
      } else {
        setError(res.error || 'Failed to join queue. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pr-10">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
              Live Queue Ticket
            </span>
            <h2 className="text-xl font-black tracking-tight text-white mt-1.5">{salon.name}</h2>
            <p className="text-xs text-indigo-200 truncate mt-0.5">{salon.address}</p>
          </div>

          {/* Live Wait Stats Strip */}
          <div className="mt-4 p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              <div>
                <span className="text-[10px] text-indigo-200 uppercase font-bold block">Current Queue</span>
                <span className="text-xs font-black text-white">{salon.queueLength} waiting ahead</span>
              </div>
            </div>
            <div className="text-right flex items-center gap-1.5 font-mono text-xs font-black text-emerald-300">
              <Clock size={14} />
              <span>~{salon.estimatedWaitMinutes || 5} min wait</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Service Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              1. Select Service
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {services.map((srv) => {
                const isSelected = selectedServiceId === srv.id;
                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/30 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{srv.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {srv.durationMinutes} mins · {srv.category}
                      </span>
                    </div>
                    <span className="font-black text-indigo-700">₹{srv.price}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stylist Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              2. Specialist Preference
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedStaffId('any')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold whitespace-nowrap transition-all ${
                  selectedStaffId === 'any'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>✨ Any Available (Fastest)</span>
              </button>
              {staffList.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStaffId(st.id)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedStaffId === st.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <img src={st.photoUrl} alt={st.name} className="w-4 h-4 rounded-full object-cover" />
                  <span>{st.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98765 00000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Bottom Action */}
          <div className="pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={submitting || !selectedServiceId}
              className="w-full py-3.5 sm:py-4 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>{submitting ? 'Generating Digital Token...' : 'GET DIGITAL TOKEN'}</span>
              <Ticket className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
