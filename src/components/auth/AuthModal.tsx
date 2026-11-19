import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, User as UserIcon, Building2, Smartphone, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { QGoLogo } from '../landing/QGoLogo';
import { GoogleAuthButton } from './GoogleAuthButton';
import { ApiDiagnostics } from './ApiDiagnostics';


export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, loginWithGoogle, loginWithOtp, requestOtp } = useAuth();
  const [role, setRole] = useState<'consumer' | 'owner'>('consumer');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const [otpPhone, setOtpPhone] = useState('');
  const [otpName, setOtpName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const token = tokenResponse.access_token || tokenResponse.credential;
      if (!token) {
        setError({ message: 'Google did not return a verifiable credential. Please try again.' });
        return;
      }
      const res = await loginWithGoogle(token, role, tokenResponse.access_token);
      if (res.success) {
        setIsAuthModalOpen(false);
      } else {
        setError({
          message: res.error || 'Authentication failed. Please try again.',
          code: res.code,
        });
      }
    } catch (e: any) {
      setError({
        message: e?.message || 'Network error. Check your connection and try again.',
      });
    } finally {
      setGoogleLoading(false);
    }
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
      const res = await loginWithOtp(otpPhone.trim(), codeToUse, otpName.trim() || undefined, role);
      if (res.success) {
        setIsAuthModalOpen(false);
      } else {
        setError({ message: res.error || 'Verification failed. Please check the code and try again.' });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSwitchToCustomer = () => {
    setRole('consumer');
    setError(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 transition-opacity bg-[var(--q-scrim-bg)] backdrop-blur-[8px]"
          onClick={() => setIsAuthModalOpen(false)}
        />

        <div
          className="relative w-full max-w-md rounded-[28px] z-10 shadow-[0_8px_32px_rgba(10,10,10,0.08)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[rgba(10,10,10,0.08)] bg-[#FFFFFF]"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-[rgba(10,10,10,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <QGoLogo size="sm" />
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="p-2 rounded-lg text-[#5C5C5C] hover:text-[#0A0A0A] hover:bg-black/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2">
              <h2 className="text-xl font-black tracking-tight text-[#0A0A0A]">
                Sign in to QGo
              </h2>
              <p className="text-xs mt-1 text-[#5C5C5C]">
                Select your role before continuing
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-[rgba(179,38,30,0.12)] border border-[rgba(179,38,30,0.20)] text-[var(--q-error)] text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <X size={15} className="mt-0.5 shrink-0 text-[var(--q-error)]" />
                  <span className="font-medium">{error.message}</span>
                </div>
                {(error.code === 'OWNER_ACCESS_DENIED' || error.code === 'STAFF_ACCESS_DENIED' || error.message.includes('access')) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[rgba(10,10,10,0.06)]">
                    <button
                      onClick={() => setError(null)}
                      className="px-2.5 py-1 rounded-lg bg-[#ECECEF] hover:bg-[#E2E2E6] text-[11px] font-bold text-[#0A0A0A] transition-colors cursor-pointer"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleSwitchToCustomer}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer bg-[var(--q-grad-cta)] text-white hover:opacity-90"
                    >
                      <UserIcon size={11} className="text-white" />
                      <span>Use Customer Login</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── ROLE SELECTOR (Customer | Owner) ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#5C5C5C]">
                  Select your role
                </label>
                <span className="text-[11px] text-[#5C5C5C]">
                  Determines authorized access
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="User role selection"
                className="p-1 rounded-xl bg-[#ECECEF] border border-[rgba(10,10,10,0.06)] grid grid-cols-2 gap-1 shadow-inner"
              >
                {([
                  { id: 'consumer', label: 'Customer', icon: UserIcon },
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
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'shadow-xs bg-white text-[#0A0A0A]'
                          : 'text-[#5C5C5C] hover:text-[#0A0A0A] hover:bg-black/5'
                      }`}
                    >
                      <Icon
                        size={14}
                        className={isSelected ? 'text-[#0A0A0A]' : 'text-[#5C5C5C]'}
                      />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!otpSent ? (
              <>
                {/* ── GOOGLE AUTH BUTTON ── */}
                <GoogleAuthButton
                  role={role}
                  loading={googleLoading}
                  onSuccess={handleGoogleSuccess}
                  onError={(err) => setError({ message: err.message })}
                />

                {/* ── DIVIDER ── */}
                <div className="relative my-5 text-center">
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
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-[rgba(10,10,10,0.10)] bg-[#F3F3F5] text-[#0A0A0A] placeholder:text-[#767676] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />

                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="min-w-0 flex-1 px-3.5 py-2.5 rounded-[12px] border border-[rgba(10,10,10,0.10)] bg-[#F3F3F5] text-[#0A0A0A] placeholder:text-[#767676] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                    />
                    <button
                      type="button"
                      id="modal-request-otp-btn"
                      onClick={handleRequestOtp}
                      disabled={otpLoading}
                      className="px-4 py-2.5 rounded-[12px] bg-[#0A0A0A] hover:bg-[#222222] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-sm"
                    >
                      {otpLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Smartphone size={15} />
                          <span>Send Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── OTP VERIFICATION VIEW ── */
              <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(10,10,10,0.08)]">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#5C5C5C] hover:text-[#0A0A0A] transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={15} />
                    <span>Change Number</span>
                  </button>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[#ECECEF] text-[#0A0A0A]">
                    {role === 'owner' ? 'Owner' : 'Customer'}
                  </span>
                </div>

                <div className="text-left space-y-1">
                  <h3 className="text-sm font-bold text-[#0A0A0A]">Enter Verification Code</h3>
                  <p className="text-xs text-[#5C5C5C]">
                    Sent to <strong className="text-[#0A0A0A] font-semibold">{otpPhone}</strong>
                  </p>
                </div>

                <form onSubmit={handleOtpLogin} className="space-y-3">
                  {devOtpCode && (
                    <div className="p-2.5 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl flex items-center justify-between text-xs text-[#92400E]">
                      <div>
                        <span className="font-semibold text-[#78350F]">Code: </span>
                        <span className="font-mono font-black text-xs tracking-widest text-[#92400E] ml-1">{devOtpCode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOtpCode(devOtpCode)}
                        className="px-2 py-0.5 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-md font-bold text-[11px] transition-colors cursor-pointer"
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
                      className="w-full py-3 px-3 rounded-xl border-2 border-[rgba(10,10,10,0.14)] bg-[#F8F8FA] text-[#0A0A0A] placeholder:text-[#AAAAAA] text-xl font-bold tracking-[0.4em] text-center focus:outline-none focus:border-[#E73229] focus:ring-2 focus:ring-[#E73229]/20 transition-all shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    id="modal-otp-login-go-btn"
                    disabled={otpLoading || otpCode.trim().length < 6}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all duration-150 bg-[#E73229] hover:bg-[#D42B23] text-white active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {otpLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Verify &amp; Sign In</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs text-[#5C5C5C] pt-1">
                    <span>Didn't receive code?</span>
                    {countdown > 0 ? (
                      <span className="font-semibold text-[#0A0A0A]">{countdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpLoading}
                        className="font-bold text-[#E73229] hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            <div id="qgo-phone-recaptcha" />
          </div>
        </div>
      </div>
      {/* Debug-only diagnostics bar — stripped by Vite in production */}
      <ApiDiagnostics />
    </>
  );
};
