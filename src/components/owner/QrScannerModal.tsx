import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Salon } from '../../types';
import { Capacitor } from '@capacitor/core';
import { api } from '../../services/api';
import { getBusinessTodayStr } from '../../utils/timeFormat';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Clock,
  RotateCcw,
  History,
  Check,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react';

interface QrScannerModalProps {
  salon: Salon;
  onClose: () => void;
  onCheckInSuccess: () => void;
}

interface RecentScanItem {
  bookingId: string;
  customerName: string;
  time: string;
  status: 'completed' | 'already_completed' | 'verified' | 'error';
  slotInfo?: string;
}

interface ScannedTicket {
  ticketId: string;
  customerName: string;
  venueName: string;
  slotId: string;
  slotDate: string;
  slotTime: string;
  currentStatus: string;
  completedAt?: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  paymentType?: string;
  paymentStatus?: string;
  balanceCollected?: boolean;
}

interface ScanResult {
  status: 'confirm' | 'success' | 'already_completed' | 'error';
  message: string;
  ticket?: ScannedTicket;
  completedAt?: string;
  retryAction?: 'verify' | 'complete';
  retryPayload?: string;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

// Crisp Web Audio synthesizer for success chime and error buzz
function playAudioFeedback(type: 'success' | 'error') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Pleasant double chime: 880Hz -> 1760Hz
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      // Gentle buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio context may require explicit user gesture; safe fallback
  }
}

function formatTime12H(time24?: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m < 10 ? '0' : ''}${m} ${ampm}`;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  salon,
  onClose,
  onCheckInSuccess,
}) => {
  // Scanner state
  const [cameraState, setCameraState] = useState<
    'idle' | 'requesting' | 'active' | 'denied' | 'no_camera' | 'insecure'
  >('idle');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraSwitchSupported, setCameraSwitchSupported] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');

  // Active tab: Camera scan vs ID to scan
  const [scanTab, setScanTab] = useState<'camera' | 'id'>('camera');

  // Manual fallback input
  const [manualCode, setManualCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showRecentScans, setShowRecentScans] = useState(false);

  // Verification result modal state:
  // - confirm: ticket verified on server, asking owner to Confirm Completion
  // - success: slot marked as Completed successfully
  // - already_completed: ticket was previously completed
  // - error: ticket invalid, wrong owner, cancelled, etc.
  const [result, setResult] = useState<ScanResult | null>(null);

  // Recent scans history (stored in session for live review)
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(`qgo_recent_scans_${salon.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRecentScan = useCallback((item: RecentScanItem) => {
    setRecentScans((prev) => {
      const updated = [item, ...prev.filter((x) => x.bookingId !== item.bookingId)].slice(0, 5);
      try {
        sessionStorage.setItem(`qgo_recent_scans_${salon.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [salon.id]);

  // Video / Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraGenerationRef = useRef(0);
  const facingModeRef = useRef<'environment' | 'user'>('environment');
  const scanTabRef = useRef(scanTab);
  const resultRef = useRef<ScanResult | null>(null);
  const isCompletingRef = useRef(false);

  // Debouncing & decoder refs
  const isVerifyingRef = useRef<boolean>(false);
  const barcodeDetectorRef = useRef<BarcodeDetectorLike | null>(null);
  const barcodeDetectorBusyRef = useRef(false);
  const nativeDecoderDisabledRef = useRef(false);
  const lastScanAttemptRef = useRef<number>(0);
  const lastTicketPayloadRef = useRef('');

  const setScanResult = useCallback((next: ScanResult | null) => {
    resultRef.current = next;
    setResult(next);
  }, []);

  const displayTicketId = (ticketId: string) => {
    const visibleId = ticketId.replace(/^(bk_turf_|bk_walkin_|bk_|booking_)/i, '');
    return `QGO-${visibleId}`;
  };

  // Stop camera tracks and release hardware immediately
  const stopCamera = useCallback(() => {
    cameraGenerationRef.current += 1;
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    barcodeDetectorBusyRef.current = false;
    setTorchOn(false);
    setTorchSupported(false);
    setCameraSwitchSupported(false);
  }, []);

  const handleVerifyPayload = useCallback(async (payload: string) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setIsVerifying(true);
    lastTicketPayloadRef.current = payload;
    stopCamera();

    try {
      const response = await api.verifyOwnerTicket(payload);
      if (response.success && response.ticketId) {
        playAudioFeedback('success');
        navigator.vibrate?.([100]);
        setScanResult({
          status: 'confirm',
          message: response.message || 'Ticket verified successfully.',
          ticket: {
            ticketId: response.ticketId,
            customerName: response.customerName || 'Customer',
            venueName: response.venueName || salon.name,
            slotId: response.slotId || '',
            slotDate: response.slotDate || '',
            slotTime: response.slotTime || '',
            currentStatus: response.currentStatus || 'confirmed',
            totalAmount: response.totalAmount,
            paidAmount: response.paidAmount,
            balanceDue: response.balanceDue,
            paymentType: response.paymentType,
            paymentStatus: response.paymentStatus,
            balanceCollected: response.balanceCollected,
          },
        });
        return;
      }

      const ticket = response.ticketId ? {
        ticketId: response.ticketId,
        customerName: response.customerName || 'Customer',
        venueName: response.venueName || salon.name,
        slotId: response.slotId || '',
        slotDate: response.slotDate || '',
        slotTime: response.slotTime || '',
        currentStatus: response.currentStatus || 'unknown',
        totalAmount: response.totalAmount,
        paidAmount: response.paidAmount,
        balanceDue: response.balanceDue,
        paymentType: response.paymentType,
        paymentStatus: response.paymentStatus,
        balanceCollected: response.balanceCollected,
        ...(response.completedAt ? { completedAt: response.completedAt } : {}),
      } : undefined;
      const alreadyCompleted = response.code === 'ALREADY_COMPLETED';
      setScanResult({
        status: alreadyCompleted ? 'already_completed' : 'error',
        message: response.message || 'Ticket validation failed.',
        ticket,
        completedAt: response.completedAt,
        ...(response.code === 'NETWORK_ERROR'
          ? { retryAction: 'verify', retryPayload: payload }
          : {}),
      });
      if (alreadyCompleted && ticket) {
        saveRecentScan({
          bookingId: ticket.ticketId,
          customerName: ticket.customerName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'already_completed',
          slotInfo: 'Already Completed',
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Ticket verification failed', error);
      setScanResult({
        status: 'error',
        message: 'Verification failed. Check your connection and retry.',
        retryAction: 'verify',
        retryPayload: payload,
      });
    } finally {
      setIsVerifying(false);
      isVerifyingRef.current = false;
    }
  }, [salon.name, saveRecentScan, setScanResult, stopCamera]);

  const handleConfirmComplete = async (ticket: ScannedTicket, collectBalance?: boolean) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setIsCompleting(true);

    try {
      const response = await api.completeOwnerTicket(ticket.ticketId, { collectBalance });
      if (response.success && response.ticketId) {
        playAudioFeedback('success');
        navigator.vibrate?.([100, 50, 100]);
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#E73229', '#16845B', '#FFFFFF'],
          });
        } catch (error) {
          if (import.meta.env.DEV) console.warn('[QGo Scanner] Success animation failed', error);
        }

        const completedAt = response.completedAt;
        const completedTicket: ScannedTicket = {
          ...ticket,
          currentStatus: 'completed',
          completedAt,
          balanceDue: 0,
          paidAmount: response.paidAmount ?? ticket.totalAmount,
          paymentStatus: 'PAID',
          balanceCollected: true,
        };
        saveRecentScan({
          bookingId: ticket.ticketId,
          customerName: ticket.customerName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'completed',
          slotInfo: `${ticket.slotDate || 'Today'} · ${formatTime12H(ticket.slotTime)}`,
        });
        onCheckInSuccess();
        setScanResult({
          status: 'success',
          message: `Slot completed for ${ticket.customerName}.`,
          ticket: completedTicket,
          completedAt,
        });
      } else if (response.code === 'ALREADY_COMPLETED') {
        setScanResult({
          status: 'already_completed',
          message: response.message || 'This ticket has already been completed.',
          ticket: { ...ticket, currentStatus: 'completed' },
          completedAt: response.completedAt,
        });
      } else {
        setScanResult({
          status: 'error',
          message: response.message || 'Could not complete the ticket. Please retry.',
          ticket,
          ...(response.code === 'NETWORK_ERROR' || response.code === 'COMPLETION_FAILED'
            ? { retryAction: 'complete' }
            : {}),
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Ticket completion failed', error);
      setScanResult({
        status: 'error',
        message: 'The completion request failed. Retry safely; duplicate completion is prevented.',
        ticket,
        retryAction: 'complete',
      });
    } finally {
      setIsCompleting(false);
      isCompletingRef.current = false;
    }
  };

  const handleCancelConfirm = () => {
    setScanResult(null);
    lastTicketPayloadRef.current = '';
    if (scanTabRef.current === 'camera') void startCamera();
  };

  const handleScanNext = () => {
    setScanResult(null);
    setManualCode('');
    lastTicketPayloadRef.current = '';
    if (scanTabRef.current === 'camera') void startCamera();
  };

  const handleRetry = () => {
    if (result?.retryAction === 'verify' && result.retryPayload) {
      void handleVerifyPayload(result.retryPayload);
    } else if (result?.retryAction === 'complete' && result.ticket) {
      void handleConfirmComplete(result.ticket);
    }
  };

  const getBarcodeDetector = useCallback(() => {
    if (nativeDecoderDisabledRef.current) return null;
    if (barcodeDetectorRef.current) return barcodeDetectorRef.current;
    const Detector = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    if (!Detector) return null;
    try {
      barcodeDetectorRef.current = new Detector({ formats: ['qr_code'] });
    } catch (error) {
      nativeDecoderDisabledRef.current = true;
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Native QR decoder initialization failed; using jsQR', error);
      return null;
    }
    return barcodeDetectorRef.current;
  }, []);

  const decodeCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    try {
      const detector = getBarcodeDetector();
      const detected = await detector?.detect(canvas);
      const nativeValue = detected?.find((item) => item.rawValue)?.rawValue?.trim();
      if (nativeValue) return nativeValue;
    } catch (error) {
      nativeDecoderDisabledRef.current = true;
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Native image decoder failed; using jsQR', error);
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not read the selected image.');
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data.trim() || null;
  }, [getBarcodeDetector]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      scanLoopRef.current = requestAnimationFrame(tick);
      return;
    }
    if (isVerifyingRef.current || resultRef.current || scanTabRef.current !== 'camera') {
      scanLoopRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    const frameGeneration = cameraGenerationRef.current;
    if (now - lastScanAttemptRef.current < 90) {
      scanLoopRef.current = requestAnimationFrame(tick);
      return;
    }
    lastScanAttemptRef.current = now;

    const accept = (value: string | undefined) => {
      const payload = value?.trim();
      if (
        payload
        && frameGeneration === cameraGenerationRef.current
        && scanTabRef.current === 'camera'
        && !isVerifyingRef.current
        && !resultRef.current
      ) {
        void handleVerifyPayload(payload);
      }
    };

    if (!barcodeDetectorBusyRef.current) {
      try {
        const detector = getBarcodeDetector();
        if (detector) {
          barcodeDetectorBusyRef.current = true;
          void detector.detect(video)
            .then((items) => accept(items.find((item) => item.rawValue)?.rawValue))
            .catch((error: unknown) => {
              nativeDecoderDisabledRef.current = true;
              if (import.meta.env.DEV) console.warn('[QGo Scanner] Native video decoder failed', error);
            })
            .finally(() => {
              barcodeDetectorBusyRef.current = false;
            });
        }
      } catch (error) {
        nativeDecoderDisabledRef.current = true;
        if (import.meta.env.DEV) console.warn('[QGo Scanner] Native decoder unavailable; using jsQR', error);
      }
    }

    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        accept(jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Frame decode failed', error);
    }

    scanLoopRef.current = requestAnimationFrame(tick);
  }, [getBarcodeDetector, handleVerifyPayload]);

  const startCamera = useCallback(async (mode: 'environment' | 'user' = facingModeRef.current) => {
    stopCamera();
    const generation = cameraGenerationRef.current;
    setCameraMessage('');
    setCameraState('requesting');
    setScanResult(null);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!Capacitor.isNativePlatform() && !window.isSecureContext && !isLocalhost) {
      setCameraState('insecure');
      setCameraMessage('Camera access requires HTTPS. Open this site using the secure devtunnel URL.');
      scanTabRef.current = 'id';
      setScanTab('id');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('no_camera');
      setCameraMessage('This browser does not provide camera access. Enter the ticket ID or upload a QR image.');
      scanTabRef.current = 'id';
      setScanTab('id');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 15 },
          },
          audio: false,
        });
      } catch (firstError) {
        if ((firstError as DOMException).name === 'NotAllowedError' || (firstError as DOMException).name === 'PermissionDeniedError') {
          throw firstError;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode } },
          audio: false,
        });
      }

      if (cameraGenerationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const continuousFocus = { focusMode: 'continuous' } as MediaTrackConstraintSet & { focusMode: string };
          await track.applyConstraints({ advanced: [continuousFocus] });
        } catch (error) {
          if (import.meta.env.DEV) console.warn('[QGo Scanner] Continuous autofocus is not supported', error);
        }
        const capabilities = typeof track.getCapabilities === 'function'
          ? track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
          : {};
        setTorchSupported(Boolean(capabilities.torch));
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((trackItem) => trackItem.stop());
        streamRef.current = null;
        throw new Error('Camera preview is not ready. Close and reopen the scanner.');
      }
      video.srcObject = stream;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      await video.play();
      if (cameraGenerationRef.current !== generation) {
        stream.getTracks().forEach((trackItem) => trackItem.stop());
        return;
      }
      facingModeRef.current = mode;
      setCameraState('active');
      scanLoopRef.current = requestAnimationFrame(tick);

      // Non-blocking device check in background
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (cameraGenerationRef.current === generation) {
          setCameraSwitchSupported(devices.filter((device) => device.kind === 'videoinput').length > 1);
        }
      }).catch(() => {});
    } catch (error) {
      if (cameraGenerationRef.current !== generation) return;
      const cameraError = error as DOMException;
      stopCamera();
      if (cameraError.name === 'NotFoundError' || cameraError.name === 'DevicesNotFoundError') {
        setCameraState('no_camera');
        setCameraMessage('No camera was found on this device. Enter a ticket ID or upload a QR image.');
      } else if (cameraError.name === 'NotAllowedError' || cameraError.name === 'PermissionDeniedError' || cameraError.name === 'SecurityError') {
        setCameraState('denied');
        setCameraMessage('Camera permission was denied. Allow camera access in your browser or Android app settings, or use ID to Scan.');
      } else {
        setCameraState('denied');
        setCameraMessage('Could not start the camera. Check camera permission and try again, or use ID to Scan.');
        if (import.meta.env.DEV) console.warn('[QGo Scanner] Camera start failed', error);
      }
      scanTabRef.current = 'id';
      setScanTab('id');
    }
  }, [setScanResult, stopCamera, tick]);

  const handleImageFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();

    try {
      const imageUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Could not read the selected image.');
        context.drawImage(image, 0, 0);
        const payload = await decodeCanvas(canvas);
        if (payload) {
          await handleVerifyPayload(payload);
        } else {
          setScanResult({
            status: 'error',
            message: 'No readable QR code found in this image. Choose a clearer photo or enter the ticket ID.',
          });
        }
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Uploaded image decode failed', error);
      setScanResult({
        status: 'error',
        message: 'Could not read this image. Choose another image or enter the ticket ID.',
      });
    }
  };

  const ensureVideoPlaying = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = true;
      await video.play();
      if (!scanLoopRef.current) scanLoopRef.current = requestAnimationFrame(tick);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Video resume failed', error);
    }
  }, [tick]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    try {
      const torchConstraint = { torch: !torchOn } as MediaTrackConstraintSet & { torch: boolean };
      await track.applyConstraints({ advanced: [torchConstraint] });
      setTorchOn((enabled) => !enabled);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[QGo Scanner] Torch toggle failed', error);
      setTorchSupported(false);
    }
  };

  const toggleCameraFacing = () => {
    const nextMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    facingModeRef.current = nextMode;
    void startCamera(nextMode);
  };

  useEffect(() => {
    const startupFrame = requestAnimationFrame(() => void startCamera());
    return () => {
      cancelAnimationFrame(startupFrame);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Manual code submit
  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const enteredId = manualCode.trim();
    if (enteredId) void handleVerifyPayload(enteredId);
  };

  const isEarlyArrival = (ticket?: ScannedTicket): boolean => {
    if (!ticket?.slotTime) return false;
    const now = new Date();
    const todayStr = getBusinessTodayStr();
    if (ticket.slotDate && ticket.slotDate > todayStr) return true;
    if (!ticket.slotDate || ticket.slotDate === todayStr) {
      const [hour, minute] = ticket.slotTime.split(':').map(Number);
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        return now.getHours() * 60 + now.getMinutes() < hour * 60 + minute - 15;
      }
    }
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="QR Ticket Scanner"
    >
      <div className="relative w-full max-w-lg glass-strong rounded-[28px] p-5 sm:p-6 shadow-2xl z-10 border border-white/80 max-h-[95vh] flex flex-col overflow-hidden text-[#000000]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-black/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-[#000000] border border-red-200">
              <QrCode className="w-5 h-5 text-[#E73229]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#000000] leading-tight">
                Scan Customer Ticket
              </h2>
              <p className="text-[12px] text-[#444444] font-medium leading-tight">
                {salon.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Hidden file input for QR code photo upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageFileScan}
            />

            {/* Upload QR Image button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-full glass flex items-center justify-center text-[#000000] hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
              title="Upload QR Image"
              aria-label="Upload QR Image"
            >
              <Upload className="w-4 h-4 text-[#000000]" />
            </button>

            {/* Flashlight toggle */}
            {torchSupported && cameraState === 'active' && (
              <button
                type="button"
                onClick={toggleTorch}
                className="w-9 h-9 rounded-full glass flex items-center justify-center text-[#000000] hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
                title={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                aria-label="Toggle flashlight"
              >
                {torchOn ? (
                  <FlashlightOff className="w-4 h-4 text-amber-500" />
                ) : (
                  <Flashlight className="w-4 h-4 text-[#444444]" />
                )}
              </button>
            )}

            {/* Camera switch toggle */}
            {cameraSwitchSupported && cameraState === 'active' && (
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="w-9 h-9 rounded-full glass flex items-center justify-center text-[#000000] hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
                title="Switch camera"
                aria-label="Switch camera"
              >
                <SwitchCamera className="w-4 h-4 text-[#444444]" />
              </button>
            )}

            {/* Close button with min 44px hit target */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-10 h-10 rounded-full glass flex items-center justify-center text-[#000000] hover:bg-black/5 active:scale-95 transition-all ml-1 cursor-pointer"
              aria-label="Close scanner"
            >
              <X className="w-5 h-5 text-[#000000]" />
            </button>
          </div>
        </div>

        {/* 2 Options Bar: Proper Scanning Way vs ID to Scan */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/5 rounded-2xl shrink-0 my-2.5 border border-black/5">
          <button
            type="button"
            onClick={() => {
              scanTabRef.current = 'camera';
              setScanTab('camera');
              if (cameraState !== 'active' && cameraState !== 'requesting') void startCamera();
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanTab === 'camera'
                ? 'bg-white text-[#0A0A0A] shadow-sm'
                : 'text-[#5C5C5C] hover:text-[#0A0A0A]'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#E73229]" />
            <span>1. Proper Scan Way</span>
          </button>

          <button
            type="button"
            onClick={() => {
              scanTabRef.current = 'id';
              setScanTab('id');
              setCameraState('idle');
              stopCamera();
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanTab === 'id'
                ? 'bg-white text-[#0A0A0A] shadow-sm'
                : 'text-[#5C5C5C] hover:text-[#0A0A0A]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-[#E73229]" />
            <span>2. ID to Scan</span>
          </button>
        </div>

        {/* Scrollable Scanner Body */}
        <div className="flex-1 overflow-y-auto scrollbar-none py-2 space-y-3">
          {scanTab === 'camera' && (
            <>
              {/* CAMERA PREVIEW & SCAN FRAME BOX */}
              <div
                onClick={ensureVideoPlaying}
                className="relative w-full aspect-square max-h-[300px] rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner border border-black/10 cursor-pointer"
              >
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${cameraState === 'active' ? '' : 'invisible'}`}
                  playsInline
                  muted
                  autoPlay
                />
                {cameraState === 'active' && (
                  <>
                    {/* Animated Square Scan Frame */}
                    <div className="absolute inset-8 sm:inset-12 pointer-events-none flex items-center justify-center">
                      <div className="absolute inset-0 rounded-2xl border-2 border-red-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.50)] animate-corner-pulse">
                        {/* 4 Animated Corner Brackets */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-lg" />

                        {/* Moving Laser Scan Line */}
                        {!result && (
                          <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(231,50,41,0.9)] animate-scan-line" />
                        )}
                      </div>

                      <span className="absolute -bottom-7 text-[11px] font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                        Point camera steadily at customer's ticket QR
                      </span>
                    </div>
                  </>
                )}

                {cameraState === 'requesting' && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-2">
                    <div className="w-8 h-8 border-3 border-white/20 border-t-red-500 rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-white/90">Starting camera...</p>
                  </div>
                )}

                {cameraState === 'idle' && (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Ready to scan customer ticket</p>
                      <p className="text-[11px] text-white/70 max-w-xs mt-1">
                        Only the venue owner can validate and complete tickets.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 rounded-xl bg-white text-[#0A0A0A] text-xs font-bold active:scale-95 transition-all cursor-pointer"
                    >
                      Enable Camera
                    </button>
                  </div>
                )}

                {cameraState === 'denied' && (
                  <div className="flex flex-col items-center justify-center p-5 text-center text-white space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-red-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Camera Access Denied</p>
                      <p className="text-[11px] text-white/70 max-w-xs mt-1">
                        Camera permission was blocked. You can type the Ticket ID directly in "2. ID to Scan".
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          scanTabRef.current = 'id';
                          setScanTab('id');
                          stopCamera();
                        }}
                        className="px-4 py-2 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-white" />
                        <span>Switch to ID to Scan</span>
                      </button>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3.5 py-2 rounded-xl glass text-xs font-semibold text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                      >
                        Retry Camera
                      </button>
                    </div>
                  </div>
                )}

                {cameraState === 'no_camera' && (
                  <div className="flex flex-col items-center justify-center p-5 text-center text-white space-y-2.5">
                    <Camera className="w-10 h-10 text-white/40" />
                    <p className="text-xs font-bold text-white">No Camera Detected</p>
                    <p className="text-[11px] text-white/70 max-w-xs">
                      No hardware camera found on this device. Please enter the Ticket ID manually.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        scanTabRef.current = 'id';
                        setScanTab('id');
                        stopCamera();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-white" />
                      <span>Switch to ID to Scan</span>
                    </button>
                  </div>
                )}

                {cameraState === 'insecure' && (
                  <div className="flex flex-col items-center justify-center p-5 text-center text-white space-y-2.5">
                    <AlertCircle className="w-10 h-10 text-amber-400" />
                    <p className="text-xs font-bold text-white">HTTPS Required for Camera</p>
                    <p className="text-[11px] text-white/70 max-w-xs">
                      Mobile browsers require HTTPS for camera hardware. Enter the Ticket ID below.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        scanTabRef.current = 'id';
                        setScanTab('id');
                        stopCamera();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-white" />
                      <span>Switch to ID to Scan</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scanning Tips */}
              <div className="bg-white/80 border border-black/10 rounded-2xl p-3 text-xs text-[#444444] space-y-1">
                <p className="font-bold text-[#0A0A0A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16845B]" />
                  <span>Proper Scanning Tips:</span>
                </p>
                <p className="text-[11px]">• Keep camera 15-20 cm from customer's ticket QR.</p>
                <p className="text-[11px]">• Camera stops automatically as soon as ticket is verified.</p>
                <p className="text-[11px]">• Or tap "2. ID to Scan" above to verify by Ticket ID.</p>
              </div>
            </>
          )}

          {scanTab === 'id' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-black/10 shadow-sm space-y-3">
              {cameraMessage && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                  {cameraMessage}
                </p>
              )}
              <div>
                <h3 className="font-bold text-sm text-[#0A0A0A]">Enter Customer Ticket ID</h3>
                <p className="text-xs text-[#5C5C5C] mt-0.5">
                  Enter the full Ticket ID printed below the QR on the customer’s pass.
                </p>
              </div>
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="flex items-center rounded-xl bg-[#F7F7F7] border-2 border-black/15 focus-within:border-[#E73229] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#E73229]/20 overflow-hidden shadow-xs transition-all">
                  <span className="px-3 py-3 bg-black/5 font-mono font-black text-sm text-[#E73229] border-r border-black/10 select-none">
                    QGO-
                  </span>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => {
                      let val = e.target.value.toUpperCase();
                      if (val.startsWith('QGO-')) val = val.slice(4);
                      else if (val.startsWith('QGO')) val = val.slice(3);
                      setManualCode(val.trim());
                    }}
                    placeholder="ENTER TICKET ID"
                    className="flex-1 px-3 py-3 text-sm font-bold font-mono tracking-wider uppercase text-[#0A0A0A] bg-transparent outline-none placeholder:text-[#888888]"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isVerifying || !manualCode.trim()}
                    className="flex-1 py-3 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying Ticket...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Verify &amp; Confirm Slot</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-3 rounded-xl glass text-xs font-semibold text-[#0A0A0A] hover:bg-black/5 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Upload QR Photo"
                  >
                    <Upload className="w-4 h-4 text-[#0A0A0A]" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* RECENT SCANS ACCORDION */}
          {recentScans.length > 0 && (
            <div className="pt-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => setShowRecentScans(!showRecentScans)}
                className="w-full flex items-center justify-between text-xs font-bold text-[#444444] hover:text-[#000000] py-1 cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#444444]" />
                  <span>Recent Scans ({recentScans.length})</span>
                </div>
                {showRecentScans ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showRecentScans && (
                <div className="mt-2 space-y-1.5 animate-tab-content">
                  {recentScans.map((item, idx) => (
                    <div
                      key={`${item.bookingId}-${idx}`}
                      className="glass p-2.5 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#000000]">
                            {displayTicketId(item.bookingId)}
                          </span>
                          <span className="font-semibold text-[#111111]">
                            · {item.customerName}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#5C5C5C]">{item.slotInfo || item.time}</span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          item.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'already_completed'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'verified'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status === 'completed'
                          ? 'COMPLETED'
                          : item.status === 'already_completed'
                          ? 'ALREADY COMPLETED'
                          : item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {result && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-2xl max-w-sm w-full border border-black/10 flex flex-col gap-3 animate-scale-up text-[#0A0A0A] max-h-[92vh] overflow-y-auto">
              {result.status === 'confirm' && result.ticket && (
                <>
                  <div className="text-center">
                    <div className="w-11 h-11 rounded-full bg-red-50 text-[#E73229] border border-red-100 flex items-center justify-center mx-auto">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-lg pt-1">Confirm Slot Completion</h3>
                    <p className="text-xs text-[#5C5C5C] font-semibold">{result.ticket.venueName}</p>
                  </div>
                  {isEarlyArrival(result.ticket) && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5 text-[11px] font-semibold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Slot starts at {formatTime12H(result.ticket.slotTime)}. Confirm only after the slot is finished.</span>
                    </div>
                  )}
                  {/* Mandatory Balance Collection Alert Box if balance is due */}
                  {result.ticket.balanceDue && result.ticket.balanceDue > 0 && !result.ticket.balanceCollected ? (
                    <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 space-y-2 text-center animate-in fade-in">
                      <div className="flex items-center justify-center gap-1.5 text-amber-800 font-extrabold text-xs uppercase tracking-wide">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Venue Balance Collection Required</span>
                      </div>
                      <p className="text-2xl font-black text-amber-950 tabular-nums">
                        ₹{result.ticket.balanceDue.toLocaleString('en-IN')} Due
                      </p>
                      <p className="text-[11px] text-amber-800 font-medium">
                        Customer booked with Advance. Collect ₹{result.ticket.balanceDue} cash/UPI at venue before completing slot.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 flex items-center justify-center gap-2 text-xs text-emerald-800 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Full Amount Paid Online (₹0 Due)</span>
                    </div>
                  )}

                  <div className="bg-[#F8F9FA] p-3 rounded-2xl border border-black/10 space-y-2 text-xs">
                    <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                      <span className="font-bold text-[#5C5C5C]">Ticket ID</span>
                      <span className="font-mono font-bold text-[#E73229] text-right break-all">{displayTicketId(result.ticket.ticketId)}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                      <span className="font-bold text-[#5C5C5C]">Customer</span>
                      <span className="font-bold text-right">{result.ticket.customerName}</span>
                    </div>
                    {typeof result.ticket.totalAmount === 'number' && result.ticket.totalAmount > 0 && (
                      <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                        <span className="font-bold text-[#5C5C5C]">Total Slot Price</span>
                        <span className="font-bold text-right">₹{result.ticket.totalAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {typeof result.ticket.paidAmount === 'number' && (
                      <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                        <span className="font-bold text-[#5C5C5C]">Paid Online</span>
                        <span className="font-bold text-emerald-700 text-right">₹{result.ticket.paidAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {result.ticket.balanceDue && result.ticket.balanceDue > 0 ? (
                      <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                        <span className="font-bold text-[#DC2626]">Balance Due at Venue</span>
                        <span className="font-extrabold text-[#DC2626] text-right">₹{result.ticket.balanceDue.toLocaleString('en-IN')}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                      <span className="font-bold text-[#5C5C5C]">Venue</span>
                      <span className="font-bold text-right break-words">{result.ticket.venueName}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-black/5 pb-1.5">
                      <span className="font-bold text-[#5C5C5C]">Slot</span>
                      <span className="font-bold text-right">
                        {result.ticket.slotDate || 'Date unavailable'} · {formatTime12H(result.ticket.slotTime) || 'Time unavailable'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#5C5C5C]">Current Status</span>
                      <span className="font-bold px-2 py-0.5 rounded-full text-[10px] uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {result.ticket.currentStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-red-50/80 border border-red-200/80 rounded-2xl p-3 text-center">
                    <p className="text-sm font-black">Mark this slot as Completed?</p>
                  </div>
                  <button
                    type="button"
                    disabled={isCompleting}
                    onClick={() => void handleConfirmComplete(result.ticket!, Boolean(result.ticket?.balanceDue && result.ticket.balanceDue > 0))}
                    className="w-full min-h-12 px-4 rounded-xl bg-[#E73229] hover:bg-[#D42B22] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isCompleting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Completing…</span>
                      </>
                    ) : result.ticket.balanceDue && result.ticket.balanceDue > 0 && !result.ticket.balanceCollected ? (
                      <>
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>Confirm ₹{result.ticket.balanceDue} Balance Collected &amp; Complete Slot</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>Yes, Complete</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isCompleting}
                    onClick={handleCancelConfirm}
                    className="w-full min-h-12 px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm disabled:opacity-50"
                  >
                    No, Cancel
                  </button>
                </>
              )}

              {result.status === 'success' && result.ticket && (
                <>
                  <div className="text-center space-y-1">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                      <Check className="w-3 h-3" /> Completed
                    </span>
                    <h3 className="font-black text-lg">Slot Completed</h3>
                    <p className="text-xs text-[#5C5C5C]">{result.ticket.customerName} · {result.ticket.venueName}</p>
                  </div>
                  <div className="bg-[#F8F9FA] p-3 rounded-2xl border border-black/10 space-y-2 text-xs">
                    <p><strong>Ticket ID:</strong> <span className="font-mono">{displayTicketId(result.ticket.ticketId)}</span></p>
                    <p><strong>Slot:</strong> {result.ticket.slotDate || 'Date unavailable'} · {formatTime12H(result.ticket.slotTime) || 'Time unavailable'}</p>
                    {result.completedAt && (
                      <p><strong>Completed at:</strong> {new Date(result.completedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <button type="button" onClick={handleScanNext} className="w-full min-h-12 rounded-xl bg-[#E73229] text-white font-bold text-sm flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Scan Next
                  </button>
                </>
              )}

              {result.status === 'already_completed' && (
                <>
                  <div className="text-center space-y-1">
                    <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
                    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black uppercase">Already Completed</span>
                    <p className="text-xs text-amber-900 font-medium leading-relaxed">{result.message}</p>
                  </div>
                  {result.ticket && (
                    <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2 text-xs">
                      <p><strong>Ticket ID:</strong> <span className="font-mono">{displayTicketId(result.ticket.ticketId)}</span></p>
                      <p><strong>Customer:</strong> {result.ticket.customerName}</p>
                      <p><strong>Slot:</strong> {result.ticket.slotDate || 'Date unavailable'} · {formatTime12H(result.ticket.slotTime) || 'Time unavailable'}</p>
                      {(result.completedAt || result.ticket.completedAt) && (
                        <p><strong>Completed at:</strong> {new Date(result.completedAt || result.ticket.completedAt!).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={handleScanNext} className="w-full min-h-12 rounded-xl bg-[#E73229] text-white font-bold text-sm flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Scan Next
                  </button>
                </>
              )}

              {result.status === 'error' && (
                <>
                  <div className="text-center space-y-2">
                    <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
                    <h3 className="font-black text-lg text-red-900">Ticket Could Not Be Verified</h3>
                    <p className="text-xs text-red-700 font-medium leading-relaxed">{result.message}</p>
                  </div>
                  <div className="flex gap-2">
                    {result.retryAction && (
                      <button
                        type="button"
                        disabled={isCompleting || isVerifying}
                        onClick={handleRetry}
                        className="flex-1 min-h-12 rounded-xl border border-slate-300 bg-slate-100 text-slate-700 font-bold text-xs disabled:opacity-50"
                      >
                        {isCompleting || isVerifying ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isCompleting || isVerifying}
                      onClick={handleScanNext}
                      className="flex-1 min-h-12 rounded-xl bg-[#E73229] text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Scan Again
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
