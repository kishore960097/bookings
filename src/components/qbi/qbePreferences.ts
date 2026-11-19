import { useState, useEffect, useCallback } from 'react';

export interface QbePreferences {
  onboarded: boolean;
  enabled: boolean;
  platformEnabled: boolean;
  customerEnabled: boolean;
  ownerEnabled: boolean;
  adminEnabled: boolean;
  autopilotWatchdog: boolean;
  voiceOutputEnabled: boolean;
  speechRate: number;
  ringtoneEnabled: boolean;
  vibrationEnabled: boolean;
  adminPhone: string;
  dailyBriefingSchedule: boolean;
  weeklyPayoutSchedule: boolean;
  monthlyPayoutSchedule: boolean;
  autoApproveVenues: boolean;
  autoReplyReviews: boolean;
}

const STORAGE_KEYS = {
  onboarded: 'qgo.qbe.onboarded',
  enabled: 'qgo.qbe.enabled',
  platformEnabled: 'qgo.qbe.platformEnabled',
  customerEnabled: 'qgo.qbe.customerEnabled',
  ownerEnabled: 'qgo.qbe.ownerEnabled',
  adminEnabled: 'qgo.qbe.adminEnabled',
  customName: 'qgo.qbe.customName',
  autopilotWatchdog: 'qgo.qbe.autopilotWatchdog',
  voiceOutputEnabled: 'qgo.qbe.voiceOutputEnabled',
  speechRate: 'qgo.qbe.speechRate',
  ringtoneEnabled: 'qgo.qbe.ringtoneEnabled',
  vibrationEnabled: 'qgo.qbe.vibrationEnabled',
  adminPhone: 'qgo.qbe.adminPhone',
  dailyBriefingSchedule: 'qgo.qbe.dailyBriefingSchedule',
  weeklyPayoutSchedule: 'qgo.qbe.weeklyPayoutSchedule',
  monthlyPayoutSchedule: 'qgo.qbe.monthlyPayoutSchedule',
  autoApproveVenues: 'qgo.qbe.autoApproveVenues',
  autoReplyReviews: 'qgo.qbe.autoReplyReviews',
} as const;

export function getCustomQbeName(): string {
  if (typeof window === 'undefined') return 'Qbe';
  return localStorage.getItem(STORAGE_KEYS.customName) || 'Qbe';
}

export function setCustomQbeName(name: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = name.trim() || 'Qbe';
  localStorage.setItem(STORAGE_KEYS.customName, cleaned);
  window.dispatchEvent(new CustomEvent('qgo-qbe-pref-changed', { detail: { customName: cleaned } }));
}

export function getQbePreferences(): QbePreferences {
  if (typeof window === 'undefined') {
    return {
      onboarded: true,
      enabled: true,
      platformEnabled: true,
      customerEnabled: true,
      ownerEnabled: true,
      adminEnabled: true,
      autopilotWatchdog: true,
      voiceOutputEnabled: true,
      speechRate: 1.0,
      ringtoneEnabled: true,
      vibrationEnabled: true,
      adminPhone: '9600971886',
      dailyBriefingSchedule: true,
      weeklyPayoutSchedule: true,
      monthlyPayoutSchedule: true,
      autoApproveVenues: false,
      autoReplyReviews: false,
    };
  }

  const storedRate = parseFloat(localStorage.getItem(STORAGE_KEYS.speechRate) || '1.0');
  const speechRate = Number.isNaN(storedRate) ? 1.0 : Math.min(Math.max(storedRate, 0.7), 1.5);

  return {
    onboarded: localStorage.getItem(STORAGE_KEYS.onboarded) === 'true',
    enabled: localStorage.getItem(STORAGE_KEYS.enabled) !== 'false', // default true
    platformEnabled: localStorage.getItem(STORAGE_KEYS.platformEnabled) !== 'false', // default true
    customerEnabled: localStorage.getItem(STORAGE_KEYS.customerEnabled) !== 'false', // default true
    ownerEnabled: localStorage.getItem(STORAGE_KEYS.ownerEnabled) !== 'false', // default true
    adminEnabled: localStorage.getItem(STORAGE_KEYS.adminEnabled) !== 'false', // default true
    autopilotWatchdog: localStorage.getItem(STORAGE_KEYS.autopilotWatchdog) !== 'false', // default true
    voiceOutputEnabled: localStorage.getItem(STORAGE_KEYS.voiceOutputEnabled) !== 'false', // default true
    speechRate,
    ringtoneEnabled: localStorage.getItem(STORAGE_KEYS.ringtoneEnabled) !== 'false', // default true
    vibrationEnabled: localStorage.getItem(STORAGE_KEYS.vibrationEnabled) !== 'false', // default true
    adminPhone: localStorage.getItem(STORAGE_KEYS.adminPhone) || '9600971886',
    dailyBriefingSchedule: localStorage.getItem(STORAGE_KEYS.dailyBriefingSchedule) !== 'false', // default true
    weeklyPayoutSchedule: localStorage.getItem(STORAGE_KEYS.weeklyPayoutSchedule) !== 'false', // default true
    monthlyPayoutSchedule: localStorage.getItem(STORAGE_KEYS.monthlyPayoutSchedule) !== 'false', // default true
    autoApproveVenues: localStorage.getItem(STORAGE_KEYS.autoApproveVenues) === 'true', // default false
    autoReplyReviews: localStorage.getItem(STORAGE_KEYS.autoReplyReviews) === 'true', // default false
  };
}

export function setQbePreference<K extends keyof QbePreferences>(key: K, value: QbePreferences[K]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS[key], String(value));
    window.dispatchEvent(new CustomEvent('qgo-qbe-pref-changed', { detail: { key, value } }));
  } catch (e) {
    console.error('[Qbe] Failed to save preference:', e);
  }
}

export function isQbeActiveForRole(role: 'customer' | 'owner' | 'admin' | string): boolean {
  const prefs = getQbePreferences();
  if (!prefs.platformEnabled || !prefs.enabled) return false;

  const normalized = (role || '').toLowerCase();
  if (normalized === 'admin') return prefs.adminEnabled;
  if (normalized === 'owner') return prefs.ownerEnabled;
  return prefs.customerEnabled;
}

export function useQbePreferences() {
  const [prefs, setPrefs] = useState<QbePreferences>(getQbePreferences);
  const [customName, setCustomNameState] = useState<string>(getCustomQbeName);

  useEffect(() => {
    const handlePrefChange = () => {
      setPrefs(getQbePreferences());
      setCustomNameState(getCustomQbeName());
    };

    window.addEventListener('qgo-qbe-pref-changed', handlePrefChange);
    window.addEventListener('storage', handlePrefChange);

    return () => {
      window.removeEventListener('qgo-qbe-pref-changed', handlePrefChange);
      window.removeEventListener('storage', handlePrefChange);
    };
  }, []);

  const updatePref = useCallback(<K extends keyof QbePreferences>(key: K, value: QbePreferences[K]) => {
    setQbePreference(key, value);
    setPrefs(getQbePreferences());
  }, []);

  const setCustomName = useCallback((name: string) => {
    setCustomQbeName(name);
    setCustomNameState(name.trim() || 'Qbe');
  }, []);

  return {
    prefs,
    updatePref,
    customName,
    setCustomName,
    isRoleActive: (role: string) => isQbeActiveForRole(role),
  };
}
