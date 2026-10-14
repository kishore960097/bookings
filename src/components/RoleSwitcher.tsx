import React, { useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { getNextRole, ROLE_LABELS, UserRole } from '../../packages/shared/src/roles';
import { useAuth } from '../context/AuthContext';

export const RoleSwitcher: React.FC = () => {
  const { user, currentRole, switchRole } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextRole = getNextRole(currentRole, user?.authorizedRoles);
  if (!user || !nextRole) return null;

  const handleSwitch = async () => {
    setIsSwitching(true);
    setError(null);
    try {
      const res = await switchRole(nextRole as UserRole);
      if (!res.success) {
        setError(res.error || 'Could not switch views.');
      }
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSwitch}
        disabled={isSwitching}
        className="h-9 px-2.5 sm:px-3 rounded-lg border border-[rgba(11,11,11,0.12)] bg-[#FFFFFF] text-[rgba(11,11,11,0.70)] hover:bg-[rgba(11,11,11,0.05)] disabled:opacity-60 transition-colors flex items-center gap-1.5 text-[11px] sm:text-xs font-bold"
        title={`Switch to ${ROLE_LABELS[nextRole]} View`}
      >
        {isSwitching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">Switch to {ROLE_LABELS[nextRole]}</span>
        <span className="sm:hidden">{ROLE_LABELS[nextRole]}</span>
      </button>
      {error && (
        <div className="absolute right-0 top-10 w-56 rounded-lg border border-[rgba(11,11,11,0.12)] bg-[#FFFFFF] p-2 text-[11px] font-semibold text-[#B3261E] shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
};
