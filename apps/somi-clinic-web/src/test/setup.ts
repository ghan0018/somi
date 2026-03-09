import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Configurable viewport width for responsive testing.
//
// Set the VIEWPORT_WIDTH env var to run the entire test suite at a different
// simulated screen width.  The npm scripts `test:desktop` and `test:mobile`
// use this so every functional test is exercised at both widths.
// ---------------------------------------------------------------------------
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH) || 1280;

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: VIEWPORT_WIDTH,
});

// ---------------------------------------------------------------------------
// matchMedia stub that actually evaluates (max-width) and (min-width) queries
// against the configured viewport width. This makes Ant Design responsive
// columns, our useIsMobile hook, and CSS-media-like JS checks work correctly
// in tests.
// ---------------------------------------------------------------------------

/** Ant Design breakpoints used by the `responsive` column prop. */
const ANT_BREAKPOINTS: Record<string, number> = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
};

function evalMediaQuery(query: string): boolean {
  // Handle "(max-width: 767px)" style queries
  const maxMatch = query.match(/\(max-width:\s*(\d+)px\)/);
  if (maxMatch) {
    return VIEWPORT_WIDTH <= Number(maxMatch[1]);
  }

  // Handle "(min-width: 768px)" style queries
  const minMatch = query.match(/\(min-width:\s*(\d+)px\)/);
  if (minMatch) {
    return VIEWPORT_WIDTH >= Number(minMatch[1]);
  }

  // Handle Ant Design's screen breakpoint queries like "screen and (min-width: …)"
  const screenMinMatch = query.match(/screen\s+and\s+\(min-width:\s*(\d+)px\)/);
  if (screenMinMatch) {
    return VIEWPORT_WIDTH >= Number(screenMinMatch[1]);
  }

  // Handle bare breakpoint names that Ant Design sometimes passes (e.g. "md")
  if (ANT_BREAKPOINTS[query]) {
    return VIEWPORT_WIDTH >= ANT_BREAKPOINTS[query];
  }

  return false;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    const matches = evalMediaQuery(query);
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  },
});

// ---------------------------------------------------------------------------
// Ant Design's Input.TextArea uses @rc-component/resize-observer which
// requires window.ResizeObserver. jsdom does not implement it, so we provide
// a minimal no-op stub here.
// ---------------------------------------------------------------------------
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
