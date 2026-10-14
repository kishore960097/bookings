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
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full ap-glass-panel p-4 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              toastMessage.type === 'alert'
                ? 'bg-[rgba(179,38,30,0.12)] text-[#B3261E]'
                : toastMessage.type === 'success'
                ? 'bg-[rgba(22,132,91,0.14)] text-[#16845B]'
                : 'bg-[rgba(232,52,42,0.10)] text-[#E8342A]'
            }`}
          >
            {toastMessage.type === 'alert' ? (
              <AlertCircle className="w-5 h-5" />
            ) : toastMessage.type === 'success' ? (
              <CheckCheck className="w-5 h-5" />
            ) : null}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-[var(--qp-text)] tracking-tight">{toastMessage.title}</h4>
            <p className="text-xs text-[var(--qp-text-sec)] mt-0.5 leading-relaxed">{toastMessage.message}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[var(--qp-text-sec)] hover:text-[var(--qp-text)] p-1 transition-colors"
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
            className="fixed inset-0 bg-[#0B0B0B]/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-md ap-glass-panel rounded-l-[24px] rounded-r-none h-full flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[var(--qp-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[var(--qp-surface)] border border-[var(--qp-border)] text-[#0B0B0B] shadow-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold tracking-tight text-lg text-[var(--qp-text)]">{t.notifications}</h3>
                  <span className="text-xs text-[var(--qp-text-sec)]">Live queue alerts & updates</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-[#0B0B0B] hover:opacity-80 font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-[var(--qp-surface)] border border-[var(--qp-border)] shadow-sm transition-all"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full text-[var(--qp-text-sec)] hover:text-[var(--qp-text)] hover:bg-[var(--qp-surface)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-16 text-center text-[var(--qp-text-sec)]">
                  <Bell className="w-12 h-12 mx-auto stroke-1 opacity-50 mb-3" />
                  <p className="text-sm font-semibold tracking-tight text-[var(--qp-text)]">No notifications yet</p>
                  <p className="text-xs mt-1">
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
                    className={`p-4 rounded-[20px] transition-all cursor-pointer ${
                      notif.read
                        ? 'bg-[var(--qp-surface)] border border-[var(--qp-border)] opacity-80'
                        : 'ap-glass-card border border-[rgba(232,52,42,0.25)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className={`text-sm font-semibold tracking-tight ${notif.read ? 'text-[var(--qp-text)]' : 'text-[#E8342A]'}`}>{notif.title}</h4>
                      <span className="text-[10px] text-[var(--qp-text-sec)] flex items-center gap-1 shrink-0 font-medium">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--qp-text-sec)] mt-1.5 leading-relaxed">{notif.message}</p>
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
