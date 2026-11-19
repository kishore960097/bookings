import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Download, X, ArrowUpCircle, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { CURRENT_APP_VERSION, isNewerVersion } from '../../config/appVersion';
import { haptics } from '../../utils/haptics';

interface AppVersionInfo {
  latestVersion: string;
  minSupportedVersion?: string;
  apkDownloadUrl: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
}

export const AppUpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      const res = await api.getAppVersion();
      if (res && res.success && res.latestVersion && res.apkDownloadUrl) {
        const hasUpdate = isNewerVersion(res.latestVersion, CURRENT_APP_VERSION);
        if (hasUpdate) {
          const dismissedVersion = sessionStorage.getItem('qgo_update_dismissed');
          if (!res.forceUpdate && dismissedVersion === res.latestVersion) {
            return;
          }
          setUpdateInfo(res);
          setIsOpen(true);
        }
      }
    } catch {
      // Offline or network error
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkForUpdates();

    // Check on app resume / foreground return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkForUpdates]);

  if (!isOpen || !updateInfo) return null;

  const handleUpdateNow = () => {
    haptics.success();
    if (updateInfo.apkDownloadUrl) {
      window.open(updateInfo.apkDownloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = () => {
    if (updateInfo.forceUpdate) return;
    haptics.light();
    sessionStorage.setItem('qgo_update_dismissed', updateInfo.latestVersion);
    setIsOpen(false);
  };

  const notesList = updateInfo.releaseNotes
    ? updateInfo.releaseNotes
        .split('\n')
        .map((s) => s.trim().replace(/^[•\-\*]\s*/, ''))
        .filter(Boolean)
    : ['Bug fixes and performance improvements.', 'New smooth animations and responsive controls.'];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={updateInfo.forceUpdate ? undefined : handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-2xl rounded-[32px] p-6 sm:p-7 border border-white/20 dark:border-white/10 shadow-2xl flex flex-col gap-4 text-zinc-900 dark:text-zinc-100"
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E73229] to-[#FF5E55] text-white flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0">
              <ArrowUpCircle size={26} className="animate-bounce" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-[#E73229] dark:text-red-400 text-[10px] font-black uppercase tracking-wider">
                <Sparkles size={11} />
                <span>Update Available</span>
              </div>
              <h3 id="app-update-title" className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
                QGo v{updateInfo.latestVersion}
              </h3>
            </div>
          </div>

          {!updateInfo.forceUpdate && (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
              aria-label="Close update notice"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Description & Version Tag */}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          A newer, faster version of QGo is ready for your device (current:{' '}
          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">v{CURRENT_APP_VERSION}</span>).
        </p>

        {/* Release Notes Card */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800/80 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            What's New in this Build
          </span>
          <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            {notesList.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E73229] mt-1.5 shrink-0" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
          <span>Official signed package • Instant direct download</span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          {!updateInfo.forceUpdate && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto flex-1 py-3 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all cursor-pointer text-center"
            >
              Remind Me Later
            </button>
          )}

          <button
            type="button"
            onClick={handleUpdateNow}
            className="w-full sm:w-auto flex-1 py-3 px-5 rounded-full bg-gradient-to-r from-[#E73229] to-[#FF5E55] hover:opacity-95 text-white text-xs font-black shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Download size={16} />
            <span>Download Update Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
