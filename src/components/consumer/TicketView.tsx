import React, { useEffect, useState, useMemo } from 'react';
import { Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import QRCode from 'qrcode';
import {
  Ticket,
  Clock,
  Users,
  Navigation,
  CheckCircle2,
  XCircle,
  MapPin,
  RefreshCw,
  QrCode,
  ArrowLeft,
  Scissors,
  Check,
  Share2,
  Calendar,
  AlertTriangle} from 'lucide-react';

interface TicketViewProps {
  bookingId: string;
  onBack: () => void;
}

export const TicketView: React.FC<TicketViewProps> = ({ bookingId, onBack }) => {
  const { t } = useAuth();
  const { notifyArriving, cancelCurrentBooking } = useQueue();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [arrivedSent, setArrivedSent] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const fetchTicket = async () => {
    try {
      const res = await api.getBooking(bookingId);
      if (res && res.booking) {
        setBooking(res.booking);
        if (res.booking.isArriving) {
          setArrivedSent(true);
        }

        // Generate QR code data URL
        const qrPayload = JSON.stringify({
          bookingId: res.booking.id,
          salonId: res.booking.salonId,
          tokenNumber: res.booking.tokenNumber,
          qrCodeId: res.booking.qrCodeId,
          qrSignature: res.booking.qrSignature,
        });

        const url = await QRCode.toDataURL(qrPayload, {
          width: 340,
          margin: 1,
          color: {
            dark: '#171717',
            light: '#ffffff',
          },
        });
        setQrDataUrl(url);
      }
    } catch (e) {
      console.error('Error fetching ticket details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 4000);
    return () => clearInterval(interval);
  }, [bookingId]);

  const handleArriving = async () => {
    const success = await notifyArriving();
    if (success) {
      setArrivedSent(true);
      fetchTicket();
    }
  };

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const deadlineHours = booking?.cancellationDeadlineHours ?? 2;
  const isPastDeadline = useMemo(() => {
    if (!booking?.scheduledDate || !booking?.scheduledTime) return false;
    const [h, m] = booking.scheduledTime.split(':').map(Number);
    const slotDate = new Date(`${booking.scheduledDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    const cutoffTime = slotDate.getTime() - (deadlineHours * 60 * 60 * 1000);
    return Date.now() >= cutoffTime;
  }, [booking?.scheduledDate, booking?.scheduledTime, deadlineHours]);

  const bookingAmount = booking?.amount || booking?.servicePrice || 1000;
  const refundPct = booking?.refundPercentage ?? 70;
  const refundAmount = Math.round((bookingAmount * refundPct) / 100);
  const nonRefundableAmount = bookingAmount - refundAmount;

  const handleOpenCancelModal = () => {
    if (isPastDeadline) return;
    setCancelError('');
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      const res = await cancelCurrentBooking('Customer cancelled from ticket screen');
      if (res && (res as any).error) {
        setCancelError((res as any).error);
        setCancelling(false);
      } else {
        setCancelling(false);
        setShowCancelModal(false);
        onBack();
      }
    } catch (e: any) {
      setCancelError(e?.message || 'Failed to cancel booking');
      setCancelling(false);
    }
  };

  const handleShare = async () => {
    if (!booking) return;
    const shareText = `QGo Token #${booking.tokenNumber} for ${booking.salonName}. Check-in: ${booking.scheduledTime || 'Live Queue'}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `QGo Token #${booking.tokenNumber}`,
          text: shareText,
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareText);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    }
  };

  if (loading || !booking) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center text-[rgba(23,23,23,0.70)]">
        <div className="w-10 h-10 border-4 border-[rgba(23,23,23,0.12)] border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-bold text-[rgba(23,23,23,0.70)]">Loading your Ticket...</p>
      </div>
    );
  }

  const tokenShort = booking.tokenNumber ? booking.tokenNumber.split('-').pop() : 'A001';
  const isNext = booking.queuePosition === 1;
  const isCheckedIn = booking.status === 'checked_in';
  const isCompleted = booking.status === 'completed';

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-4 pb-32 md:pb-24 space-y-4 animate-in fade-in duration-150">
      {/* Top Header Bar (Matching Image 2 Reference Header) */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#FF9F1C] via-[#FF9F1C]/90 to-[#FF9F1C]/80 text-[#171717] px-4 py-3.5 rounded-2xl shadow-sm">
        <button
          id="ticket-back-btn"
          onClick={onBack}
          className="p-2 rounded-xl bg-[rgba(23,23,23,0.05)] hover:bg-[rgba(23,23,23,0.05)] text-[#171717] transition-colors flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-base font-black tracking-tight text-[#171717]">Ticket Details</h1>

        <button
          onClick={handleShare}
          className="p-2 rounded-xl bg-[rgba(23,23,23,0.05)] hover:bg-[rgba(23,23,23,0.05)] text-[#171717] transition-colors relative cursor-pointer"
          title="Share Ticket"
        >
          <Share2 className="w-4 h-4" />
          {shareSuccess && (
            <span className="absolute -bottom-7 right-0 text-[11px] font-bold bg-[#FFFFFF] text-[#FF9F1C] px-2 py-0.5 rounded shadow whitespace-nowrap">
              Copied!
            </span>
          )}
        </button>
      </div>

      {/* Main Reference Digital Ticket Pass (Image 2 Right Screen) */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] shadow-xl overflow-hidden relative">
        {/* Salon Photo Banner */}
        <div className="relative h-36 bg-[#FFFFFF] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=400&fit=crop"
            alt={booking.salonName}
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 text-[#171717]">
            <span className="px-2 py-0.5 rounded-full bg-[#FF9F1C] text-[11px] font-black uppercase tracking-wider">
              {booking.mode === 'appointment' ? 'Reserved Appointment' : 'Live Queue Pass'}
            </span>
            <h2 className="text-base font-bold truncate mt-0.5">{booking.salonName}</h2>
          </div>
        </div>

        {/* Ticket Subtitle & Service Info */}
        <div className="px-6 pt-4 pb-2 text-center border-b border-[rgba(23,23,23,0.12)]">
          <p className="text-xs text-[rgba(23,23,23,0.70)] font-medium">
            {booking.serviceName} • {booking.staffName || 'Assigned Specialist'}
          </p>
        </div>

        {/* ── GIANT TOKEN NUMBER (Matching Reference "A 23") ── */}
        <div className="py-4 text-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[rgba(23,23,23,0.70)] block mb-1">
            Your Token Number
          </span>
          <div className="text-5xl sm:text-6xl font-black text-[#171717] tracking-tight font-sans">
            {tokenShort?.startsWith('A')
              ? `${tokenShort.slice(0, 1)} ${tokenShort.slice(1)}`
              : tokenShort}
          </div>
          <span className="text-[11px] font-mono text-[rgba(23,23,23,0.70)] mt-1 block">
            ID: {booking.tokenNumber}
          </span>
        </div>

        {/* Ticket Perforation / Punch Holes */}
        <div className="relative flex items-center my-1">
          <div className="w-5 h-5 rounded-full bg-[#FFFFFF] -ml-2.5 border-r border-[rgba(23,23,23,0.12)]" />
          <div className="flex-1 border-t-2 border-dashed border-[rgba(23,23,23,0.12)] mx-2" />
          <div className="w-5 h-5 rounded-full bg-[#FFFFFF] -mr-2.5 border-l border-[rgba(23,23,23,0.12)]" />
        </div>

        {/* ── CENTERED QR CODE & SIGNATURE (Matching Reference) ── */}
        <div className="p-6 pt-3 flex flex-col items-center justify-center space-y-2">
          <div className="p-3.5 bg-[#FFFFFF] rounded-2xl border-2 border-[rgba(23,23,23,0.12)] shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Ticket QR Code"
                className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-[rgba(23,23,23,0.70)]">
                <QrCode className="w-10 h-10 animate-pulse" />
              </div>
            )}
          </div>

          <div className="text-center">
            <span className="font-mono font-black text-xs text-[#FF9F1C] tracking-widest block">
              {booking.qrCodeId || `QGO-${tokenShort}`}
            </span>
            <p className="text-[11px] text-[rgba(23,23,23,0.70)] mt-0.5">
              Show this QR code at front desk on arrival
            </p>
          </div>
        </div>

        {/* ── DATE & CHECK-IN TIME RANGE (Matching Reference) ── */}
        <div className="px-6 py-4 bg-[#FFFFFF] border-t border-[rgba(23,23,23,0.12)] text-center space-y-1.5">
          <div className="text-xs font-mono font-bold text-[rgba(23,23,23,0.70)]">
            {booking.scheduledDate || new Date().toISOString().split('T')[0]}
          </div>

          <div className="text-[11px] uppercase tracking-wider font-bold text-[rgba(23,23,23,0.70)]">
            Check-In Time Slot
          </div>

          <div className="text-lg font-black text-[#171717] font-mono">
            {booking.scheduledTime
              ? `${booking.scheduledTime} - ${booking.scheduledTime}`
              : `Live Queue ~${booking.estimatedWaitMinutes || 10}m Wait`}
          </div>

          {/* Live Queue Status Strip */}
          <div className="pt-2 flex items-center justify-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-[rgba(23,23,23,0.70)]">
              <Users size={14} className="text-[#FF9F1C]" />
              <span>{isNext ? '0 (Next in line!)' : `${booking.peopleAhead || 0} ahead`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[rgba(23,23,23,0.70)]">
              <Clock size={14} className="text-[#FF9F1C]" />
              <span>~{booking.estimatedWaitMinutes || 5} min wait</span>
            </div>
          </div>
        </div>

        {/* ── CANCEL SLOT BUTTON & DEADLINE LOGIC ── */}
        {!isCompleted && (
          <div className="p-4 pt-3 bg-[#FFFFFF] border-t border-[rgba(23,23,23,0.12)] space-y-2">
            {isPastDeadline ? (
              <div className="p-2.5 rounded-xl bg-[rgba(255,159,28,0.15)] border border-[rgba(23,23,23,0.12)] text-[#FF9F1C] text-xs text-center font-bold">
                ⏳ Cancellation deadline passed ({deadlineHours}h before slot). Cancellation is no longer permitted.
              </div>
            ) : (
              <button
                id="cancel-slot-btn"
                type="button"
                onClick={handleOpenCancelModal}
                disabled={cancelling}
                className="w-full py-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] disabled:opacity-50 text-[#171717] font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>✕ CANCEL SLOT</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── CANCELLATION REFUND CONFIRMATION MODAL ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FFFFFF]">
          <div className="bg-[#FFFFFF] rounded-3xl p-6 max-w-md w-full shadow-lg border border-[rgba(23,23,23,0.12)] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#FF9F1C]">
              <div className="w-10 h-10 rounded-2xl bg-[rgba(255,159,28,0.15)] flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#171717]">Cancel Booking?</h3>
                <p className="text-xs text-[rgba(23,23,23,0.70)]">Are you sure you want to cancel this booking?</p>
              </div>
            </div>

            {/* Booking Details & Refund Breakdown Card */}
            <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] space-y-2.5 text-xs">
              <div className="flex justify-between text-[rgba(23,23,23,0.70)]">
                <span>Turf / Business:</span>
                <span className="font-bold text-[#171717]">{booking.salonName} {booking.resourceName ? `(${booking.resourceName})` : ''}</span>
              </div>
              <div className="flex justify-between text-[rgba(23,23,23,0.70)]">
                <span>Date &amp; Slot:</span>
                <span className="font-bold text-[#171717] font-mono">{booking.scheduledDate} · {booking.scheduledTime}</span>
              </div>
              <div className="pt-2 border-t border-[rgba(23,23,23,0.12)] flex justify-between text-[rgba(23,23,23,0.70)]">
                <span>Booking Amount:</span>
                <span className="font-bold text-[#171717]">₹{bookingAmount}</span>
              </div>
              <div className="flex justify-between text-[rgba(23,23,23,0.70)]">
                <span>Refund Policy:</span>
                <span className="font-bold text-[#FF9F1C]">{refundPct}% Refund</span>
              </div>
              <div className="flex justify-between text-[#FF9F1C] font-black text-sm pt-1 border-t border-[rgba(23,23,23,0.12)]">
                <span>You will receive:</span>
                <span>₹{refundAmount}</span>
              </div>
              <div className="flex justify-between text-[rgba(23,23,23,0.70)] text-[11px]">
                <span>Non-refundable fee:</span>
                <span>₹{nonRefundableAmount}</span>
              </div>
            </div>

            <p className="text-[11px] text-[rgba(23,23,23,0.70)] leading-relaxed">
              💡 Refund will be initiated to your original payment method within 24–48 hours.
            </p>

            {cancelError && (
              <div className="p-2.5 rounded-xl bg-[rgba(255,159,28,0.15)] border border-[rgba(23,23,23,0.12)] text-[#FF9F1C] text-xs font-bold">
                {cancelError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-bold text-[rgba(23,23,23,0.70)] hover:bg-[rgba(23,23,23,0.05)]"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl bg-[#FF9F1C] text-[#171717] text-xs font-black hover:bg-[#FF9F1C] shadow-sm disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : `Cancel & Get ₹${refundAmount} Refund`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM STICKY GOLD BUTTON: "EXTEND MY SLOT / I'M ARRIVING" (Matching Reference) ── */}
      {!isCheckedIn && !isCompleted && (
        <div className="sticky bottom-3 z-20">
          <button
            id="extend-arriving-btn"
            onClick={handleArriving}
            disabled={arrivedSent}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer ${
              arrivedSent
                ? 'bg-[#FF9F1C] text-[#171717] ring-2 ring-[#FF9F1C]'
                : 'bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] ring-2 ring-[#FF9F1C] scale-[1.01]'
            }`}
          >
            {arrivedSent ? (
              <>
                <Check className="w-5 h-5" />
                <span>ARRIVAL CONFIRMED · SHOP NOTIFIED</span>
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                <span>EXTEND MY SLOT / I'M ARRIVING SOON</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
