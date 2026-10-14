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
      <div className="fixed inset-0 bg-[#FFFFFF]" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#FFFFFF] rounded-3xl p-6 sm:p-7 shadow-lg z-10 border border-[rgba(23,23,23,0.12)] animate-in zoom-in-95 max-h-[90vh] overflow-y-auto scrollbar-none">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-[rgba(23,23,23,0.70)] hover:text-[#171717] hover:bg-[rgba(23,23,23,0.05)]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(255,159,28,0.15)] border border-[rgba(23,23,23,0.12)] text-[#FF9F1C] flex items-center justify-center mx-auto mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#171717]">QR Scanner</h2>
          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">{salon.name} Reception Check-in Desk</p>
        </div>

        {/* Verification Result Banner */}
        {result && (
          <div
            className={`mb-5 p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 animate-in fade-in ${
              result.status === 'success'
                ? 'bg-[rgba(255,159,28,0.15)] border-[rgba(23,23,23,0.12)] text-[#FF9F1C]'
                : result.status === 'already_checked_in'
                ? 'bg-[rgba(255,159,28,0.15)] border-[rgba(23,23,23,0.12)] text-[#FF9F1C]'
                : 'bg-[rgba(255,159,28,0.15)] border-[rgba(23,23,23,0.12)] text-[#FF9F1C]'
            }`}
          >
            {result.status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
            ) : result.status === 'already_checked_in' ? (
              <AlertCircle className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
            )}
            <div className="w-full">
              <span className="block text-sm">{result.message}</span>
              {result.booking && (
                <div className="mt-2 space-y-3">
                  <span className="text-xs font-normal block">
                    Token: <strong>{result.booking.tokenNumber}</strong> • {result.booking.serviceName}
                  </span>
                  
                  {result.status === 'success' && (
                    <div className="bg-[rgba(23,23,23,0.05)] rounded-xl p-3 border border-[rgba(23,23,23,0.12)]/60 shadow-xs space-y-1.5 w-full">
                      <div className="flex justify-between items-center text-[#FF9F1C] text-xs">
                        <span>Total Slot Amount:</span>
                        <span className="font-bold">₹{result.booking.totalAmount || result.booking.amount}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#FF9F1C] text-xs mt-1">
                        <span>Slot Amount Paid:</span>
                        <span className="font-bold">₹{(result.booking.totalAmount || result.booking.amount || 0) - (result.booking.balanceAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-[rgba(23,23,23,0.12)]/60 text-[#FF9F1C] font-black text-sm">
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
                              className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FF9F1C]/90 text-[#171717] rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                              Collect ₹{result.booking.balanceAmount} & Accept
                            </button>
                            <button
                              type="button"
                              disabled={scanning}
                              onClick={() => handleAcceptAndComplete(result.booking!, false)}
                              className="w-full py-2.5 bg-transparent hover:bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] border border-[#FF9F1C] rounded-lg text-xs font-bold transition-colors"
                            >
                              Accept without Payment
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={scanning}
                            onClick={() => handleAcceptAndComplete(result.booking!, true)}
                            className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] rounded-lg text-xs font-bold transition-colors shadow-sm"
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
        <div className="relative bg-[#FFFFFF] rounded-3xl overflow-hidden aspect-4/3 flex flex-col items-center justify-center border-2 border-[rgba(23,23,23,0.12)] shadow-inner mb-5">
          {cameraActive ? (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              {/* Scanning Target Crosshairs */}
              <div className="absolute inset-8 border-2 border-[#FF9F1C] rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[11px] text-[#171717] bg-[#171717]/60 px-2 py-0.5 rounded">
                  Align QR code inside box
                </span>
              </div>
              <button
                onClick={stopCamera}
                className="absolute bottom-3 bg-[#FFFFFF] text-[#171717] text-xs px-3 py-1 rounded-full hover:bg-[rgba(23,23,23,0.05)]"
              >
                Turn off camera
              </button>
            </>
          ) : (
            <div className="p-6 text-center text-[rgba(23,23,23,0.70)] space-y-3">
              <Camera className="w-12 h-12 mx-auto stroke-1 text-[rgba(23,23,23,0.70)]" />
              <div>
                <p className="text-xs font-bold text-[#171717]">Live Camera Scanner</p>
                <p className="text-[11px] text-[rgba(23,23,23,0.70)] mt-0.5">
                  Point camera at customer's phone QR ticket
                </p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] font-bold text-xs shadow-md transition-colors inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Start Scanner Camera</span>
              </button>
            </div>
          )}
        </div>


        {/* Manual Code Input Form */}
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <label className="block text-xs font-bold text-[rgba(23,23,23,0.70)]">Or enter 6-digit code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. A012 or SLN48291-20260821-A012"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-[rgba(23,23,23,0.12)] text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] uppercase"
            />
            <button
              type="submit"
              disabled={scanning || !manualCode}
              className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(23,23,23,0.05)] disabled:bg-[#FFFFFF] text-[#171717] text-xs font-bold transition-colors shrink-0"
            >
              {scanning ? 'Checking...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
