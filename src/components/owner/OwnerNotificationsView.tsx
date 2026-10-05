import React from 'react';
import { NotificationItem } from '../../types';
import {
  Bell,
  CheckCircle2,
  Calendar,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle} from 'lucide-react';

interface OwnerNotificationsViewProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export const OwnerNotificationsView: React.FC<OwnerNotificationsViewProps> = ({
  notifications,
  onMarkAllRead,
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'business_approved':
        return ;
      case 'new_booking':
      case 'booking_confirmed':
        return <Calendar className="w-5 h-5 text-indigo-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-amber-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Notifications Center</h2>
            <p className="text-xs text-slate-500">Business alerts, new bookings &amp; cancellations</p>
          </div>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <Bell className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
          <p className="text-sm font-bold text-slate-700">No notifications yet</p>
          <p className="text-xs text-slate-400">
            You'll receive notifications here for bookings, cancellations, and status updates.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`py-4 flex items-start gap-3.5 transition-colors ${
                !n.read ? 'bg-indigo-50/40 -mx-6 px-6 rounded-2xl' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-slate-900">{n.title}</h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
