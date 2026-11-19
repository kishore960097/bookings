import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const triggerHaptic = {
  light: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  },
  medium: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  },
  selection: async () => {
    try {
      await Haptics.selectionChanged();
    } catch {}
  },
  success: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  },
  warning: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {}
  },
};

export const haptics = triggerHaptic;
export default triggerHaptic;
