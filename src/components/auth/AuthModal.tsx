import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, User as UserIcon, Building2, Users } from 'lucide-react';
import { QGoLogo } from '../landing/QGoLogo';
import { GoogleAuthButton } from './GoogleAuthButton';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, loginWithGoogle } = useAuth();
  const [role, setRole] = useState<'consumer' | 'owner'>('consumer');
  const [googleLoading, setGoogleLoading] = useState(false);
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
          className="fixed inset-0 transition-opacity bg-[var(--q-scrim-bg)] backdrop-blur-[8px]"
          onClick={() => setIsAuthModalOpen(false)}
        />

        <div
          className="relative w-full max-w-md rounded-[20px] z-10 shadow-[0_1px_2px_rgba(23,23,23,0.06),0_8px_24px_rgba(23,23,23,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[var(--q-hairline)] bg-[var(--q-canvas)]"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-[var(--q-hairline)]">
            <div className="flex items-center justify-between mb-3">
              <QGoLogo size="sm" />
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="p-2 rounded-lg text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2">
              <h2 className="text-xl font-black tracking-tight text-[var(--q-ink)]">
                Sign in to QGo
              </h2>
              <p className="text-xs mt-1 text-[var(--q-muted)]">
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
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--q-hairline)]">
                    <button
                      onClick={() => setError(null)}
                      className="px-2.5 py-1 rounded bg-[var(--q-canvas-soft)] hover:bg-[rgba(23,23,23,0.08)] text-[11px] font-bold text-[var(--q-ink)] transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleSwitchToCustomer}
                      className="px-2.5 py-1 rounded bg-[var(--q-ink)] hover:opacity-90 text-[11px] font-bold text-white transition-colors flex items-center gap-1"
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
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--q-muted)]">
                  Select your role
                </label>
                <span className="text-[11px] text-[var(--q-muted)]">
                  Determines authorized access
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="User role selection"
                className="p-1 rounded-xl bg-[var(--q-canvas-soft)] border border-[var(--q-hairline)] grid grid-cols-2 gap-1 shadow-inner"
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
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors duration-150 ${
                        isSelected
                          ? 'bg-[var(--q-ink)] text-white shadow-xs'
                          : 'text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[rgba(23,23,23,0.04)]'
                      }`}
                    >
                      <Icon
                        size={14}
                        className={isSelected ? 'text-white' : 'text-[var(--q-muted)]'}
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
