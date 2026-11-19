import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QGoIntro, getIntroStageDimensions } from './QGoIntro';
import {
  QGoWordmark,
  StorefrontIllustration,
  TicketIllustration,
  ClockIllustration,
} from './IntroIllustrations';
import { computeIntroFrame, introTimeline } from './introTimeline';

describe('QGoIntro component & illustrations', () => {
  it('renders vector SVG elements without any video, mp4, or visible skip button', () => {
    const onDone = vi.fn();
    const html = renderToStaticMarkup(<QGoIntro ready={true} onDone={onDone} />);

    // Must NOT contain any video elements or .mp4 sources
    expect(html).not.toContain('<video');
    expect(html).not.toContain('.mp4');

    // Skip button must be completely removed (zero visual clutter)
    expect(html).not.toContain('qgo-intro__skip');
    expect(html).not.toContain('>Skip<');

    // Must contain SVG brand wordmark with exact viewBox 0 0 734 278
    expect(html).toContain('viewBox="0 0 734 278"');
    expect(html).toContain('qgo-intro');
    expect(html).toContain('Loading QGo');
  });

  it('calculates explicit, non-zero responsive dimensions across Mobile, Desktop, and 4K viewports', () => {
    // Mobile iPhone (390 x 844)
    const mobile = getIntroStageDimensions(390, 844);
    expect(mobile.w).toBeGreaterThanOrEqual(260);
    expect(mobile.w).toBeLessThanOrEqual(400);
    expect(mobile.h).toBeGreaterThan(90);

    // Tablet iPad (768 x 1024)
    const tablet = getIntroStageDimensions(768, 1024);
    expect(tablet.w).toBeGreaterThanOrEqual(350);
    expect(tablet.w).toBeLessThanOrEqual(500);

    // Desktop Laptop (1280 x 800)
    const desktopSmall = getIntroStageDimensions(1280, 800);
    expect(desktopSmall.w).toBeGreaterThanOrEqual(420);
    expect(desktopSmall.h).toBeGreaterThan(150);

    // Desktop FHD (1920 x 1080)
    const desktopFhd = getIntroStageDimensions(1920, 1080);
    expect(desktopFhd.w).toBeGreaterThan(500);
    expect(desktopFhd.h).toBeGreaterThan(180);

    // Desktop 4K (3840 x 2160)
    const desktop4k = getIntroStageDimensions(3840, 2160);
    expect(desktop4k.w).toBeGreaterThanOrEqual(600);
    expect(desktop4k.h).toBeGreaterThan(200);

    // Never collapses to 0 height
    [mobile, tablet, desktopSmall, desktopFhd, desktop4k].forEach((dims) => {
      expect(Number.isFinite(dims.w)).toBe(true);
      expect(Number.isFinite(dims.h)).toBe(true);
      expect(dims.w).toBeGreaterThan(0);
      expect(dims.h).toBeGreaterThan(0);
    });
  });

  it('renders QGoWordmark with independent letter IDs and paths', () => {
    const html = renderToStaticMarkup(
      <QGoWordmark
        color="#FFE9D6"
        qState={{ vis: 1, sc: 1, rot: 0 }}
        gState={{ vis: 1, sc: 1, rot: 0 }}
        oState={{ vis: 1, sc: 1, rot: 0 }}
        tailNudge={8}
        gNudge={6}
      />,
    );

    expect(html).toContain('id="qgo-q"');
    expect(html).toContain('id="qgo-q-tail"');
    expect(html).toContain('id="qgo-g"');
    expect(html).toContain('id="qgo-o"');
    expect(html).toContain('translate(8px, 0px)');
    expect(html).toContain('translate(6px, 0px)');
  });

  it('renders Scene 1 StorefrontIllustration when state is visible', () => {
    const frameAt900 = computeIntroFrame(900);
    expect(frameAt900.store.vis).toBe(true);

    const html = renderToStaticMarkup(
      <svg viewBox="0 0 734 278">
        <StorefrontIllustration state={frameAt900.store} />
      </svg>,
    );
    expect(html).toContain('id="intro-storefront"');
    expect(html).toContain('id="awning-stripes"');
    expect(html).toContain('id="storeBodyGrad"');
  });

  it('renders Scene 2 TicketIllustration when state is visible', () => {
    const frameAt1600 = computeIntroFrame(1600);
    expect(frameAt1600.ticket.vis).toBe(true);

    const html = renderToStaticMarkup(
      <svg viewBox="0 0 734 278">
        <TicketIllustration state={frameAt1600.ticket} />
      </svg>,
    );
    expect(html).toContain('id="intro-ticket"');
    expect(html).toContain('QGO • PASS');
    expect(html).toContain('NOW SERVING');
    expect(html).toContain('01');
  });

  it('renders Scene 3 ClockIllustration with minute and hour hands when state is visible', () => {
    const frameAt2300 = computeIntroFrame(2300);
    expect(frameAt2300.clock.vis).toBe(true);

    const html = renderToStaticMarkup(
      <svg viewBox="0 0 734 278">
        <ClockIllustration state={frameAt2300.clock} />
      </svg>,
    );
    expect(html).toContain('id="intro-clock"');
    expect(html).toContain('id="clockBezelGrad"');
    expect(html).toContain('stroke="#E8342A"'); // Sweeping red minute hand
    expect(html).toContain('stroke="#0B0B0B"'); // Settled black hour hand
  });

  it('produces tagline at Scene 5 with exact copy: "Queue less. Go more."', () => {
    const frameAt3800 = computeIntroFrame(3800);
    expect(frameAt3800.tagOpacity).toBeGreaterThan(0.99);
    expect(introTimeline.taglines).toContain('Queue less. Go more.');
  });
});
