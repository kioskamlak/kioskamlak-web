/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Security Runtime Hardening — canonical boundary.
 * Purpose: common validation, prototype-pollution defense, PII minimization,
 * bounded rate limiting and transport-safe payload preparation.
 * This layer never stores secrets and never claims client-side security is a
 * replacement for server-side authorization, RLS, provider controls or TLS.
 */
(function (global) {
  'use strict';

  const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const MAX_DEPTH = 8;
  const MAX_KEYS = 500;
  const buckets = new Map();

  function safeText(value, max = 4000) {
    return String(value ?? '').normalize('NFKC').trim().slice(0, Math.max(0, Number(max) || 0));
  }

  function safeNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    const n = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
  }

  function clean(value, depth = 0, seen = new WeakSet()) {
    if (depth > MAX_DEPTH) return null;
    if (value === null || typeof value !== 'object') return typeof value === 'string' ? safeText(value) : value;
    if (seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map(v => clean(v, depth + 1, seen));
    const out = Object.create(null);
    let count = 0;
    for (const [key, val] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key) || count++ >= MAX_KEYS) continue;
      out[safeText(key, 120)] = clean(val, depth + 1, seen);
    }
    return out;
  }

  function redactPII(value) {
    const out = clean(value);
    const scrub = (node) => {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) return node.map(scrub);
      for (const key of Object.keys(node)) {
        if (/^(password|secret|token|authorization|service.?role|private.?key|merchant.?id|admin.?secret)$/i.test(key)) node[key] = '[REDACTED]';
        else if (/^(phone|mobile|email|national.?id|card|account)$/i.test(key)) node[key] = '[REDACTED_PII]';
        else node[key] = scrub(node[key]);
      }
      return node;
    };
    return scrub(out);
  }

  function transportPayload(value, maxBytes = 250000) {
    const safe = redactPII(value);
    let json;
    try { json = JSON.stringify(safe); } catch { return { ok: false, error: 'payload_invalid' }; }
    if (json.length > maxBytes) return { ok: false, error: 'payload_too_large' };
    return { ok: true, value: safe, json };
  }

  function allow(key, limit = 20, windowMs = 60000) {
    const k = safeText(key, 160) || 'anonymous';
    const now = Date.now();
    const row = buckets.get(k) || { start: now, count: 0 };
    if (now - row.start >= windowMs) { row.start = now; row.count = 0; }
    row.count += 1;
    buckets.set(k, row);
    if (buckets.size > 1000) for (const [name, item] of buckets) if (now - item.start >= windowMs) buckets.delete(name);
    return row.count <= limit;
  }

  function assertIdentifier(value, label = 'id') {
    const s = safeText(value, 160);
    if (!s || !/^[A-Za-z0-9._:-]{1,160}$/.test(s)) throw new Error(`INVALID_${String(label).toUpperCase()}`);
    return s;
  }

  function health() {
    return Object.freeze({ name: 'Shirangi Security Runtime', version: (globalThis.ShirangiVersion?.runtime || '42.6.7'), boundedBuckets: buckets.size });
  }

  global.ShirangiSecurityRuntime = Object.freeze({ safeText, safeNumber, clean, redactPII, transportPayload, allow, assertIdentifier, health });
})(typeof window !== 'undefined' ? window : globalThis);
