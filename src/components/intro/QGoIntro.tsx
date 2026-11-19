import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { computeIntroFrame, type IntroFrame, type IntroVariant } from './introTimeline';
import { resolveIntroVariant, markIntroSeen } from './introState';
import {
  QGoWordmark,
  StorefrontIllustration,
  TicketIllustration,
  ClockIllustration,
} from './IntroIllustrations';
import './qgoIntro.css';

export interface QGoIntroProps {
  ready?: boolean;
  onDone: () => void;
}

/**
 * Calculates responsive stage dimensions matching the CSS clamp rules
 * across Mobile (<600px), Tablet (600-1023px), Desktop (1024-1919px), and 4K (>=1920px).
 */
export function getIntroStageDimensions(vw: number, vh: number): { w: number; h: number } {
  let w = vw < 600
    ? Math.min(Math.max(vw * 0.72, 260), 400)
    : vw < 1024
    ? Math.min(Math.max(vw * 0.46, 360), 500)
    : vw < 1920
    ? Math.min(Math.max(vw * 0.28, 420), 620)
    : Math.min(Math.max(vw * 0.28, 540), 734);

  // Cap to 72vh in landscape mode so it never overflows viewport height
  const maxW = 0.72 * vh * (734 / 278);
  if (w > maxW) {
    w = maxW;
  }
  const h = w * (278 / 734);
  return { w, h };
}

export const QGoIntro: React.FC<QGoIntroProps> = ({ ready, onDone }) => {
  const [frame, setFrame] = useState<IntroFrame>(() => computeIntroFrame(0));
  const [isExiting, setIsExiting] = useState(false);
  const [showHoldText, setShowHoldText] = useState(false);

  const completedRef = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const isHoldingRef = useRef(false);
  const animFrameIdRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);
  const currentThemeColorRef = useRef<string | null>(null);

  // Restore theme color on cleanup
  const metaTheme = typeof document !== 'undefined' ? document.querySelector('meta[name="theme-color"]') : null;
  const initialThemeColorRef = useRef<string | null>(null);

  const finishUp = useCallback((reason: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    console.log(`[QGoIntro] Completed (reason: ${reason})`);

    // Cancel any active RAF
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (typeof document !== 'undefined') {
      document.body.classList.remove('qgo-intro-active');
      if (metaTheme && initialThemeColorRef.current) {
        metaTheme.setAttribute('content', initialThemeColorRef.current);
      }
    }

    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/status-bar')
        .then(({ StatusBar }) => StatusBar.show())
        .catch((error) => console.warn('[QGoIntro] Could not restore status bar:', error));
    }

    markIntroSeen('full');
    onDone();
  }, [metaTheme, onDone]);

  const triggerExit = useCallback((reason: string) => {
    if (completedRef.current) return;
    setIsExiting(true);
    exitTimeoutRef.current = window.setTimeout(() => {
      finishUp(reason);
    }, 400);
  }, [finishUp]);

  // If holding at Scene 5 and ready flips to true, exit immediately
  useEffect(() => {
    if (ready && isHoldingRef.current && !completedRef.current && !isExiting) {
      triggerExit('ready_during_hold');
    }
  }, [ready, isExiting, triggerExit]);

  // Main animation effect: runs on all viewports (Mobile, Tablet, and Desktop/PC)
  useEffect(() => {
    // Only use reduced variant if explicitly requested in URL search (e.g. ?intro=reduced).
    // Do not skip the visual intro merely because a desktop OS setting has reduced-motion active.
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const variant: IntroVariant = resolveIntroVariant({
      search,
      prefersReducedMotion: false,
    });

    if (variant === 'off') {
      finishUp('variant_off');
      return;
    }

    if (typeof document !== 'undefined') {
      document.body.classList.add('qgo-intro-active');
      if (metaTheme) {
        initialThemeColorRef.current = metaTheme.getAttribute('content') || '#1E3A8A';
      }
    }

    // Hide native status bar for Android/iOS full bleed
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/status-bar')
        .then(({ StatusBar }) => StatusBar.hide())
        .catch((error) => console.warn('[QGoIntro] Could not hide status bar:', error));
    }

    // Explicit reduced motion mode (e.g. ?intro=reduced in URL): show static lockup on white for 700ms
    if (variant === 'reduced') {
      const reducedFrame = computeIntroFrame(4000, 'full');
      setFrame(reducedFrame);
      if (metaTheme) {
        metaTheme.setAttribute('content', '#FFFFFF');
      }
      const reducedTimer = window.setTimeout(() => {
        triggerExit('reduced_motion');
      }, 700);

      return () => {
        window.clearTimeout(reducedTimer);
      };
    }

    // Full 60fps/120fps animation loop for both Desktop and Mobile
    const startTime = performance.now();

    const tick = (now: number) => {
      if (completedRef.current) return;

      const elapsed = now - startTime;

      if (elapsed < 4000) {
        // Normal progression: full 4000ms brand sequence always plays even if session loads fast
        const currentFrame = computeIntroFrame(elapsed, 'full');
        setFrame(currentFrame);

        // Sync theme color
        if (metaTheme && currentThemeColorRef.current !== currentFrame.background) {
          currentThemeColorRef.current = currentFrame.background;
          metaTheme.setAttribute('content', currentFrame.background);
        }

        animFrameIdRef.current = requestAnimationFrame(tick);
      } else {
        // S5 Brand Lockup reached (t >= 4000ms)
        if (metaTheme && currentThemeColorRef.current !== '#FFFFFF') {
          currentThemeColorRef.current = '#FFFFFF';
          metaTheme.setAttribute('content', '#FFFFFF');
        }

        // Check if session is ready
        if (readyRef.current !== false) {
          // Ready! Finish sequence smoothly
          const finalFrame = computeIntroFrame(4000, 'full');
          setFrame(finalFrame);
          triggerExit('sequence_complete');
        } else {
          // Session still loading on slow network: hold on Scene 5
          isHoldingRef.current = true;
          const holdTime = elapsed - 4000;

          const holdFrame = computeIntroFrame(4000, 'full');
          // Subtle breathing arrow pulse on G to indicate background activity
          holdFrame.gNudge = 3 * Math.sin(holdTime * 0.006);
          setFrame(holdFrame);

          if (holdTime >= 2500 && !showHoldText) {
            setShowHoldText(true);
          }

          // Hard safety ceiling at 7500ms
          if (elapsed >= 7500) {
            console.warn('[QGoIntro] Safety ceiling (7500ms) reached; exiting unconditionally');
            triggerExit('safety_ceiling');
            return;
          }

          animFrameIdRef.current = requestAnimationFrame(tick);
        }
      }
    };

    animFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
    };
  }, [finishUp, triggerExit, metaTheme, showHoldText]);

  // Viewport dimensions for responsive geometry
  const vw = typeof window !== 'undefined' ? (window.innerWidth || 390) : 390;
  const vh = typeof window !== 'undefined' ? (window.innerHeight || 844) : 844;
  const cx = vw / 2;
  const cy = vh / 2;

  // Explicit, deterministic stage sizing that matches CSS across all screen sizes
  const stageDims = getIntroStageDimensions(vw, vh);
  const stageW = stageDims.w;
  const stageH = stageDims.h;

  const driftPx = frame.drift * vw;
  const stageScale = frame.scale;

  // Pivot coordinates in screen pixels (calculated relative to stage center)
  const gx = cx + driftPx + (440 - 367) * (stageW / 734) * stageScale;
  const gy = cy + (137 - 139) * (stageH / 278) * stageScale;

  const ox = cx + driftPx + (659 - 367) * (stageW / 734) * stageScale;
  const oy = cy + (163 - 139) * (stageH / 278) * stageScale;

  // Maximum corner distances to ensure circular wipe covers 100% of viewport
  const maxDistG = Math.hypot(Math.max(gx, vw - gx), Math.max(gy, vh - gy));
  const maxDistO = Math.hypot(Math.max(ox, vw - ox), Math.max(oy, vh - oy));
  const maxDistC = Math.hypot(Math.max(cx + driftPx, vw - (cx + driftPx)), Math.max(cy, vh - cy));

  const rBlack = frame.blackReveal > 0 ? frame.blackReveal * maxDistG * 1.15 : 0;
  const rRed = frame.redReveal > 0 ? frame.redReveal * maxDistO * 1.15 : 0;
  const rWhite = frame.whiteReveal > 0 ? frame.whiteReveal * maxDistC * 1.15 : 0;

  return (
    <div
      className={`qgo-intro ${isExiting ? 'qgo-intro--exiting' : ''}`}
      role="status"
      aria-label="Loading QGo"
    >
      {/* Zero overlaid buttons: Skip button completely removed for clean cinematic presentation */}

      {/* Layer 0: Scene 0 / Scene 1 (Red Background, Cream Wordmark, Storefront replaces Q) */}
      {frame.blackReveal < 1 && (
        <div className="qgo-intro__layer qgo-intro__layer--red-base">
          <div
            className="qgo-intro-stage"
            style={{
              transform: `translate(${driftPx}px, 0px) scale(${frame.scale})`,
            }}
          >
            <QGoWordmark
              color="#FFE9D6"
              qState={frame.q}
              gState={frame.g}
              oState={frame.o}
            />
            <svg
              viewBox="0 0 734 278"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
              shapeRendering="geometricPrecision"
            >
              <StorefrontIllustration state={frame.store} />
            </svg>
          </div>
        </div>
      )}

      {/* Layer 1: Scene 2 (Black Background, Cream Wordmark, Ticket replaces G) */}
      {frame.blackReveal > 0 && frame.redReveal < 1 && (
        <div
          className="qgo-intro__layer qgo-intro__layer--black"
          style={{
            clipPath: frame.blackReveal >= 1 ? 'none' : `circle(${rBlack.toFixed(1)}px at ${gx.toFixed(1)}px ${gy.toFixed(1)}px)`,
          }}
        >
          <div
            className="qgo-intro-stage"
            style={{
              transform: `translate(${driftPx}px, 0px) scale(${frame.scale})`,
            }}
          >
            <QGoWordmark
              color="#FFE9D6"
              qState={frame.q}
              gState={frame.g}
              oState={frame.o}
            />
            <svg
              viewBox="0 0 734 278"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
              shapeRendering="geometricPrecision"
            >
              <TicketIllustration state={frame.ticket} />
            </svg>
          </div>
        </div>
      )}

      {/* Layer 2: Scene 3 (Red Background, Cream Wordmark, Clock replaces o) */}
      {frame.redReveal > 0 && frame.whiteReveal < 1 && (
        <div
          className="qgo-intro__layer qgo-intro__layer--red-wipe"
          style={{
            clipPath: frame.redReveal >= 1 ? 'none' : `circle(${rRed.toFixed(1)}px at ${ox.toFixed(1)}px ${oy.toFixed(1)}px)`,
          }}
        >
          <div
            className="qgo-intro-stage"
            style={{
              transform: `translate(${driftPx}px, 0px) scale(${frame.scale})`,
            }}
          >
            <QGoWordmark
              color="#FFE9D6"
              qState={frame.q}
              gState={frame.g}
              oState={frame.o}
            />
            <svg
              viewBox="0 0 734 278"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
              shapeRendering="geometricPrecision"
            >
              <ClockIllustration state={frame.clock} />
            </svg>
          </div>
        </div>
      )}

      {/* Layer 3: Scene 4 & 5 (White Background, Black Wordmark, Tagline, Nudges, Ready Hold) */}
      {frame.whiteReveal > 0 && (
        <div
          className="qgo-intro__layer qgo-intro__layer--white"
          style={{
            clipPath: frame.whiteReveal >= 1 ? 'none' : `circle(${rWhite.toFixed(1)}px at ${(cx + driftPx).toFixed(1)}px ${cy.toFixed(1)}px)`,
          }}
        >
          <div
            className="qgo-intro-stage"
            style={{
              transform: `translate(${driftPx}px, 0px) scale(${frame.scale})`,
            }}
          >
            <QGoWordmark
              color="#0B0B0B"
              qState={frame.q}
              gState={frame.g}
              oState={frame.o}
              tailNudge={frame.tailNudge}
              gNudge={frame.gNudge}
            />
            {/* Tagline */}
            <div
              className="qgo-intro-tagline"
              style={{
                opacity: frame.tagOpacity,
                transform: `translateY(${frame.tagY}px)`,
              }}
            >
              Queue less. Go more.
            </div>
            {/* Hold Loading Intimation */}
            {showHoldText && (
              <div className="qgo-intro-hold-text">
                Getting things ready...
              </div>
            )}
          </div>
        </div>
      )}

      <span className="qgo-intro__sr-only">Loading QGo</span>
    </div>
  );
};
