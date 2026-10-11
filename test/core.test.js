import { test } from "node:test";
import assert from "node:assert/strict";
import { createDroppedSampleCounter } from "../src/core.js";

test("flush returns a report with counts grouped by reason", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t, flushIntervalMs: 100 });

  counter.record("bad_header");
  counter.record("bad_header");
  counter.record("rate_limited");

  const report = counter.flush();

  assert.equal(report.timestamp, 0);
  assert.equal(report.reasons.length, 2);

  const byReason = new Map(report.reasons.map((r) => [r.reason, r.count]));
  assert.equal(byReason.get("bad_header"), 2);
  assert.equal(byReason.get("rate_limited"), 1);
});

test("flush resets counters to zero", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t });

  counter.record("a");
  counter.flush();

  const second = counter.flush();
  assert.deepEqual(second.reasons, []);
});

test("empty counter flushes to empty reasons array, not null", () => {
  const counter = createDroppedSampleCounter({ clock: () => 42 });
  const report = counter.flush();
  assert.equal(report.timestamp, 42);
  assert.deepEqual(report.reasons, []);
});

test("shouldFlush is false before the interval elapses", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t, flushIntervalMs: 100 });

  assert.equal(counter.shouldFlush(50), false);
});

test("shouldFlush is true when the interval has elapsed", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t, flushIntervalMs: 100 });

  assert.equal(counter.shouldFlush(100), true);
});

test("shouldFlush is true when the interval has been exceeded", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t, flushIntervalMs: 100 });

  assert.equal(counter.shouldFlush(500), true);
});

test("flush updates the baseline for shouldFlush", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t, flushIntervalMs: 100 });

  counter.record("x");
  t = 100;
  counter.flush(); // resets lastFlushTime to 100

  assert.equal(counter.shouldFlush(150), false);
  assert.equal(counter.shouldFlush(200), true);
});

test("snapshot reads counts without clearing them", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t });

  counter.record("a");
  counter.record("b");

  const snap = counter.snapshot();
  assert.equal(snap.timestamp, 0);
  assert.equal(snap.reasons.length, 2);

  // Counters must still be present after a snapshot.
  const flushed = counter.flush();
  assert.equal(flushed.reasons.length, 2);
});

test("record throws on empty reason string", () => {
  const counter = createDroppedSampleCounter({ clock: () => 0 });
  assert.throws(() => counter.record(""), /non-empty string/);
});

test("record throws on non-string reason", () => {
  const counter = createDroppedSampleCounter({ clock: () => 0 });
  assert.throws(() => counter.record(123), /non-empty string/);
});

test("default clock is Date.now when not provided", () => {
  const before = Date.now();
  const counter = createDroppedSampleCounter();
  counter.record("a");
  const report = counter.flush();
  const after = Date.now();

  // Must be within the window [before, after]. Strict inequality would be
  // non-deterministic across machines.
  assert.ok(report.timestamp >= before && report.timestamp <= after);
});

test("default flushIntervalMs is 60000", () => {
  let t = 0;
  const counter = createDroppedSampleCounter({ clock: () => t });

  assert.equal(counter.shouldFlush(59999), false);
  assert.equal(counter.shouldFlush(60000), true);
});

test("reasons accumulate across calls before flush", () => {
  const counter = createDroppedSampleCounter({ clock: () => 0 });

  counter.record("a");
  counter.record("a");
  counter.record("b");
  counter.record("a");
  counter.record("b");

  const report = counter.flush();
  const byReason = new Map(report.reasons.map((r) => [r.reason, r.count]));

  assert.equal(byReason.get("a"), 3);
  assert.equal(byReason.get("b"), 2);
});
