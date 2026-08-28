import React from 'react';
import { useQueue } from '../context/QueueContext';
import { useAuth } from '../context/AuthContext';
import { Bell, X, CheckCheck, Clock, Sparkles, AlertCircle } from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBooking?: (bookingId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onSelectBooking,
}) => {
  const { notifications, markAllNotificationsRead, toastMessage, setToastMessage } = useQueue();
  const { t } = useAuth();

  return (
    <>
      {/* Real-time Toast Banner (Floating Pop) */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-xl p-4 shadow-2xl border border-slate-800 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              toastMessage.type === 'alert'
                ? 'bg-red-500/20 text-red-400'
                : toastMessage.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {toastMessage.type === 'alert' ? (
              <AlertCircle className="w-5 h-5" />
            ) : toastMessage.type === 'success' ? (
              <CheckCheck className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-white">{toastMessage.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toastMessage.message}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-500 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notifications Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">{t.notifications}</h3>
                  <span className="text-xs text-slate-500">Live queue alerts & updates</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-wider px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Bell className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No notifications yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    You will receive live token updates and turn alerts here.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (notif.bookingId && onSelectBooking) {
                        onSelectBooking(notif.bookingId);
                        onClose();
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      notif.read
                        ? 'bg-slate-50 border-slate-200 opacity-80'
                        : 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{notif.title}</h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
