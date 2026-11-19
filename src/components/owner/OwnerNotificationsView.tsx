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
        return <CheckCircle2 className="w-5 h-5 text-[#C9281F]" />;
      case 'new_booking':
      case 'booking_confirmed':
        return <Calendar className="w-5 h-5 text-[#C9281F]" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-[#C9281F]" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-[#C9281F]" />;
      default:
        return <Bell className="w-5 h-5 text-[rgba(10,10,10,0.70)]" />;
    }
  };

  return (
    <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-3 sm:p-4 shadow-xs space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(10,10,10,0.12)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-[#0A0A0A] truncate">Notifications Center</h2>
            <p className="text-[11px] text-[rgba(10,10,10,0.70)] truncate">Business alerts, new bookings &amp; cancellations</p>
          </div>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="text-[11px] font-semibold text-[#C9281F] hover:text-[#C9281F] shrink-0"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-12 text-center text-[rgba(10,10,10,0.70)] space-y-2">
          <Bell className="w-8 h-8 mx-auto text-[rgba(10,10,10,0.70)] stroke-1" />
          <p className="text-sm font-bold text-[rgba(10,10,10,0.70)]">No notifications yet</p>
          <p className="text-xs text-[rgba(10,10,10,0.70)]">
            You'll receive notifications here for bookings, cancellations, and status updates.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`py-3 flex items-start gap-3 transition-colors ${
                !n.read ? 'bg-[rgba(231,50,41,0.08)] -mx-3 sm:-mx-4 px-3 sm:px-4 rounded-xl' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-[#FFFFFF] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-bold text-[#0A0A0A] truncate">{n.title}</h3>
                  <span className="text-[10px] font-mono text-[rgba(10,10,10,0.70)] shrink-0">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5 leading-relaxed break-words">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
