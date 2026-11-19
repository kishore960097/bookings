/**
 * src/components/auth/ApiDiagnostics.tsx
 *
 * Debug-only diagnostics bar shown at the bottom of the login screen.
 * Rendered only when import.meta.env.DEV is true (Vite strips it in
 * production builds via dead-code elimination). Never logs tokens or OTPs.
 */
import React, { useEffect, useRef, useState } from 'react';

type HealthStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; latencyMs: number }
  | { state: 'network_unreachable'; error: string }
  | { state: 'cors_blocked'; error: string }
  | { state: 'server_error'; status: number; body: string }
  | { state: 'auth_error'; status: number }
  | { state: 'unknown'; error: string };

function classifyError(err: unknown): HealthStatus {
  const msg = (err as Error)?.message ?? String(err);
  // "Failed to fetch" / "Network request failed" is the browser's opaque error
  // for both network unreachability AND CORS blocks.
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('Network request failed') ||
    msg.includes('NetworkError') ||
    msg.includes('net::ERR')
  ) {
    return {
      state: 'cors_blocked',
      error: `Network unreachable or CORS blocked — ${msg}`,
    };
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('timeout')) {
    return { state: 'network_unreachable', error: msg };
  }
  return { state: 'unknown', error: msg };
}

const STATE_LABEL: Record<HealthStatus['state'], string> = {
  idle:               '—',
  checking:           '⏳ Checking…',
  ok:                 '✅ OK',
  network_unreachable:'❌ Network unreachable',
  cors_blocked:       '🚫 CORS / blocked',
  server_error:       '⚠️ Server error',
  auth_error:         '🔐 Auth error',
  unknown:            '❓ Unknown error',
};

const STATE_COLOR: Record<HealthStatus['state'], string> = {
  idle:               '#888',
  checking:           '#888',
  ok:                 '#22c55e',
  network_unreachable:'#ef4444',
  cors_blocked:       '#f97316',
  server_error:       '#eab308',
  auth_error:         '#8b5cf6',
  unknown:            '#ef4444',
};

export const ApiDiagnostics: React.FC = () => {
  // Shown in local dev or when VITE_QGO_DEBUG=true is baked into debug APK builds.
  // In release builds, both flags are false/undefined so Vite dead-code-eliminates it.
  const isDebug = Boolean(import.meta.env.DEV || import.meta.env.VITE_QGO_DEBUG === 'true');
  if (!isDebug) return null;

  const apiBase: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  const [status, setStatus] = useState<HealthStatus>({ state: 'idle' });
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runCheck = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus({ state: 'checking' });

    const url = apiBase ? `${apiBase}/api/health` : '/api/health';
    const t0 = performance.now();
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const latencyMs = Math.round(performance.now() - t0);
      if (res.ok) {
        setStatus({ state: 'ok', latencyMs });
      } else if (res.status === 401 || res.status === 403) {
        setStatus({ state: 'auth_error', status: res.status });
      } else {
        const rawBody = await res.text().catch(() => '');
        // Redact potential secrets — never log tokens or OTPs
        const safe = rawBody
          .slice(0, 200)
          .replace(/"(token|otp|secret|password)":\s*"[^"]*"/gi, '"$1":"[redacted]"');
        setStatus({ state: 'server_error', status: res.status, body: safe });
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      setStatus(classifyError(err));
    }
  };

  // Auto-run once on mount
  useEffect(() => {
    void runCheck();
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = status;
  const detail =
    s.state === 'ok'
      ? `${s.latencyMs} ms`
      : s.state === 'cors_blocked' || s.state === 'network_unreachable' || s.state === 'unknown'
      ? s.error.slice(0, 120)
      : s.state === 'server_error'
      ? `HTTP ${s.status}${s.body ? ' — ' + s.body.slice(0, 80) : ''}`
      : s.state === 'auth_error'
      ? `HTTP ${s.status}`
      : '';

  return (
    <div
      id="qgo-api-diagnostics"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        fontFamily: 'monospace',
        fontSize: 11,
        background: 'rgba(10,10,10,0.92)',
        color: '#ccc',
        padding: '6px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Compact row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#f59e0b' }}>🔧 DEV</span>
        <span>
          API:{' '}
          <span style={{ color: '#60a5fa' }}>{apiBase || '(same-origin)'}</span>
        </span>
        <span style={{ color: '#444' }}>│</span>
        <span>
          {'Health: '}
          <span style={{ color: STATE_COLOR[s.state] }}>{STATE_LABEL[s.state]}</span>
          {detail ? <span style={{ color: '#aaa' }}> {detail}</span> : null}
        </span>
        <button
          type="button"
          onClick={runCheck}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid #444',
            borderRadius: 4,
            color: '#aaa',
            padding: '1px 6px',
            cursor: 'pointer',
            fontSize: 10,
          }}
        >
          recheck
        </button>
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          style={{
            background: 'none',
            border: '1px solid #444',
            borderRadius: 4,
            color: '#aaa',
            padding: '1px 6px',
            cursor: 'pointer',
            fontSize: 10,
          }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            color: '#888',
            paddingTop: 4,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            lineHeight: 1.6,
          }}
        >
          <div>
            <b>Error classification:</b>
          </div>
          <div>{'  ✅ OK = server reachable & CORS allowed'}</div>
          <div>{'  ❌ Network unreachable = phone can\'t reach PC (check WiFi, firewall)'}</div>
          <div>
            {'  🚫 CORS/blocked = origin not in QGO_ALLOWED_ORIGINS, or backend down'}
          </div>
          <div>{'  ⚠️ Server error = backend threw 5xx/4xx'}</div>
          <div>{'  🔐 Auth error = 401/403 (expected on protected endpoints)'}</div>
          <div style={{ marginTop: 4 }}>
            {'Firewall (run as Admin): '}
            <span style={{ color: '#f59e0b', wordBreak: 'break-all' }}>
              {
                'netsh advfirewall firewall add rule name="QGo Dev Server" dir=in action=allow protocol=TCP localport=3000'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
