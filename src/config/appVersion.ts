export const CURRENT_APP_VERSION = '1.0.0';

/**
 * Compare two semver-like version strings (e.g. '1.0.1' vs '1.0.0' or 'v1.1.0' vs '1.0.0').
 * Returns true if latest is strictly newer than current.
 */
export function isNewerVersion(latest?: string | null, current: string = CURRENT_APP_VERSION): boolean {
  if (!latest || !current) return false;
  const cleanL = latest.trim().replace(/^v/i, '');
  const cleanC = current.trim().replace(/^v/i, '');
  if (cleanL === cleanC) return false;

  const lParts = cleanL.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanC.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(lParts.length, cParts.length);

  for (let i = 0; i < maxLen; i++) {
    const l = lParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}
