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
        return <Calendar className="w-5 h-5 text-[#FF9F1C]" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-[#FF9F1C]" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-[#FF9F1C]" />;
      default:
        return <Bell className="w-5 h-5 text-[rgba(23,23,23,0.70)]" />;
    }
  };

  return (
    <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-3 border-b border-[rgba(23,23,23,0.12)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#171717]">Notifications Center</h2>
            <p className="text-xs text-[rgba(23,23,23,0.70)]">Business alerts, new bookings &amp; cancellations</p>
          </div>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={onMarkAllRead}
            className="text-xs font-bold text-[#FF9F1C] hover:text-[#FF9F1C]"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-16 text-center text-[rgba(23,23,23,0.70)] space-y-2">
          <Bell className="w-10 h-10 mx-auto text-[rgba(23,23,23,0.70)] stroke-1" />
          <p className="text-sm font-bold text-[rgba(23,23,23,0.70)]">No notifications yet</p>
          <p className="text-xs text-[rgba(23,23,23,0.70)]">
            You'll receive notifications here for bookings, cancellations, and status updates.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`py-4 flex items-start gap-3.5 transition-colors ${
                !n.read ? 'bg-[rgba(255,159,28,0.15)] -mx-6 px-6 rounded-2xl' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-[#FFFFFF] flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-[#171717]">{n.title}</h3>
                  <span className="text-[11px] font-mono text-[rgba(23,23,23,0.70)]">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-[rgba(23,23,23,0.70)] mt-1 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
