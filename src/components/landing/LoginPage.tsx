import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, MapPin, Clock,
  Users, CheckCircle2, Smartphone, KeyRound,
  User, Building2, ChevronRight, X, Settings
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { QGoLogo } from './QGoLogo';
import { useAuth } from '../../context/AuthContext';
import { GoogleAuthButton } from '../auth/GoogleAuthButton';
import { api, getEffectiveApiOrigin, setCustomApiUrl, DEFAULT_CLOUD_API_URL } from '../../services/api';

/* ─── Google SVG Logo ─── */
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ─── Left Panel — QGo Visual ─── */
const LeftPanel: React.FC = () => {
  const [tick, setTick] = useState(36);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v < 38 ? v + 1 : 36), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative flex flex-col justify-between p-10 lg:p-12 overflow-hidden"
      style={{ background: 'var(--q-canvas-soft)' }}
    >
      {/* Background radial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 30% 30%, rgba(232,52,42,0.06) 0%, transparent 70%)' }}
      />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(var(--qp-border) 1px, transparent 1px), linear-gradient(90deg, var(--qp-border) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top: Logo + Tagline */}
      <div className="relative">
        <QGoLogo size="md" />
        <p className="mt-4 text-sm font-medium" style={{ color: 'var(--qp-text-muted)' }}>
          Book Before You Go. Know Before You Wait.
        </p>
      </div>

      {/* Center: Live Ticket Card */}
      <div className="relative flex justify-center py-10">
        <div className="" style={{ animationDuration: '5s' }}>
          {/* Main ticket */}
          <div
            className="rounded-3xl overflow-hidden shadow-lg"
            style={{ width: 280, background: 'var(--q-canvas)', border: '1px solid var(--q-hairline)' }}
          >
            <div className="p-5" style={{ background: 'linear-gradient(135deg, var(--q-ink) 0%, #262626 100%)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: 'rgba(232,52,42,0.20)', color: '#FFFFFF' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8342A] animate-pulse" />
                  LIVE QUEUE
                </div>
                <div className="text-white/60 text-xs font-mono">QGo</div>
              </div>
              <div className="text-white">
                <div className="text-xs font-medium opacity-70 mb-1">Apex Diagnostic Lab</div>
                <div className="text-4xl font-black tracking-tight">#A042</div>
                <div className="text-xs opacity-60 mt-1">Your token number</div>
              </div>
            </div>

            {/* Perforation */}
            <div className="flex items-center" style={{ marginLeft: -6, marginRight: -6 }}>
              <div className="w-6 h-6 rounded-full shrink-0" style={{ background: 'var(--qp-bg)' }} />
              <div className="flex-1 border-t border-dashed" style={{ borderColor: 'var(--qp-border)' }} />
              <div className="w-6 h-6 rounded-full shrink-0" style={{ background: 'var(--qp-bg)' }} />
            </div>

            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--qp-text-muted)' }}>Serving</div>
                  <div className="text-lg font-black transition-colors duration-150" style={{ color: 'var(--qp-success)' }}>#{tick}</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--qp-text-muted)' }}>Ahead</div>
                  <div className="text-lg font-black" style={{ color: 'var(--qp-text)' }}>{42 - tick}</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--qp-text-muted)' }}>Wait</div>
                  <div className="text-lg font-black" style={{ color: 'var(--qp-accent)' }}>
                    {Math.max((42 - tick) * 5, 0)}m
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--qp-border)' }}>
                <div
                  className="h-full rounded-full transition-colors duration-150 duration-1000"
                  style={{
                    width: `${Math.min(((tick - 30) / 12) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, var(--q-red-action), var(--q-red))',
                  }}
                />
              </div>
              <div className="text-[11px] text-right mt-1" style={{ color: 'var(--qp-text-muted)' }}>
                {Math.round(((tick - 30) / 12) * 100)}% through queue
              </div>
            </div>
          </div>

          {/* Floating mini chips */}
          <div
            className="absolute -top-6 -right-8 rounded-2xl p-3 shadow-xl"
            style={{ width: 140, background: 'var(--q-canvas)', border: '1px solid var(--q-hairline)', animationDelay: '0.5s' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={11} color="var(--qp-success)" />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--qp-success)' }}>Confirmed</span>
            </div>
            <div className="text-xs font-bold" style={{ color: 'var(--qp-text)' }}>Blood Test</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--qp-text-muted)' }}>10:30 AM · Today</div>
          </div>

          <div
            className="absolute -bottom-6 -left-8 rounded-2xl p-3 shadow-xl"
            style={{ width: 148, background: 'var(--q-canvas)', border: '1px solid var(--q-hairline)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={11} color="var(--qp-accent)" />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--qp-accent)' }}>1.4 km away</span>
            </div>
            <div className="text-xs font-bold" style={{ color: 'var(--qp-text)' }}>City Dental Clinic</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--qp-text-muted)' }}>0 waiting · 0m</div>
          </div>
        </div>
      </div>

      {/* Bottom: Features */}
      <div className="relative space-y-3">
        {[
          { Icon: Users, text: 'See live queue in real-time' },
          { Icon: Clock, text: 'Know exactly when to arrive' },
          { Icon: MapPin, text: 'Find businesses near you' },
        ].map(({ Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--qp-primary-soft)' }}>
              <Icon size={14} color="var(--qp-accent)" />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--qp-text-sec)' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Auth View Types ─── */
interface LoginPageProps {
  defaultView?: 'login' | 'register';
  onClose?: () => void;
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ defaultView = 'login', onClose, onSuccess }) => {
  const { loginWithGoogle, loginWithOtp, requestOtp, switchRole } = useAuth();

  const [role, setRole] = useState<'consumer' | 'owner'>(() => {
    if (typeof window !== 'undefined' && /^\/(owner|dashboard)/i.test(window.location.pathname)) {
      return 'owner';
    }
    return 'consumer';
  });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpName, setOtpName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Server settings configuration for mobile APK (developer/debug mode only)
  const [showServerModal, setShowServerModal] = useState(false);
  const [currentApiOrigin, setCurrentApiOrigin] = useState(() => getEffectiveApiOrigin() || DEFAULT_CLOUD_API_URL);
  const [serverUrlInput, setServerUrlInput] = useState(() => getEffectiveApiOrigin() || DEFAULT_CLOUD_API_URL);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message: string; ok?: boolean } | null>(null);

  const handleTestServer = async (testUrl?: string) => {
    const target = (testUrl || serverUrlInput).trim().replace(/\/+$/, '');
    if (!target) return;
    setTestStatus({ testing: true, message: `Connecting to ${target}...` });
    try {
      const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        setTestStatus({ testing: false, ok: true, message: '✔ Connected to QGo Server!' });
      } else {
        setTestStatus({ testing: false, ok: false, message: `✕ Server responded with HTTP ${res.status}` });
      }
    } catch (e: any) {
      setTestStatus({ testing: false, ok: false, message: `✕ Cannot reach server (${e?.message || 'timeout'})` });
    }
  };

  const handleSaveServer = (newUrl: string) => {
    setCustomApiUrl(newUrl.trim());
    setCurrentApiOrigin(getEffectiveApiOrigin());
    setShowServerModal(false);
    setError(null);
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    // If navigating to the login page with orphaned/stale tokens, clean them up
    const token = localStorage.getItem('qgo_token');
    const userStr = localStorage.getItem('qgo_user');
    if (token && !userStr) {
      localStorage.removeItem('qgo_token');
    }
  }, []);

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setGoogleLoading(true);
    setError(null);
    try {
      localStorage.removeItem('qgo_token');
      localStorage.removeItem('qgo_user');
      const token = tokenResponse.access_token || tokenResponse.credential;
      if (!token) {
        setError({ message: 'Google did not return a verifiable credential. Please try again.' });
        return;
      }
      const res = await loginWithGoogle(token, role, tokenResponse.access_token);
      if (res.success) {
        onSuccess?.();
      } else {
        setError({
          message: res.error || 'Authentication failed. Please try again.',
          code: res.code,
        });
      }
    } catch (e: any) {
      setError({
        message: e?.message || 'Network error. Please check your connection and try again.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSwitchToCustomer = () => {
    setRole('consumer');
    setError(null);
  };

  const handleRequestOtp = async () => {
    const rawPhone = otpPhone.trim();
    if (!rawPhone) {
      setError({ message: 'Enter your phone number to receive a verification code.' });
      return;
    }
    const clean = rawPhone.replace(/[\s\-()]/g, '');
    if (!/^(?:\+?[1-9]\d{9,14}|[6-9]\d{9})$/.test(clean)) {
      setError({ message: 'Please enter a valid 10-digit mobile number (e.g. 9876543210).' });
      return;
    }

    setOtpLoading(true);
    setError(null);
    try {
      const res = await requestOtp(rawPhone);
      if (!res.success) {
        setError({ message: res.error || 'Could not send verification code.' });
        return;
      }
      setDevOtpCode(res.devOtp || null);
      setOtpSent(true);
      setCountdown(30);
      setOtpCode(res.devOtp || '');
    } catch (e: any) {
      setError({ message: e?.message || 'Could not request verification code.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPhone.trim()) {
      setError({ message: 'Phone number is required.' });
      return;
    }

    const codeToUse = otpCode.trim();
    if (!/^\d{6}$/.test(codeToUse)) {
      setError({ message: 'Please enter a valid 6-digit verification code.' });
      return;
    }

    setOtpLoading(true);
    setError(null);
    try {
      localStorage.removeItem('qgo_token');
      localStorage.removeItem('qgo_user');
      const res = await loginWithOtp(otpPhone.trim(), codeToUse, otpName.trim() || undefined, role);
      if (res.success) {
        onSuccess?.();
      } else {
        setError({ message: res.error || 'Verification failed. Please check the code and try again.' });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: 'var(--qp-bg)' }}>
      {/* Left Panel — visual hero */}
      <div className="hidden lg:block">
        <LeftPanel />
      </div>

      {/* Right Panel — Auth Form */}
      <div
        className="flex flex-col min-h-screen relative overflow-y-auto"
        style={{
          background: 'var(--qp-bg)',
          borderLeft: '1px solid var(--qp-border)',
          // Push content below the Android status bar on native (safe-area-inset-top)
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div id="qgo-phone-recaptcha" />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-6 p-2 rounded-xl text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)] transition-colors z-10"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
            title="Back to home"
          >
            <X size={20} />
          </button>
        )}

        {/* Mobile header — extra top spacing reserved for safe-area on native */}
        <div className="lg:hidden px-6 pb-4" style={{ paddingTop: '2rem' }}>
          <QGoLogo size="md" />
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-12">
          <div className="max-w-md mx-auto w-full bg-[#FFFFFF] rounded-[28px] p-6 sm:p-8 shadow-[0_8px_32px_rgba(10,10,10,0.07)] border border-[rgba(10,10,10,0.08)]">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="hidden lg:flex justify-center mb-5">
                <QGoLogo size="sm" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A0A0A]">
                {defaultView === 'register' ? 'Get Started with QGo' : 'Welcome to QGo'}
              </h1>
              <p className="mt-2 text-sm text-[#5C5C5C]">
                Book Before You Go. Know Before You Wait.
              </p>
            </div>

            {/* Server connection pill for native mobile app (developer/debug mode only) */}
            {Capacitor.isNativePlatform() && (import.meta.env.DEV || import.meta.env.VITE_QGO_DEBUG === 'true') && (
              <div className="flex justify-center mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowServerModal(true);
                    setTestStatus(null);
                  }}
                  className="px-3 py-1 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-xs font-semibold text-[#4B5563] flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200"
                  title="Configure Backend Server Address"
                >
                  <Settings size={13} className="text-[#E73229]" />
                  <span>Server: {currentApiOrigin ? currentApiOrigin.replace(/^https?:\/\//, '') : 'qgo-backend.onrender.com'}</span>
                </button>
              </div>
            )}

            {/* Error Banner with Role Mismatch and Server Resolution */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-[rgba(179,38,30,0.12)] border border-[rgba(179,38,30,0.20)] text-[var(--q-error)] text-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-2.5">
                  <X size={18} className="mt-0.5 shrink-0 text-[var(--q-error)]" />
                  <span className="font-medium text-[var(--q-error)]">{error.message}</span>
                </div>
                {Capacitor.isNativePlatform() && (import.meta.env.DEV || import.meta.env.VITE_QGO_DEBUG === 'true') && (
                  <div className="pt-2 border-t border-[rgba(179,38,30,0.20)]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowServerModal(true);
                        setTestStatus(null);
                      }}
                      className="text-xs font-bold text-[#b91c1c] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Settings size={13} />
                      <span>Change Server Address (Connect to Hotspot or Cloud)</span>
                    </button>
                  </div>
                )}
                {(error.code === 'OWNER_ACCESS_DENIED' || error.code === 'STAFF_ACCESS_DENIED' || error.message.includes('access')) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--q-hairline)]">
                    <button
                      onClick={() => setError(null)}
                      className="px-3 py-1.5 rounded-lg bg-[#ECECEF] hover:bg-[#E2E2E6] text-xs font-bold text-[#0A0A0A] transition-colors cursor-pointer"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleSwitchToCustomer}
                      className="px-3 py-1.5 rounded-lg bg-[var(--q-grad-cta)] hover:opacity-90 text-xs font-bold text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <User size={13} />
                      <span>Use Customer Login</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {!otpSent ? (
              <>
                {/* ── ROLE SELECTOR (Customer | Owner) ── */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5C5C5C]">
                      Select your role
                    </label>
                    <span className="text-[11px] text-[#5C5C5C]">
                      Role is locked after login
                    </span>
                  </div>

                  {/* Segmented Control with 2 roles */}
                  <div
                    role="radiogroup"
                    aria-label="User role selection"
                    className="p-1 rounded-xl bg-[#ECECEF] border border-[rgba(10,10,10,0.06)] grid grid-cols-2 gap-1 shadow-inner"
                  >
                    {([
                      { id: 'consumer', label: 'Customer', icon: User },
                      { id: 'owner', label: 'Owner', icon: Building2 },
                    ] as const).map(({ id, label, icon: Icon }) => {
                      const isSelected = role === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => {
                            setRole(id);
                            setError(null);
                          }}
                          className={`relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'shadow-xs bg-white text-[#0A0A0A]'
                              : 'text-[#5C5C5C] hover:text-[#0A0A0A] hover:bg-black/5'
                          }`}
                        >
                          <Icon
                            size={15}
                            className={isSelected ? 'text-[#0A0A0A]' : 'text-[#5C5C5C]'}
                          />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── GOOGLE AUTH BUTTON ── */}
                <div className="space-y-4">
                  <GoogleAuthButton
                    role={role}
                    loading={googleLoading}
                    onSuccess={handleGoogleSuccess}
                    onError={(err) => setError({ message: err.message })}
                  />

                  <div className="text-center">
                    <p className="text-[11px] text-[#5C5C5C]">
                      Secured with Google OAuth 2.0 &amp; OpenID Connect
                    </p>
                  </div>
                </div>

                {/* ── DIVIDER ── */}
                <div className="relative my-6 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[rgba(10,10,10,0.08)]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#FFFFFF] px-3 text-[#767676] font-medium">or continue with mobile number</span>
                  </div>
                </div>

                {/* ── PHONE NUMBER REQUEST SECTION ── */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={otpName}
                    onChange={(e) => setOtpName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full px-3.5 py-3 rounded-[12px] border border-[rgba(10,10,10,0.10)] bg-[#F3F3F5] text-[#0A0A0A] placeholder:text-[#767676] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />

                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="min-w-0 flex-1 px-3.5 py-3 rounded-[12px] border border-[rgba(10,10,10,0.10)] bg-[#F3F3F5] text-[#0A0A0A] placeholder:text-[#767676] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                    />
                    <button
                      type="button"
                      id="request-otp-btn"
                      onClick={handleRequestOtp}
                      disabled={otpLoading}
                      className="px-5 py-3 rounded-[12px] bg-[#0A0A0A] hover:bg-[#222222] disabled:opacity-50 text-white font-bold text-sm flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-sm"
                    >
                      {otpLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Smartphone size={16} />
                          <span>Send Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── DEDICATED MOBILE-OPTIMIZED OTP VERIFICATION VIEW ── */
              <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(10,10,10,0.08)]">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#5C5C5C] hover:text-[#0A0A0A] transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                    <span>Change Number</span>
                  </button>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-[#ECECEF] text-[#0A0A0A]">
                    {role === 'owner' ? 'Owner Account' : 'Customer Account'}
                  </span>
                </div>

                <div className="text-left space-y-1">
                  <h2 className="text-lg font-bold text-[#0A0A0A]">Enter Verification Code</h2>
                  <p className="text-xs text-[#5C5C5C]">
                    We sent a 6-digit SMS verification code to <strong className="text-[#0A0A0A] font-semibold">{otpPhone}</strong>
                  </p>
                </div>

                <form onSubmit={handleOtpLogin} className="space-y-4">
                  {devOtpCode && (
                    <div className="p-3 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl flex items-center justify-between text-xs text-[#92400E]">
                      <div>
                        <span className="font-semibold text-[#78350F]">Verification Code: </span>
                        <span className="font-mono font-black text-sm tracking-widest text-[#92400E] ml-1">{devOtpCode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOtpCode(devOtpCode)}
                        className="px-2.5 py-1 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                      >
                        Autofill
                      </button>
                    </div>
                  )}
                  <div>
                    <input
                      type="text"
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="• • • • • •"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="w-full py-3.5 px-4 rounded-xl border-2 border-[rgba(10,10,10,0.14)] bg-[#F8F8FA] text-[#0A0A0A] placeholder:text-[#AAAAAA] text-2xl font-bold tracking-[0.5em] text-center focus:outline-none focus:border-[#E73229] focus:ring-2 focus:ring-[#E73229]/20 transition-all shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    id="otp-login-go-btn"
                    disabled={otpLoading || otpCode.trim().length < 6}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all duration-150 bg-[#E73229] hover:bg-[#D42B23] text-white active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {otpLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-white font-bold tracking-wide">Verify &amp; Continue</span>
                        <ArrowRight size={16} className="text-white stroke-[2.5]" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    {countdown > 0 ? (
                      <span className="text-xs text-[#767676] font-medium">
                        Resend code in <strong className="text-[#0A0A0A]">{countdown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpLoading}
                        className="text-xs font-bold text-[#E73229] hover:underline transition-colors cursor-pointer"
                      >
                        Didn't receive code? Resend
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[rgba(10,10,10,0.08)] text-center">
              <p className="text-[11px] text-[#5C5C5C]">
                By continuing, you agree to our{' '}
                <a href="#" className="text-[#0A0A0A] underline hover:text-[#E73229]">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-[#0A0A0A] underline hover:text-[#E73229]">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Server Settings Modal for mobile */}
        {showServerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Settings size={18} className="text-[#E73229]" />
                  <span>Backend Server Settings</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Connect your mobile app to your laptop hotspot, Wi-Fi, or 24/7 cloud server:
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Server URL:</label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://192.168.137.1:3000"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E73229] font-mono"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Quick Presets:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setServerUrlInput('https://qgo-backend.onrender.com');
                      handleTestServer('https://qgo-backend.onrender.com');
                    }}
                    className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-left transition-colors cursor-pointer col-span-2"
                  >
                    <div className="text-xs font-bold text-[#E73229]">Cloud Production (Render)</div>
                    <div className="text-[10px] text-gray-600 font-mono">https://qgo-backend.onrender.com</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServerUrlInput('http://192.168.137.1:3000');
                      handleTestServer('http://192.168.137.1:3000');
                    }}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-gray-800">Mobile Hotspot</div>
                    <div className="text-[10px] text-gray-500 font-mono">192.168.137.1:3000</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServerUrlInput('http://10.10.117.15:3000');
                      handleTestServer('http://10.10.117.15:3000');
                    }}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-gray-800">Home Wi-Fi</div>
                    <div className="text-[10px] text-gray-500 font-mono">10.10.117.15:3000</div>
                  </button>
                </div>
              </div>

              {testStatus && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                  testStatus.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  testStatus.testing ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testStatus.message}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleTestServer()}
                  disabled={testStatus?.testing}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveServer(serverUrlInput)}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#E73229] hover:bg-[#c9241c] text-white transition-colors cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
