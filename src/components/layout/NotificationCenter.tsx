import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { useAuth } from '../../context/AuthContext';
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
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-[#FFFFFF] text-[#0B0B0B] rounded-xl p-4 shadow-2xl border border-[rgba(11,11,11,0.12)] flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
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
            <h4 className="font-bold text-sm text-[#0B0B0B]">{toastMessage.title}</h4>
            <p className="text-xs text-[#6B665F] mt-0.5 leading-relaxed">{toastMessage.message}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[#6B665F] hover:text-[#0B0B0B] p-1"
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
          <div className="relative w-full max-w-md bg-[#FFFFFF] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-[rgba(11,11,11,0.12)]">
            {/* Header */}
            <div className="p-4 border-b border-[rgba(11,11,11,0.12)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--qp-surface)] text-[#0B0B0B] border border-[rgba(11,11,11,0.12)] shadow-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#0B0B0B]">{t.notifications}</h3>
                  <span className="text-xs text-[#6B665F]">Live queue alerts & updates</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-[#0B0B0B] hover:opacity-80 font-bold uppercase tracking-wider px-2 py-1 rounded hover:bg-[rgba(11,11,11,0.06)]"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#6B665F] hover:text-[#0B0B0B] hover:bg-[rgba(11,11,11,0.05)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-16 text-center text-[#6B665F]">
                  <Bell className="w-10 h-10 mx-auto stroke-1 text-[#6B665F] mb-2" />
                  <p className="text-sm font-bold text-[#6B665F]">No notifications yet</p>
                  <p className="text-xs text-[#6B665F] mt-1">
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
                        ? 'bg-[#FFFFFF] border-[rgba(11,11,11,0.12)] opacity-80'
                        : 'bg-[rgba(232,52,42,0.08)] border-[rgba(232,52,42,0.25)] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-bold ${notif.read ? 'text-[#0B0B0B]' : 'text-[#E8342A]'}`}>{notif.title}</h4>
                      <span className="text-[10px] text-[#6B665F] flex items-center gap-1 shrink-0 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B665F] mt-1 leading-relaxed">{notif.message}</p>
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
