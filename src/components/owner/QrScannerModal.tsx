import React, { useState, useEffect, useRef } from 'react';
import { Salon, Booking } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  UserCheck,
  RefreshCw} from 'lucide-react';

interface QrScannerModalProps {
  salon: Salon;
  onClose: () => void;
  onCheckInSuccess: (booking: Booking) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  salon,
  onClose,
  onCheckInSuccess,
}) => {
  const { t } = useAuth();
  const [manualCode, setManualCode] = useState('');
  const [activeWaitingBookings, setActiveWaitingBookings] = useState<Booking[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [result, setResult] = useState<{
    status: 'success' | 'error' | 'already_checked_in';
    message: string;
    booking?: Booking;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Fetch active bookings for quick test simulation
  useEffect(() => {
    const loadWaiting = async () => {
      try {
        const res = await api.getBookings({ salonId: salon.id });
        if (res && res.bookings) {
          const waiting = res.bookings.filter(
            (b) => b.status === 'confirmed' || b.status === 'in_progress'
          );
          setActiveWaitingBookings(waiting);
        }
      } catch (e) {
        console.error('Error fetching waiting bookings:', e);
      }
    };
    loadWaiting();
  }, [salon.id]);

  // Start Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
        scanLoopRef.current = requestAnimationFrame(tick);
      }
      setCameraActive(true);
    } catch (e) {
      console.warn('Camera access denied or unavailable in sandbox:', e);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    setCameraActive(false);
  };

  const tick = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      if (cameraActive) scanLoopRef.current = requestAnimationFrame(tick);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Scale down for faster QR processing
    const maxDimension = 400;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        try {
          const payload = JSON.parse(code.data);
          
          if (payload.salonId && payload.salonId !== salon.id) {
            setResult({
              status: 'error',
              message: 'Invalid Ticket! This ticket belongs to a different shop.',
            });
            setTimeout(() => {
              if (cameraActive) scanLoopRef.current = requestAnimationFrame(tick);
            }, 3000);
            return;
          }

          stopCamera();
          handleVerifyPayload(payload);
          return;
        } catch (e) {
          console.warn("Invalid QR code format.");
        }
      }
    }

    if (cameraActive) scanLoopRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleVerifyPayload = async (payload: string | object) => {
    setScanning(true);
    setResult(null);

    try {
      const res = await api.scanQr(payload, salon.id);
      if (res.valid && res.booking) {
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
        } catch (e) {}
        setResult({
          status: 'success',
          message: res.message || 'Ticket Validated! Please collect payment and accept.',
          booking: res.booking,
        });
        // Wait for explicit accept via UI
      } else {
        setResult({
          status: res.reason === 'ALREADY_CHECKED_IN' ? 'already_checked_in' : 'error',
          message: res.message || 'Invalid or Expired QR Code',
          booking: res.booking,
        });
      }
    } catch (err: any) {
      setResult({
        status: 'error',
        message: err.message || 'Validation request failed',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setScanning(true);
    setResult(null);

    try {
      const res = await api.manualCodeCheckIn(manualCode, salon.id);
      if (res.valid && res.booking) {
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
        } catch (e) {}
        setResult({
          status: 'success',
          message: res.message || 'Ticket Validated! Please collect payment and accept.',
          booking: res.booking,
        });
        // Wait for explicit accept via UI
      } else {
        setResult({
          status: 'error',
          message: res.message || 'No matching booking found for this code',
        });
      }
    } catch (err: any) {
      setResult({
        status: 'error',
        message: err.message || 'Manual code verification failed',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleAcceptAndComplete = async (booking: Booking, markAsPaid: boolean) => {
    setScanning(true);
    try {
      const res = await api.acceptQrCheckIn(booking.id, salon.id, markAsPaid);
      if (res.valid) {
        setResult({
          status: 'success',
          message: 'Payment Recorded & Check-in Complete!',
          booking: { ...booking, paymentStatus: markAsPaid ? 'paid' : booking.paymentStatus }
        });
        onCheckInSuccess(booking);
      } else {
        setResult({
          status: 'error',
          message: res.message || 'Failed to accept check-in',
          booking,
        });
      }
    } catch (err: any) {
      setResult({
        status: 'error',
        message: err.message || 'Accept request failed',
        booking,
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl z-10 border border-neutral-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto scrollbar-none">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-neutral-900">QR Scanner</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{salon.name} Reception Check-in Desk</p>
        </div>

        {/* Verification Result Banner */}
        {result && (
          <div
            className={`mb-5 p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 animate-in fade-in ${
              result.status === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : result.status === 'already_checked_in'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            {result.status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : result.status === 'already_checked_in' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="w-full">
              <span className="block text-sm">{result.message}</span>
              {result.booking && (
                <div className="mt-2 space-y-3">
                  <span className="text-xs font-normal block">
                    Token: <strong>{result.booking.tokenNumber}</strong> • {result.booking.serviceName}
                  </span>
                  
                  {result.status === 'success' && (
                    <div className="bg-white/60 rounded-xl p-3 border border-emerald-200/60 shadow-xs space-y-1.5 w-full">
                      <div className="flex justify-between items-center text-emerald-800 text-xs">
                        <span>Total Slot Amount:</span>
                        <span className="font-bold">₹{result.booking.totalAmount || result.booking.amount}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-800 text-xs mt-1">
                        <span>Slot Amount Paid:</span>
                        <span className="font-bold">₹{(result.booking.totalAmount || result.booking.amount || 0) - (result.booking.balanceAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-emerald-200/60 text-emerald-950 font-black text-sm">
                        <span>Balance Due:</span>
                        <span>₹{result.booking.balanceAmount || 0}</span>
                      </div>

                      <div className="pt-3 flex flex-col gap-2">
                        {(result.booking.balanceAmount || 0) > 0 ? (
                          <>
                            <button
                              type="button"
                              disabled={scanning}
                              onClick={() => handleAcceptAndComplete(result.booking!, true)}
                              className="w-full py-2.5 bg-[#F66B0E] hover:bg-[#e05e0a] text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                              Collect ₹{result.booking.balanceAmount} & Accept
                            </button>
                            <button
                              type="button"
                              disabled={scanning}
                              onClick={() => handleAcceptAndComplete(result.booking!, false)}
                              className="w-full py-2.5 bg-transparent hover:bg-orange-50 text-[#F66B0E] border border-[#F66B0E] rounded-lg text-xs font-bold transition-colors"
                            >
                              Accept without Payment
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={scanning}
                            onClick={() => handleAcceptAndComplete(result.booking!, true)}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            Accept & Check-in
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Camera Scanner Box */}
        <div className="relative bg-neutral-950 rounded-3xl overflow-hidden aspect-4/3 flex flex-col items-center justify-center border-2 border-neutral-800 shadow-inner mb-5">
          {cameraActive ? (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              {/* Scanning Target Crosshairs */}
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-white bg-black/60 px-2 py-0.5 rounded">
                  Align QR code inside box
                </span>
              </div>
              <button
                onClick={stopCamera}
                className="absolute bottom-3 bg-neutral-900/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-xs hover:bg-neutral-800"
              >
                Turn off camera
              </button>
            </>
          ) : (
            <div className="p-6 text-center text-neutral-400 space-y-3">
              <Camera className="w-12 h-12 mx-auto stroke-1 text-neutral-500" />
              <div>
                <p className="text-xs font-bold text-white">Live Camera Scanner</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Point camera at customer's phone QR ticket
                </p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-xs shadow-md transition-colors inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Start Scanner Camera</span>
              </button>
            </div>
          )}
        </div>

        {/* 1-Click QR Simulator: Instant test with currently waiting customer tickets */}
        <div className="mb-5 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
          <span className="text-xs font-bold text-neutral-800 block mb-1 flex items-center gap-1">
            
            Quick Test Simulator (Click any waiting customer):
          </span>

          {activeWaitingBookings.length === 0 ? (
            <p className="text-[11px] text-neutral-400">No customers currently in waiting queue.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {activeWaitingBookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={scanning}
                  onClick={() =>
                    handleVerifyPayload({
                      bookingId: b.id,
                      salonId: b.salonId,
                      tokenNumber: b.tokenNumber,
                      qrCodeId: b.qrCodeId,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-neutral-300 hover:border-emerald-500 hover:bg-emerald-50 text-xs font-semibold text-neutral-800 transition-all text-left shadow-2xs"
                >
                  <span className="font-mono text-emerald-700 font-bold">
                    #{b.tokenNumber?.split('-').pop()}
                  </span>{' '}
                  - {b.customerName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Code Input Form */}
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <label className="block text-xs font-bold text-neutral-700">Or enter 6-digit code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. A012 or SLN48291-20260821-A012"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
            <button
              type="submit"
              disabled={scanning || !manualCode}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-bold transition-colors shrink-0"
            >
              {scanning ? 'Checking...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
