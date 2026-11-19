import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  cancelCurrentBooking: (reason?: string) => Promise<boolean | { error: string }>;
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
      osc.onended = () => {
        void ctx.close().catch(() => {});
      };
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
        const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        // Find most recent active booking / token
        const active = res.bookings.find(
          (b) =>
            (!b.scheduledDate || b.scheduledDate >= todayLocal) &&
            (b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'in_progress')
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

  // Live polling every 15 seconds for real-time queue synchronization (avoids 429)
  useEffect(() => {
    if (!user) return;
    refreshActiveBooking();
    refreshNotifications();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshActiveBooking();
      refreshNotifications();
    }, 15000);

    return () => clearInterval(interval);
  }, [user, refreshActiveBooking, refreshNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    const prevNotifications = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch (e) {
      console.error('Error marking notifications read:', e);
      setNotifications(prevNotifications);
    }
  }, [user, notifications]);

  const cancelCurrentBooking = useCallback(async (reason?: string) => {
    if (!activeBooking) return false;
    const bookingToCancel = activeBooking;
    // Optimistic cancellation
    setActiveBooking(null);
    try {
      const res = await api.cancelBooking(bookingToCancel.id, reason);
      if (res.success) {
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
      // Rollback on failure
      setActiveBooking(bookingToCancel);
      if ((res as any).error) return { error: (res as any).error };
      return false;
    } catch (e: any) {
      // Rollback on error
      setActiveBooking(bookingToCancel);
      console.error('Error cancelling booking:', e);
      return { error: e?.message || 'Error cancelling booking' };
    }
  }, [activeBooking, refreshActiveBooking]);

  const notifyArriving = useCallback(async () => {
    if (!activeBooking) return false;
    try {
      const res = await api.markArriving(activeBooking.id);
      if (res.success) {
        if (res.booking) setActiveBooking(res.booking);
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
  }, [activeBooking]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const contextValue = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <QueueContext.Provider value={contextValue}>
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
