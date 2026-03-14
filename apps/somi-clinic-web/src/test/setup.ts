import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Suppress known JSDOM warnings that are not actionable.
//
// 1. "Not implemented: Window's getComputedStyle() method: with pseudo-elements"
//    — JSDOM does not support getComputedStyle with pseudo-element selectors.
//    Ant Design's animation/CSS system triggers this frequently.
//
// 2. "Could not parse CSS stylesheet"
//    — JSDOM's CSS parser doesn't support newer CSS features such as :where(),
//    @layer, etc. used by Ant Design's stylesheets.
//
// Neither of these affect test correctness.
// ---------------------------------------------------------------------------
const _originalConsoleError = console.error;
const _originalConsoleWarn = console.warn;

const SUPPRESSED_PATTERNS = [
  // JSDOM limitations — not fixable in application code
  /Not implemented: Window's getComputedStyle/,
  /Could not parse CSS stylesheet/,
  // Ant Design's ResizableTextArea computes NaN height in JSDOM.
  // React passes format strings: console.error('Warning: `%s` is ...', 'NaN', 'height')
  /invalid value for the .* css style property/,
  // React Router v6 informational warnings about v7 migration flags
  /React Router Future Flag Warning/,
];

function isSuppressed(args: unknown[]): boolean {
  if (args.length === 0) return false;
  // React sometimes passes warnings as format strings: console.error('Warning: %s', msg)
  // so we need to check all arguments, not just the first one.
  const combined = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
  return SUPPRESSED_PATTERNS.some((re) => re.test(combined));
}

console.error = (...args: unknown[]) => {
  if (!isSuppressed(args)) _originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
  if (!isSuppressed(args)) _originalConsoleWarn(...args);
};

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
