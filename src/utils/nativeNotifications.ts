import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Schedule a native Android lock-screen alarm notification using Capacitor LocalNotifications.
 * When the app runs on Android, this will ring and vibrate even when minimized or device is locked.
 */
export async function scheduleNativeAlarmNotification(reminder: {
  id: string;
  title: string;
  note?: string;
  targetDate: Date;
}): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;

    // Check permissions
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') {
        return false;
      }
    }

    // Generate a positive 32-bit integer for notification ID
    let hash = 0;
    for (let i = 0; i < reminder.id.length; i++) {
      hash = (hash << 5) - hash + reminder.id.charCodeAt(i);
      hash |= 0;
    }
    const notificationId = Math.abs(hash) % 2147483647;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: 'Qbe — Incoming Executive Call',
          body: `${reminder.title}${reminder.note ? ` • ${reminder.note}` : ''}`,
          schedule: { at: reminder.targetDate, allowWhileIdle: true },
          sound: 'default',
          ongoing: false,
          autoCancel: true,
          actionTypeId: 'OPEN_QBE_CALL',
          extra: { reminderId: reminder.id },
        },
      ],
    });

    console.log(`[Qbe LocalNotifications] Scheduled alarm for ${reminder.targetDate.toISOString()}`);
    return true;
  } catch (err) {
    console.debug('[Qbe LocalNotifications] Scheduling skipped or not supported:', err);
    return false;
  }
}

/**
 * Dispatches an instant 1-second test alarm notification on native devices
 */
export async function triggerImmediateAlarmNotification(title: string, message: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000) + 1,
          title: 'Qbe — Incoming Executive Call (Test)',
          body: `${title} • ${message}`,
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          actionTypeId: 'OPEN_QBE_CALL',
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
