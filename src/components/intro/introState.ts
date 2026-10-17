import type { IntroVariant } from './introTimeline';

export const INTRO_STORAGE_KEY = 'qgo.intro.v1';
export const INTRO_SESSION_KEY = 'qgo.intro.session';
export const INTRO_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type IntroRecord = { lastSeen: string; count: number };

export type IntroStateOptions = {
  search?: string;
  prefersReducedMotion?: boolean;
  now?: Date;
  local?: StorageLike | null;
  session?: StorageLike | null;
};

const getOverride = (search = ''): IntroVariant | null => {
  const value = new URLSearchParams(search).get('intro');
  return value === 'full' || value === 'short' || value === 'reduced' || value === 'off' ? value : null;
};

const readRecord = (storage: StorageLike | null | undefined): IntroRecord | null => {
  try {
    const value = storage?.getItem(INTRO_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<IntroRecord>;
    return typeof parsed.lastSeen === 'string' && Number.isFinite(parsed.count) ? parsed as IntroRecord : null;
  } catch {
    return null;
  }
};

export const resolveIntroVariant = ({
  search,
  prefersReducedMotion = false,
}: IntroStateOptions = {}): IntroVariant => {
  const override = getOverride(search);
  if (override) return override;
  if (prefersReducedMotion) return 'reduced';
  // The intro is the app's loading surface, so every fresh app load and browser
  // refresh receives the complete sequence. Storage is retained only for metrics.
  return 'full';
};

export const markIntroSeen = (variant: IntroVariant, now = new Date(), local?: StorageLike | null, session?: StorageLike | null) => {
  if (variant === 'off') return;

  try {
    const previous = readRecord(local);
    local?.setItem(INTRO_STORAGE_KEY, JSON.stringify({
      lastSeen: now.toISOString(),
      count: (previous?.count || 0) + 1,
    }));
  } catch {
    // The session marker below still prevents a replay in this SPA session where possible.
  }

  try {
    session?.setItem(INTRO_SESSION_KEY, '1');
  } catch {
    // No persistence is required for the splash to safely complete.
  }
};
