import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Booking, NotificationItem } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface QueueContextType {
  activeBooking: Booking | null;
  notifications: NotificationItem[];
  unreadCount: number;
  refreshActiveBooking: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  cancelCurrentBooking: (reason?: string) => Promise<boolean>;
  notifyArriving: () => Promise<boolean>;
  setActiveBooking: (booking: Booking | null) => void;
  toastMessage: { title: string; message: string; type?: 'info' | 'success' | 'alert' } | null;
  setToastMessage: (msg: { title: string; message: string; type?: 'info' | 'success' | 'alert' } | null) => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    message: string;
    type?: 'info' | 'success' | 'alert';
  } | null>(null);

  const prevPositionRef = useRef<number | null>(null);

  // Play subtle web audio chime on notifications
  const playAlertChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio might be blocked by browser policy until interaction
    }
  }, []);

  const refreshActiveBooking = useCallback(async () => {
    if (!user) {
      setActiveBooking(null);
      return;
    }

    try {
      const res = await api.getBookings();
      if (res && res.bookings) {
        // Find most recent active booking / token
        const active = res.bookings.find(
          (b) => b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'in_progress'
        );

        if (active) {
          // If queue position changed, trigger toast
          if (
            prevPositionRef.current !== null &&
            active.queuePosition !== undefined &&
            active.queuePosition !== prevPositionRef.current
          ) {
            if (active.queuePosition === 1) {
              setToastMessage({
                title: "You're Next! 🎉",
                message: `Your turn is up at ${active.salonName}. Head towards the chair!`,
                type: 'alert',
              });
              playAlertChime();
            } else if (active.queuePosition < prevPositionRef.current) {
              setToastMessage({
                title: 'Queue Moved Up!',
                message: `You are now #${active.queuePosition} in line. Est. wait: ~${active.estimatedWaitMinutes || 10}m.`,
                type: 'info',
              });
            }
          }

          prevPositionRef.current = active.queuePosition ?? null;
          setActiveBooking(active);
        } else {
          setActiveBooking(null);
          prevPositionRef.current = null;
        }
      }
    } catch (e) {
      console.error('Error refreshing active booking:', e);
    }
  }, [user, playAlertChime]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const res = await api.getNotifications();
      if (res && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  }, [user]);

  // Live polling every 5 seconds for real-time queue synchronization
  useEffect(() => {
    refreshActiveBooking();
    refreshNotifications();

    const interval = setInterval(() => {
      refreshActiveBooking();
      refreshNotifications();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshActiveBooking, refreshNotifications]);

  const markAllNotificationsRead = async () => {
    if (!user) return;
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error('Error marking notifications read:', e);
    }
  };

  const cancelCurrentBooking = async (reason?: string) => {
    if (!activeBooking) return false;
    try {
      const res = await api.cancelBooking(activeBooking.id, reason);
      if (res.success) {
        setActiveBooking(null);
        setToastMessage({
          title: 'Booking Cancelled',
          message: (res as any).refund?.refundAmount
            ? `Booking cancelled. Refund of ₹${(res as any).refund.refundAmount} initiated (${(res as any).refund.refundPercentage}%).`
            : 'Your booking was cancelled.',
          type: 'info',
        });
        refreshActiveBooking();
        return true;
      }
      if ((res as any).error) {
        return { error: (res as any).error };
      }
      return false;
    } catch (e: any) {
      console.error('Error cancelling booking:', e);
      return { error: e?.message || 'Error cancelling booking' };
    }
  };

  const notifyArriving = async () => {
    if (!activeBooking) return false;
    try {
      const res = await api.markArriving(activeBooking.id);
      if (res.success) {
        setActiveBooking(res.booking);
        setToastMessage({
          title: 'Shop Notified!',
          message: `${activeBooking.salonName} knows you are on your way.`,
          type: 'success',
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error sending arrival alert:', e);
      return false;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <QueueContext.Provider
      value={{
        activeBooking,
        notifications,
        unreadCount,
        refreshActiveBooking,
        refreshNotifications,
        markAllNotificationsRead,
        cancelCurrentBooking,
        notifyArriving,
        setActiveBooking,
        toastMessage,
        setToastMessage,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};
