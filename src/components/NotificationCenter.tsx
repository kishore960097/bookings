import React from 'react';
import { useQueue } from '../context/QueueContext';
import { useAuth } from '../context/AuthContext';
import { Bell, X, CheckCheck, Clock, AlertCircle } from 'lucide-react';

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
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-[var(--q-canvas)] text-[var(--q-ink)] rounded-[14px] p-4 shadow-[0_8px_24px_rgba(23,23,23,0.12)] border border-[var(--q-hairline)] flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              toastMessage.type === 'alert'
                ? 'bg-[rgba(179,38,30,0.12)] text-[var(--q-error)]'
                : toastMessage.type === 'success'
                ? 'bg-[rgba(22,132,91,0.12)] text-[var(--q-success)]'
                : 'bg-[var(--q-red-wash)] text-[var(--q-red)]'
            }`}
          >
            {toastMessage.type === 'alert' ? (
              <AlertCircle className="w-5 h-5" />
            ) : toastMessage.type === 'success' ? (
              <CheckCheck className="w-5 h-5" />
            ) : null}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-[var(--q-ink)]">{toastMessage.title}</h4>
            <p className="text-xs text-[var(--q-body)] mt-0.5 leading-relaxed">{toastMessage.message}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[var(--q-muted)] hover:text-[var(--q-ink)] p-1"
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
            className="fixed inset-0 bg-[var(--q-scrim-bg)] backdrop-blur-[8px] transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-md bg-[var(--q-canvas)] h-full shadow-[0_8px_24px_rgba(23,23,23,0.12)] flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-[var(--q-hairline)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--q-hairline)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--q-canvas-soft)] text-[var(--q-ink)] border border-[var(--q-hairline)] shadow-xs">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--q-ink)]">{t.notifications}</h3>
                  <span className="text-xs text-[var(--q-muted)]">Live queue alerts & updates</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-[var(--q-ink)] hover:opacity-80 font-bold uppercase tracking-wider px-2 py-1 rounded hover:bg-[var(--q-canvas-soft)]"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--q-muted)] hover:text-[var(--q-ink)] hover:bg-[var(--q-canvas-soft)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-16 text-center text-[var(--q-muted)]">
                  <Bell className="w-10 h-10 mx-auto stroke-1 text-[var(--q-muted)] mb-2" />
                  <p className="text-sm font-bold text-[var(--q-muted)]">No notifications yet</p>
                  <p className="text-xs text-[var(--q-muted)] mt-1">
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
                    className={`p-3.5 rounded-xl border transition-colors duration-150 cursor-pointer ${
                      notif.read
                        ? 'bg-[var(--q-canvas)] border-[var(--q-hairline)] opacity-80'
                        : 'bg-[var(--q-red-wash)] border-[rgba(232,52,42,0.20)] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-bold ${notif.read ? 'text-[var(--q-ink)]' : 'text-[var(--q-red-pressed)]'}`}>{notif.title}</h4>
                      <span className="text-[11px] text-[var(--q-muted)] flex items-center gap-1 shrink-0 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--q-body)] mt-1 leading-relaxed">{notif.message}</p>
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
