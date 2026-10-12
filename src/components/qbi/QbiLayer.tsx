import React, { Component, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QbiContext } from './QbiProvider';
import { Qbi } from './Qbi';
import { t, getTips } from './qbiCopy';
import { useAuth } from '../../context/AuthContext';

// Self-contained Error Boundary so a render error in Qbi never white-screens the app
export class QbiBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  props: { children: React.ReactNode };
  state: { hasError: boolean } = { hasError: false };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error('[Qbi] UI render error caught by boundary:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export const QbiLayerContent: React.FC = () => {
  const ctx = useContext(QbiContext);
  let authUser: any = null;
  let authRole: string = 'consumer';

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    if (auth) {
      authUser = auth.user;
      authRole = auth.currentRole || auth.role || 'consumer';
    }
  } catch {
    // ignore
  }

  if (!ctx) return null;

  const {
    popup,
    dismissPopup,
    bannerState,
    currentScreenId,
    helperOpen,
    setHelperOpen,
    helperStep,
    setHelperStep,
    hasSeenHelper,
    markHelperSeen,
    language,
  } = ctx;

  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const helperBubbleRef = useRef<HTMLDivElement | null>(null);

  // Draggable Qbi helper button state
  const [btnPos, setBtnPos] = React.useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    dragRef.current = {
      startX: rect.left,
      startY: rect.top,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      hasMoved: false,
    };
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const deltaX = e.clientX - dragRef.current.pointerStartX;
    const deltaY = e.clientY - dragRef.current.pointerStartY;
    if (Math.hypot(deltaX, deltaY) > 5) {
      dragRef.current.hasMoved = true;
    }
    if (dragRef.current.hasMoved) {
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;
      const nextX = Math.max(12, Math.min(maxX, dragRef.current.startX + deltaX));
      const nextY = Math.max(12, Math.min(maxY, dragRef.current.startY + deltaY));
      setBtnPos({ x: nextX, y: nextY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const wasDragging = dragRef.current.hasMoved;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (wasDragging) {
      return;
    }
    if (!hasSeenHelper) markHelperSeen();
    setHelperOpen(!helperOpen);
  };

  // Focus management for alertdialog
  useEffect(() => {
    if (popup && popup.type === 'notBooked') {
      const timer = setTimeout(() => {
        primaryBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [popup]);

  // Escape key closes popup or helper
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popup) {
          dismissPopup();
        } else if (helperOpen) {
          setHelperOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popup, helperOpen, dismissPopup, setHelperOpen]);

  // Outside click closes helper bubble
  useEffect(() => {
    if (!helperOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (helperBubbleRef.current && !helperBubbleRef.current.contains(e.target as Node)) {
        setHelperOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [helperOpen, setHelperOpen]);

  // Screen tips calculation
  const tips = getTips(language, currentScreenId);
  const isConsumer = !!authUser && authRole === 'consumer';
  const isHelperVisible =
    isConsumer &&
    currentScreenId !== null &&
    currentScreenId !== 'paid' &&
    tips.length > 0 &&
    !popup;

  return (
    <>
      {/* ================= 1. Offline Banner (z-index 130) ================= */}
      {bannerState !== 'hidden' && (
        <aside
          role="status"
          aria-live="polite"
          className={`qbi-offline-banner ${
            bannerState === 'back-online' ? 'qbi-offline-banner--online' : ''
          }`}
        >
          <Qbi mood={bannerState === 'back-online' ? 'hello' : 'oops'} size={22} animate={false} />
          <span>
            {bannerState === 'back-online'
              ? t(language, 'backOnline')
              : t(language, 'offlineBanner')}
          </span>
        </aside>
      )}

      {/* ================= 2. Welcome Card / Bubble (z-index 135) ================= */}
      {popup?.type === 'welcome' && (
        <>
          {popup.variant === 'full' ? (
            <div
              className="qbi-welcome-scrim"
              onClick={dismissPopup}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="qbi-welcome-card"
                onClick={(e) => e.stopPropagation()}
              >
                <Qbi mood="hello" size={140} animate={true} />
                <h2 className="qbi-popup-title">{t(language, 'welcomeTitle')}</h2>
                <p className="qbi-popup-sub">{t(language, 'welcomeSub')}</p>
                <button
                  type="button"
                  className="qbi-btn qbi-btn--primary"
                  onClick={dismissPopup}
                >
                  {t(language, 'gotIt')}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="qbi-welcome-bubble-wrap"
              onClick={dismissPopup}
              role="status"
              aria-live="polite"
            >
              <Qbi mood="hello" size={54} animate={true} />
              <div className="qbi-welcome-bubble">
                {t(language, 'welcomeBack')}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= 3. Popups: Booked & NotBooked (z-index 140) ================= */}
      {popup && popup.type !== 'welcome' && (
        <div
          className="qbi-scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissPopup();
          }}
          role="alertdialog"
          aria-modal="true"
        >
          <div
            className="qbi-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            {popup.type === 'booked' && (
              <>
                <Qbi mood="booked" size={110} animate={true} />
                <h2 className="qbi-popup-title">
                  {popup.title || t(language, 'bookedTitle')}
                </h2>
                <p className="qbi-popup-sub">
                  {popup.sub || t(language, 'bookedSub')}
                </p>
              </>
            )}

            {popup.type === 'notBooked' && (
              <>
                <Qbi mood="oops" size={110} animate={true} />
                <h2 className="qbi-popup-title">
                  {popup.title ||
                    (popup.kind === 'offline'
                      ? t(language, 'offlineTitle')
                      : popup.kind === 'slot_full'
                      ? t(language, 'slotFullTitle')
                      : t(language, 'notBookedTitle'))}
                </h2>
                <p className="qbi-popup-sub">
                  {popup.sub ||
                    (popup.kind === 'offline'
                      ? t(language, 'offlineSub')
                      : popup.kind === 'slot_full'
                      ? t(language, 'slotFullSub')
                      : t(language, 'notBookedGeneric'))}
                </p>
                <div className="qbi-btn-group">
                  {popup.onRetry && popup.kind !== 'slot_full' && (
                    <button
                      ref={primaryBtnRef}
                      type="button"
                      className="qbi-btn qbi-btn--primary"
                      onClick={() => {
                        const retryFn = popup.onRetry;
                        dismissPopup();
                        retryFn?.();
                      }}
                    >
                      {t(language, 'retry')}
                    </button>
                  )}
                  <button
                    ref={popup.onRetry && popup.kind !== 'slot_full' ? undefined : primaryBtnRef}
                    type="button"
                    className={`qbi-btn ${
                      popup.onRetry && popup.kind !== 'slot_full'
                        ? 'qbi-btn--secondary'
                        : 'qbi-btn--primary'
                    }`}
                    onClick={dismissPopup}
                  >
                    {t(language, 'close')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= 4. Helper Bot Button & Speech Bubble (z-index 55) ================= */}
      {isHelperVisible && (
        <>
          <button
            type="button"
            className={`qbi-helper-btn ${
              !hasSeenHelper ? 'qbi-helper-btn--pulse' : ''
            }`}
            style={
              btnPos
                ? {
                    left: `${btnPos.x}px`,
                    top: `${btnPos.y}px`,
                    right: 'auto',
                    bottom: 'auto',
                    touchAction: 'none',
                  }
                : { touchAction: 'none' }
            }
            aria-label="Qbi help"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={(e) => e.stopPropagation()}
          >
            <Qbi mood="hello" size={40} animate={false} />
          </button>

          {helperOpen && (
            <div
              ref={helperBubbleRef}
              className="qbi-helper-bubble"
              style={
                btnPos
                  ? {
                      left: `${Math.max(12, Math.min(window.innerWidth - 276, btnPos.x > 260 ? btnPos.x - 240 : btnPos.x))}px`,
                      top: btnPos.y > 180 ? `${btnPos.y - 130}px` : `${btnPos.y + 60}px`,
                      right: 'auto',
                      bottom: 'auto',
                    }
                  : undefined
              }
              role="region"
              aria-label="Qbi tips"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="qbi-helper-step-indicator">
                Tip {helperStep + 1} of {tips.length}
              </div>
              <p className="qbi-helper-text" aria-live="polite">
                {tips[helperStep] || ''}
              </p>
              <div className="qbi-helper-footer">
                {helperStep < tips.length - 1 ? (
                  <button
                    type="button"
                    className="qbi-helper-action"
                    onClick={() => setHelperStep((s) => s + 1)}
                  >
                    {t(language, 'nextTip')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="qbi-helper-action"
                    onClick={() => setHelperOpen(false)}
                  >
                    {t(language, 'gotIt')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export const QbiLayer: React.FC = () => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <QbiBoundary>
      <QbiLayerContent />
    </QbiBoundary>,
    document.body
  );
};
