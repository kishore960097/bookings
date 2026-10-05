import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, User as UserIcon, Building2, Users } from 'lucide-react';
import { QGoLogo } from '../landing/QGoLogo';
import { GoogleAuthButton } from './GoogleAuthButton';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, loginWithGoogle, loginAsDemo } = useAuth();
  const [role, setRole] = useState<'consumer' | 'owner'>('consumer');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

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

  const handleSwitchToCustomer = () => {
    setRole('consumer');
    setError(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 backdrop-blur-sm transition-opacity"
          style={{ background: 'rgba(8,12,20,0.8)' }}
          onClick={() => setIsAuthModalOpen(false)}
        />

        <div
          className="relative w-full max-w-md rounded-2xl z-10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ background: 'var(--qp-surface-el)', border: '1px solid var(--qp-border)' }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--qp-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <QGoLogo size="sm" />
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2">
              <h2 className="text-xl font-black tracking-tight text-white">
                Sign in to QGo
              </h2>
              <p className="text-xs mt-1 text-slate-400">
                Select your role before continuing
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <X size={15} className="mt-0.5 shrink-0 text-red-400" />
                  <span className="font-medium">{error.message}</span>
                </div>
                {(error.code === 'OWNER_ACCESS_DENIED' || error.code === 'STAFF_ACCESS_DENIED' || error.message.includes('access')) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-red-500/20">
                    <button
                      onClick={() => setError(null)}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleSwitchToCustomer}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-bold text-white transition-colors flex items-center gap-1"
                    >
                      <UserIcon size={11} />
                      <span>Use Customer Login</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── ROLE SELECTOR (Customer | Owner) ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select your role
                </label>
                <span className="text-[10px] text-slate-500">
                  Determines authorized access
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="User role selection"
                className="p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 grid grid-cols-2 gap-1 shadow-inner"
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
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all duration-150 ${
                        isSelected
                          ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200/50'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                      }`}
                    >
                      <Icon
                        size={14}
                        className={isSelected ? 'text-blue-600' : 'text-slate-400'}
                      />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── GOOGLE AUTH BUTTON ── */}
            <GoogleAuthButton
              role={role}
              loading={googleLoading}
              onSuccess={handleGoogleSuccess}
              onError={(err) => setError({ message: err.message })}
            />


          </div>
        </div>
      </div>
    </>
  );
};
