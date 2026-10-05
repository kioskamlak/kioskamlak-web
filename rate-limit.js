/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Core — Client-side rate limiter for sensitive local actions.
 */
(function (global) {
  'use strict';

  const buckets = new Map();

  function allow(key, limit = 20, windowMs = 60_000) {
    const k = String(key || 'default');
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now >= b.reset) {
      b = { count: 0, limit: Math.max(1, Number(limit) || 20), reset: now + Math.max(1, Number(windowMs) || 60_000) };
      buckets.set(k, b);
    }
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  }

  function remaining(key) {
    const b = buckets.get(String(key || 'default'));
    if (!b || Date.now() >= b.reset) return Infinity;
    return Math.max(0, (b.limit || 20) - b.count);
  }

  function reset(key) {
    buckets.delete(String(key || 'default'));
  }

  global.ShirangiRateLimit = Object.freeze({ allow, remaining, reset });
})(typeof window !== 'undefined' ? window : globalThis);
