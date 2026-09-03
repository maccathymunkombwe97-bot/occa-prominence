import { useEffect, useState } from 'react';

/**
 * Keeps the organic likes/clients engine "always on" — every card, sheet, and profile
 * that shows a simulated count re-renders on a shared tick so numbers stay current the
 * whole time the app is open, instead of freezing until the next unrelated re-render or
 * page reload.
 *
 * All mounted consumers share ONE interval (not one per card) — cheap no matter how many
 * counters are on screen at once. The tick itself changes nothing about *what* grows or
 * *how fast*; that's entirely governed by `organicGrowth.ts`'s time-driven math. This
 * hook just makes sure the UI keeps asking it "what's true right now?" on its own.
 */

const TICK_MS = 8000; // frequent enough to feel live, infrequent enough not to look automated

const listeners = new Set<(now: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureTicking() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    const now = Date.now();
    listeners.forEach((notify) => notify(now));
  }, TICK_MS);
}

function stopIfIdle() {
  if (listeners.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Returns the current time, refreshed on the shared app-wide tick above. */
export function useLiveNow(): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    listeners.add(setNow);
    ensureTicking();
    return () => {
      listeners.delete(setNow);
      stopIfIdle();
    };
  }, []);

  return now;
}
