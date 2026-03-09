import { useState, useEffect } from 'react';

/** Breakpoint (px) below which the layout switches to mobile mode. */
const MOBILE_BREAKPOINT = 768;

/**
 * Returns `true` when the viewport width is below the mobile breakpoint.
 * Uses `matchMedia` for efficient, event-driven detection — no polling.
 */
export default function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
