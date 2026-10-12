# dropped-sample-counter

Counts filtered-out events by reason code and periodically emits aggregate drop metrics.

## Usage

```js
import { createDroppedSampleCounter } from "dropped-sample-counter";

const counter = createDroppedSampleCounter({
  clock: () => 0, // milliseconds; pass Date.now in production
  flushIntervalMs: 10_000,
});

counter.record("invalid_header");
counter.record("invalid_header");
counter.record("rate_limited");

const report = counter.flush();
// report => { timestamp: 0, reasons: [{ reason: "invalid_header", count: 2 },
//                                    { reason: "rate_limited",   count: 1 }] }
```

## Why

When a pipeline filters out samples (bad headers, rate limits, malformed payloads), the only signal operators usually get is a drop in throughput. This library keeps a running tally keyed by reason code and flushes a snapshot on demand or on an interval so dashboards can attribute loss to a cause.

The core trade-off: everything lives in memory. If the process crashes between flushes, those counts are lost. That is acceptable for observability telemetry — which is best-effort by nature — but means this is not a durable audit log.

## Edge case

`flush()` resets all reason counters to zero. This is deliberate so each report represents drops since the previous flush. If you need cumulative totals, keep your own running sum of the emitted reports.

An empty counter (no records recorded, or all flushed) flushes to `{ timestamp, reasons: [] }` — not `null` — so downstream consumers never need a null check.
