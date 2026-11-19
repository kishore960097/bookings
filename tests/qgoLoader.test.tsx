import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QGoLoader } from '../src/components/common/QGoLoader';

describe('QGoLoader branded vector component', () => {
  it('renders lossless SVG vector markup without any video elements or .mp4 files', () => {
    const html = renderToStaticMarkup(
      <QGoLoader variant="fullscreen" debounceMs={0} />
    );

    // Must never ship or render video elements or mp4 references
    expect(html).not.toContain('<video');
    expect(html).not.toContain('.mp4');

    // Lossless vector SVG configuration
    expect(html).toContain('viewBox="-16 -10 772 450"');
    expect(html).toContain('shape-rendering="geometricPrecision"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('renders fullscreen variant with 100dvh overlay and safe-area insets', () => {
    const html = renderToStaticMarkup(
      <QGoLoader variant="fullscreen" debounceMs={0} text="Opening QGo…" />
    );

    expect(html).toContain('fixed inset-0');
    expect(html).toContain('h-[100dvh]');
    expect(html).toContain('env(safe-area-inset-top');
    expect(html).toContain('env(safe-area-inset-bottom');
    expect(html).toContain('Opening QGo…');
  });

  it('renders container / inline variant with customizable min-height', () => {
    const html = renderToStaticMarkup(
      <QGoLoader
        variant="container"
        debounceMs={0}
        minHeight="320px"
        text="Locating sports turfs near you…"
      />
    );

    expect(html).not.toContain('fixed inset-0');
    expect(html).toContain('min-height:320px');
    expect(html).toContain('Locating sports turfs near you…');
  });

  it('renders custom text or defaults to brand status cycling label', () => {
    const customHtml = renderToStaticMarkup(
      <QGoLoader debounceMs={0} text="Syncing Super Admin Command Center…" />
    );
    expect(customHtml).toContain('Syncing Super Admin Command Center…');

    const defaultHtml = renderToStaticMarkup(<QGoLoader debounceMs={0} />);
    expect(defaultHtml).toContain('Loading QGo...');
  });

  it('does not immediately render if debounceMs > 0 on static render', () => {
    // When rendered statically with positive debounce, it waits before mounting
    const html = renderToStaticMarkup(
      <QGoLoader variant="fullscreen" debounceMs={120} />
    );
    expect(html).toBe('');
  });
});
