import React, { useEffect, useRef, useState } from 'react';
import qgoLogoMarkup from '../../assets/brand/qgo-logo.svg?raw';
import { computeIntroFrame, introTimeline, type IntroVariant } from './introTimeline';
import { markIntroSeen, resolveIntroVariant } from './introState';
import './qgoIntro.css';

type QGoIntroProps = {
  ready: boolean;
  onDone: () => void;
};

const extractPath = (id: string) => {
  const match = qgoLogoMarkup.match(new RegExp(`<path\\s+id="${id}"[^>]*\\/>`));
  return (match?.[0] || '').replace(/\sid="[^"]+"/, '');
};

const qPath = extractPath('qgo-q');
const gPath = extractPath('qgo-g');
const oPath = extractPath('qgo-o');

const BrandPaths: React.FC<{ refs?: { q: React.RefObject<SVGGElement | null>; g: React.RefObject<SVGGElement | null>; o: React.RefObject<SVGGElement | null> } }> = ({ refs }) => (
  <>
    <g ref={refs?.q} className="qgo-intro__letter" dangerouslySetInnerHTML={{ __html: qPath }} />
    <g ref={refs?.g} className="qgo-intro__letter" dangerouslySetInnerHTML={{ __html: gPath }} />
    <g ref={refs?.o} className="qgo-intro__letter" dangerouslySetInnerHTML={{ __html: oPath }} />
  </>
);

const setStyle = (element: Element | null, values: Partial<CSSStyleDeclaration>) => {
  if (element) Object.assign((element as HTMLElement).style, values);
};

const clampProgress = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)));

const storefront = (
  <g className="qgo-intro__object" aria-hidden="true">
    <rect x="61" y="72" width="154" height="126" rx="30" fill="#FFF4E8" />
    <rect x="79" y="122" width="49" height="76" rx="14" fill="#A81818" />
    <rect x="142" y="122" width="48" height="47" rx="13" fill="#FFFFFF" opacity=".92" />
    <path d="M55 118h166V91c0-17-14-31-31-31H86c-17 0-31 14-31 31v27Z" fill="#FFFFFF" />
    {[62, 91, 120, 149, 178].map((x, index) => <path key={x} d={`M${x} 63h28v56H${x}z`} fill={index % 2 ? '#FFF4E8' : '#E8342A'} />)}
    <path d="M55 117c0 14 13 23 25 16 11 7 24-2 25-16 11 14 29 8 29 0 0 8 18 14 29 0 1 14 14 23 25 16 12 7 25-2 25-16H55Z" fill="#FFF4E8" />
    <path d="M65 197h145" stroke="#D9B99F" strokeWidth="6" strokeLinecap="round" opacity=".7" />
  </g>
);

const ticket = (
  <g className="qgo-intro__object" aria-hidden="true">
    <path d="M350 76h168v41c-19 0-25 27-5 37 2 1 3 2 5 2v42H350v-42c20-9 14-37-5-37V76Z" fill="#E8342A" />
    <path d="M434 86v101" stroke="#A81818" strokeWidth="4" strokeDasharray="6 8" />
    <text x="375" y="163" fill="#FFF4E8" fontSize="73" fontWeight="800" fontFamily="Inter, sans-serif">01</text>
    <circle cx="476" cy="107" r="7" fill="#FFF4E8" opacity=".8" />
    <circle cx="497" cy="107" r="7" fill="#FFF4E8" opacity=".55" />
  </g>
);

const clock = (
  <g className="qgo-intro__object" aria-hidden="true">
    <circle cx="660" cy="150" r="76" fill="#FFF4E8" />
    <circle cx="660" cy="150" r="60" fill="#FFF9F1" />
    {Array.from({ length: 12 }, (_, index) => {
      const rotation = index * 30;
      return <path key={rotation} d="M660 99v8" transform={`rotate(${rotation} 660 150)`} stroke="#A81818" strokeWidth="4" strokeLinecap="round" />;
    })}
    <g className="qgo-intro__clock-hand qgo-intro__clock-minute"><path d="M660 150v-38" stroke="#0B0B0B" strokeWidth="7" strokeLinecap="round" /></g>
    <g className="qgo-intro__clock-hand qgo-intro__clock-hour"><path d="M660 150l25 20" stroke="#0B0B0B" strokeWidth="8" strokeLinecap="round" /></g>
    <circle cx="660" cy="150" r="8" fill="#E8342A" />
  </g>
);

export const QGoIntro: React.FC<QGoIntroProps> = ({ ready, onDone }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const blackRevealRef = useRef<HTMLDivElement>(null);
  const redRevealRef = useRef<HTMLDivElement>(null);
  const whiteRevealRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const creamMarkRef = useRef<SVGSVGElement>(null);
  const finalMarkRef = useRef<SVGSVGElement>(null);
  const storefrontRef = useRef<SVGGElement>(null);
  const ticketRef = useRef<SVGGElement>(null);
  const clockRef = useRef<SVGGElement>(null);
  const qRef = useRef<SVGGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const oRef = useRef<SVGGElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const readyRef = useRef(ready);
  const doneRef = useRef(false);
  const recordedRef = useRef(false);
  const elapsedRef = useRef(0);
  const [variant] = useState<IntroVariant>(() => resolveIntroVariant({
    search: window.location.search,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    local: window.localStorage,
    session: window.sessionStorage,
  }));

  readyRef.current = ready;

  useEffect(() => {
    if (variant === 'off') {
      const finish = window.setTimeout(onDone, 0);
      return () => window.clearTimeout(finish);
    }

    if (!recordedRef.current) {
      markIntroSeen(variant, new Date(), window.localStorage, window.sessionStorage);
      recordedRef.current = true;
    }

    const previousThemeColor = document.documentElement.dataset.qgoIntroThemeRestore || document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    document.body.classList.add('qgo-intro-active');

    let animationFrame = 0;
    let exitTimer = 0;
    let startedAt = performance.now();
    let exiting = false;
    let forceFinal = false;
    const frozen = new URLSearchParams(window.location.search).get('t');
    const frozenTime = frozen && Number.isFinite(Number(frozen)) ? Math.max(0, Number(frozen)) : null;
    const minimum = variant === 'full' ? introTimeline.duration.full : variant === 'short' ? introTimeline.duration.short : introTimeline.duration.reduced;
    const exitDuration = variant === 'full' ? introTimeline.duration.exit : 300;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };

    const beginExit = () => {
      if (exiting) return;
      exiting = true;
      rootRef.current?.classList.add('qgo-intro--exiting');
      exitTimer = window.setTimeout(finish, exitDuration);
    };

    const skip = () => {
      if (elapsedRef.current < 800 || exiting) return;
      forceFinal = true;
      if (readyRef.current) beginExit();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.preventDefault();
        skip();
      }
    };

    const paint = (time: number) => {
      const displayedTime = forceFinal ? introTimeline.duration.full : time;
      const frame = computeIntroFrame(displayedTime, variant === 'off' ? 'reduced' : variant);
      const full = variant === 'full';
      const qHidden = full ? clampProgress(displayedTime, 620, 920) * (1 - clampProgress(displayedTime, 1180, 1440)) : 0;
      const gHidden = full ? clampProgress(displayedTime, 1210, 1510) * (1 - clampProgress(displayedTime, 1880, 2140)) : 0;
      const oHidden = full ? clampProgress(displayedTime, 1910, 2210) * (1 - clampProgress(displayedTime, 2560, 2880)) : 0;
      const revealRadius = (value: number) => `circle(${Math.max(0, value * 160)}% at 50% 50%)`;
      const artWidth = artRef.current?.clientWidth || 1;
      const artHeight = artRef.current?.clientHeight || 1;
      const fittedScale = Math.min(
        frame.logoScale,
        (window.innerWidth * 0.92) / artWidth,
        (window.innerHeight * 0.68) / artHeight,
      );

      setStyle(blackRevealRef.current, { clipPath: full ? `circle(${frame.blackReveal * 160}% at 60% 52%)` : 'none', opacity: full ? '1' : '0' });
      setStyle(redRevealRef.current, { clipPath: full ? `circle(${frame.redReveal * 160}% at 89% 53%)` : 'none', opacity: full ? '1' : '0' });
      setStyle(whiteRevealRef.current, { clipPath: full ? revealRadius(frame.whiteReveal) : 'none', opacity: full ? '1' : '1' });
      setStyle(creamMarkRef.current, {
        transform: `translate3d(${frame.logoX}px, 0, 0) scale(${fittedScale})`,
        opacity: full ? `${1 - frame.whiteReveal}` : '0',
      });
      setStyle(finalMarkRef.current, {
        opacity: full ? `${frame.whiteReveal}` : `${frame.logoOpacity}`,
        transform: `translate3d(0, 0, 0) scale(${fittedScale})`,
      });
      setStyle(qRef.current, { opacity: `${1 - qHidden}`, transform: `translate3d(${frame.nudge}px, 0, 0)` });
      setStyle(gRef.current, { opacity: `${1 - gHidden}`, transform: `translate3d(${frame.nudge * 0.6}px, 0, 0)` });
      setStyle(oRef.current, { opacity: `${1 - oHidden}`, transform: 'translate3d(0, 0, 0)' });
      setStyle(storefrontRef.current, { opacity: `${frame.storefront.opacity}`, transform: `translate3d(${frame.storefront.x}px, ${frame.storefront.y}px, 0) rotate(${frame.storefront.rotation}deg) scale(${frame.storefront.scale})` });
      setStyle(ticketRef.current, { opacity: `${frame.ticket.opacity}`, transform: `translate3d(${frame.ticket.x}px, ${frame.ticket.y}px, 0) rotate(${frame.ticket.rotation}deg)` });
      setStyle(clockRef.current, { opacity: `${frame.clock.opacity}`, transform: `translate3d(${frame.clock.x}px, 0, 0) rotate(${frame.clock.rotation}deg)` });
      const minute = rootRef.current?.querySelector<SVGGElement>('.qgo-intro__clock-minute');
      const hour = rootRef.current?.querySelector<SVGGElement>('.qgo-intro__clock-hour');
      setStyle(minute, { transform: `rotate(${frame.clock.minute}deg)` });
      setStyle(hour, { transform: `rotate(${frame.clock.hour}deg)` });
      setStyle(taglineRef.current, { opacity: `${frame.tagline.opacity}`, transform: `translate3d(0, ${frame.tagline.y}px, 0)` });
      if (themeMeta) themeMeta.content = full ? frame.background : introTimeline.palette.white;
    };

    const tick = (now: number) => {
      const elapsed = frozenTime ?? now - startedAt;
      elapsedRef.current = elapsed;
      const displayedTime = forceFinal ? introTimeline.duration.full : Math.min(elapsed, introTimeline.duration.full);
      paint(displayedTime);

      if (frozenTime === null) {
        if (elapsed >= introTimeline.duration.timeout || (readyRef.current && (elapsed >= minimum || forceFinal))) beginExit();
        if (!exiting) animationFrame = window.requestAnimationFrame(tick);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    rootRef.current?.addEventListener('pointerup', skip);
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(exitTimer);
      window.removeEventListener('keydown', onKeyDown);
      rootRef.current?.removeEventListener('pointerup', skip);
      document.body.classList.remove('qgo-intro-active');
      delete document.documentElement.dataset.qgoIntroBackground;
      delete document.documentElement.dataset.qgoIntroThemeRestore;
      if (themeMeta && previousThemeColor) themeMeta.content = previousThemeColor;
    };
  }, [onDone, variant]);

  if (variant === 'off') return null;

  return (
    <div ref={rootRef} className="qgo-intro" role="status" aria-label="Loading QGo. Press Enter, Space, or Escape to skip after a moment.">
      <div className="qgo-intro__scene qgo-intro__scene--red" />
      <div ref={blackRevealRef} className="qgo-intro__scene qgo-intro__scene--black" />
      <div ref={redRevealRef} className="qgo-intro__scene qgo-intro__scene--red" />
      <div ref={whiteRevealRef} className="qgo-intro__scene qgo-intro__scene--white" />
      <div ref={artRef} className="qgo-intro__art" aria-hidden="true">
        <svg ref={creamMarkRef} className="qgo-intro__wordmark qgo-intro__wordmark--cream" viewBox="0 0 734 278">
          <BrandPaths refs={{ q: qRef, g: gRef, o: oRef }} />
          <g ref={storefrontRef}>{storefront}</g>
          <g ref={ticketRef}>{ticket}</g>
          <g ref={clockRef}>{clock}</g>
        </svg>
        <svg ref={finalMarkRef} className="qgo-intro__wordmark qgo-intro__wordmark--final" viewBox="0 0 734 278">
          <BrandPaths />
        </svg>
      </div>
      <p ref={taglineRef} className="qgo-intro__tagline">{introTimeline.taglines[0]}</p>
      <span className="qgo-intro__sr-only">Loading QGo</span>
    </div>
  );
};
