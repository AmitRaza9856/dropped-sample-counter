/**
 * Create a dropped-sample counter.
 *
 * Why a `clock` function instead of calling Date.now() internally: tests must be
 * deterministic. If we read the wall clock directly, a test on a fast machine and a
 * slow machine would produce different timestamps, breaking equality assertions.
 * The caller owns time so tests can own it too.
 *
 * `flushIntervalMs` is the interval the caller wants between automatic flushes
 * (if they wire up `shouldFlush`). We do not start a timer ourselves because a
 * hidden setInterval would make tests non-deterministic and would leak across
 * test cases. The caller decides when to ask "is it time?".
 *
 * @param {{ clock?: () => number, flushIntervalMs?: number }} [opts]
 * @returns {import('./types.js').DroppedSampleCounter}
 */
export function createDroppedSampleCounter(opts = {}) {
  const clock = opts.clock ?? (() => Date.now());
  const flushIntervalMs = opts.flushIntervalMs ?? 60_000;

  const counts = new Map();
  let lastFlushTime = clock();

  function record(reason) {
    if (typeof reason !== "string" || reason.length === 0) {
      throw new TypeError("reason must be a non-empty string");
    }
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  function flush() {
    const reasons = [];
    for (const [reason, count] of counts) {
      // Copy the count so the returned snapshot is unaffected by subsequent
      // mutation of the live counter.
      reasons.push({ reason, count });
    }
    counts.clear();
    lastFlushTime = clock();
    return { timestamp: lastFlushTime, reasons };
  }

  function shouldFlush(now) {
    return now - lastFlushTime >= flushIntervalMs;
  }

  function snapshot() {
    const reasons = [];
    for (const [reason, count] of counts) {
      reasons.push({ reason, count });
    }
    return { timestamp: lastFlushTime, reasons };
  }

  return { record, flush, shouldFlush, snapshot };
}
