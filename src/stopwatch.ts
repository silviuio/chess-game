/** A run's stopwatch: idle → running (first move) → stopped (last item). Times are performance.now() ms. */
export class Stopwatch {
  private startedAt: number | null = null;
  private stoppedAt: number | null = null;

  /** Starts the clock; later calls are no-ops, so it can be called on every move. */
  start(now = performance.now()) {
    if (this.startedAt === null) this.startedAt = now;
  }

  stop(now = performance.now()) {
    if (this.startedAt !== null && this.stoppedAt === null) this.stoppedAt = now;
  }

  reset() {
    this.startedAt = null;
    this.stoppedAt = null;
  }

  get state(): 'idle' | 'running' | 'stopped' {
    if (this.startedAt === null) return 'idle';
    return this.stoppedAt === null ? 'running' : 'stopped';
  }

  elapsed(now = performance.now()) {
    if (this.startedAt === null) return 0;
    return (this.stoppedAt ?? now) - this.startedAt;
  }
}

/**
 * `m:ss.t` (tenths) or `m:ss.cc` (hundredths). Truncates rather than rounds, so the
 * HUD's tenths are always a prefix of the result dialog's hundredths.
 */
export function formatTime(ms: number, decimals: 1 | 2 = 1): string {
  const hundredths = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor(hundredths / 100) % 60;
  const fraction = decimals === 2 ? hundredths % 100 : Math.floor((hundredths % 100) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(decimals, '0')}`;
}
